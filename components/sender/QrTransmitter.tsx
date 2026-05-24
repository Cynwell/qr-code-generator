// QR Transmitter component - renders QR codes directly to canvas
// Uses lazy frame generation with a bounded lookahead buffer

"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Button } from '@heroui/button';
import QRCode from 'qrcode';

import {
  buildTransferSession, SymbolGenerator,
  type TransferSession, type TransferSessionConfig, DEFAULT_CONFIG,
} from '@/utils/sender/transfer-session';
import { FrameType, type QrEccLevel } from '@/utils/protocol';

export type QrLayout = 'single' | 'grid-2x2' | 'grid-3x2';

export interface QrTransmitterProps {
  input: string | File;
  blockSize?: number;
  interval?: number;
  qrEccLevel?: QrEccLevel;
  compression?: 'auto' | 'none' | 'gzip' | 'deflate';
  manifestRepeatInterval?: number;
  qrLayout?: QrLayout;
  onSessionReady?: (session: TransferSession) => void;
  onStatsUpdate?: (stats: SenderStats) => void;
}

export interface SenderStats {
  sessionId: number;
  qrEccLevel: string;
  blockSize: number;
  sourceBlockCount: number;
  originalBytes: number;
  compressedBytes: number;
  compressionRatio: number;
  framesRendered: number;
  sourceFramesRendered: number;
  repairFramesRendered: number;
  manifestFramesRendered: number;
  configuredIntervalMs: number;
  actualFps: number;
  averageQrRenderMs: number;
  maxQrRenderMs: number;
  underrunCount: number;
  estimatedPayloadBytesPerSecond: number;
}

const LOOKAHEAD_FRAMES = 3;

const getInputBuffer = (input: string | File): Promise<{ buffer: Uint8Array; mode: 'text' | 'binary'; fileName: string; mimeType: string }> => {
  if (typeof input === 'string') {
    return Promise.resolve({
      buffer: new TextEncoder().encode(input),
      mode: 'text' as const,
      fileName: '',
      mimeType: 'text/plain',
    });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const data = new Uint8Array(event.target.result as ArrayBuffer);
        resolve({
          buffer: data,
          mode: 'binary' as const,
          fileName: input.name,
          mimeType: input.type || 'application/octet-stream',
        });
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(input);
  });
};

const LAYOUT_CONFIG: Record<QrLayout, { cols: number; rows: number }> = {
  'single': { cols: 1, rows: 1 },
  'grid-2x2': { cols: 2, rows: 2 },
  'grid-3x2': { cols: 3, rows: 2 },
};

const QrTransmitter: React.FC<QrTransmitterProps> = ({
  input,
  blockSize = DEFAULT_CONFIG.blockSize,
  interval = 200,
  qrEccLevel = DEFAULT_CONFIG.qrEccLevel,
  compression = 'auto',
  manifestRepeatInterval = DEFAULT_CONFIG.manifestRepeatInterval,
  qrLayout = 'single',
  onSessionReady,
  onStatsUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<TransferSession | null>(null);
  const generatorRef = useRef<SymbolGenerator | null>(null);
  const generationIdRef = useRef(0);
  const qrFixedWidthRef = useRef<number>(0); // Fixed pixel width for consistent QR size

  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [manualIndex, setManualIndex] = useState('');
  const [currentSymbolId, setCurrentSymbolId] = useState(-1);
  const [currentFrameType, setCurrentFrameType] = useState<FrameType>(FrameType.Source);
  const [sessionInfo, setSessionInfo] = useState<{ K: number; sessionId: number } | null>(null);

  // Stats tracking
  const statsRef = useRef({
    framesRendered: 0,
    sourceFrames: 0,
    repairFrames: 0,
    manifestFrames: 0,
    renderTimes: [] as number[],
    maxRenderMs: 0,
    underruns: 0,
    startTime: 0,
  });

  // Build session when input or config changes
  useEffect(() => {
    const currentGenId = ++generationIdRef.current;
    setReady(false);

    const build = async () => {
      try {
        const { buffer, mode, fileName, mimeType } = await getInputBuffer(input);
        if (currentGenId !== generationIdRef.current) return;

        const config: TransferSessionConfig = {
          blockSize,
          qrEccLevel,
          compression,
          manifestRepeatInterval,
        };

        const session = await buildTransferSession(buffer, mode, fileName, mimeType, config);
        if (currentGenId !== generationIdRef.current) return;

        sessionRef.current = session;
        generatorRef.current = new SymbolGenerator(session);
        statsRef.current = {
          framesRendered: 0, sourceFrames: 0, repairFrames: 0, manifestFrames: 0,
          renderTimes: [], maxRenderMs: 0, underruns: 0, startTime: Date.now(),
        };

        // Compute fixed QR width by rendering a max-size dummy payload
        // This ensures all QR codes (manifest, source, repair) render at the same pixel size
        const dummyData = new Uint8Array(session.blockSize + 32); // blockSize + header
        const tempCanvas = document.createElement('canvas');
        const eccLevel = session.config.qrEccLevel || 'M';
        const scale = qrLayout === 'single' ? 8 : 4;
        const margin = qrLayout === 'single' ? 2 : 1;
        await QRCode.toCanvas(tempCanvas, [{ data: dummyData, mode: 'byte' }], {
          errorCorrectionLevel: eccLevel, margin, scale,
          color: { dark: '#000000', light: '#ffffff' },
        });
        qrFixedWidthRef.current = tempCanvas.width;

        setSessionInfo({ K: session.K, sessionId: session.sessionId });
        setReady(true);
        setPaused(false);
        onSessionReady?.(session);
      } catch (err) {
        console.error('Session build error:', err);
      }
    };

    build();
  }, [input, blockSize, qrEccLevel, compression, manifestRepeatInterval]);

  // Render one frame to canvas (supports single and grid layouts)
  const renderNextFrame = useCallback(async () => {
    const generator = generatorRef.current;
    const canvas = canvasRef.current;
    if (!generator || !canvas) return;

    const t0 = performance.now();
    const layout = LAYOUT_CONFIG[qrLayout];
    const tileCount = layout.cols * layout.rows;

    // For grid mode, use a scratch canvas
    if (tileCount > 1) {
      if (!scratchCanvasRef.current) {
        scratchCanvasRef.current = document.createElement('canvas');
      }
      const scratch = scratchCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let tileW = 0, tileH = 0;

      for (let tile = 0; tile < tileCount; tile++) {
        const { frame, frameType, symbolId } = generator.next();

        try {
          await QRCode.toCanvas(scratch, [{ data: frame, mode: 'byte' }], {
            errorCorrectionLevel: sessionRef.current?.config.qrEccLevel || 'M',
            margin: 1,
            width: qrFixedWidthRef.current || undefined,
            color: { dark: '#000000', light: '#ffffff' },
          });
        } catch (err) {
          console.error('QR render error (tile):', err);
          statsRef.current.underruns++;
          continue;
        }

        // Set output canvas size on first tile
        if (tile === 0) {
          tileW = scratch.width;
          tileH = scratch.height;
          canvas.width = tileW * layout.cols;
          canvas.height = tileH * layout.rows;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        const col = tile % layout.cols;
        const row = Math.floor(tile / layout.cols);
        ctx.drawImage(scratch, col * tileW, row * tileH);

        // Update stats per tile
        const s = statsRef.current;
        s.framesRendered++;
        switch (frameType) {
          case FrameType.Source: s.sourceFrames++; break;
          case FrameType.Repair: s.repairFrames++; break;
          case FrameType.Manifest: s.manifestFrames++; break;
        }

        if (tile === tileCount - 1) {
          setCurrentSymbolId(symbolId);
          setCurrentFrameType(frameType);
        }
      }
    } else {
      // Single QR mode
      const { frame, frameType, symbolId } = generator.next();

      try {
        await QRCode.toCanvas(canvas, [{ data: frame, mode: 'byte' }], {
          errorCorrectionLevel: sessionRef.current?.config.qrEccLevel || 'M',
          margin: 2,
          width: qrFixedWidthRef.current || undefined,
          color: { dark: '#000000', light: '#ffffff' },
        });
        // QRCode.toCanvas sets inline style.width/height which overrides CSS classes.
        // Clear them so Tailwind's w-full takes effect.
        canvas.style.width = '';
        canvas.style.height = '';
      } catch (err) {
        console.error('QR render error:', err);
        statsRef.current.underruns++;
        return;
      }

      const s = statsRef.current;
      s.framesRendered++;
      switch (frameType) {
        case FrameType.Source: s.sourceFrames++; break;
        case FrameType.Repair: s.repairFrames++; break;
        case FrameType.Manifest: s.manifestFrames++; break;
      }

      setCurrentSymbolId(symbolId);
      setCurrentFrameType(frameType);
    }

    const renderMs = performance.now() - t0;

    // Update render time stats
    const s = statsRef.current;
    s.renderTimes.push(renderMs);
    if (s.renderTimes.length > 100) s.renderTimes.shift();
    if (renderMs > s.maxRenderMs) s.maxRenderMs = renderMs;
    if (renderMs > interval) s.underruns++;

    // Report stats
    if (onStatsUpdate && s.framesRendered % 5 === 0) {
      const elapsed = (Date.now() - s.startTime) / 1000;
      const avgRender = s.renderTimes.reduce((a, b) => a + b, 0) / s.renderTimes.length;
      const session = sessionRef.current!;
      onStatsUpdate({
        sessionId: session.sessionId,
        qrEccLevel: session.config.qrEccLevel,
        blockSize: session.blockSize,
        sourceBlockCount: session.K,
        originalBytes: session.manifest.originalLength,
        compressedBytes: session.manifest.compressedLength,
        compressionRatio: session.manifest.originalLength / Math.max(1, session.manifest.compressedLength),
        framesRendered: s.framesRendered,
        sourceFramesRendered: s.sourceFrames,
        repairFramesRendered: s.repairFrames,
        manifestFramesRendered: s.manifestFrames,
        configuredIntervalMs: interval,
        actualFps: elapsed > 0 ? s.framesRendered / elapsed : 0,
        averageQrRenderMs: avgRender,
        maxQrRenderMs: s.maxRenderMs,
        underrunCount: s.underruns,
        estimatedPayloadBytesPerSecond: elapsed > 0
          ? (s.sourceFrames + s.repairFrames) * session.blockSize / elapsed
          : 0,
      });
    }
  }, [interval, qrLayout, onStatsUpdate]);

  // Interval-driven frame emission
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (ready && !paused) {
      // Render first frame immediately
      renderNextFrame();
      intervalRef.current = setInterval(renderNextFrame, interval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [ready, paused, interval, renderNextFrame]);

  const frameTypeLabel = useMemo(() => {
    switch (currentFrameType) {
      case FrameType.Source: return 'Source';
      case FrameType.Repair: return 'Repair';
      case FrameType.Manifest: return 'Manifest';
      default: return '';
    }
  }, [currentFrameType]);

  const [fullscreen, setFullscreen] = useState(false);

  // Close fullscreen on Escape key
  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen]);

  if (!ready) return null;

  return (
    <div className="mt-4 flex flex-col gap-3">
      {/* QR Canvas — square, sized to fit container width or viewport height (whichever is smaller) */}
      <div className="w-full flex justify-center">
        <canvas
          ref={canvasRef}
          className="block rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          style={{
            imageRendering: 'pixelated',
            width: '100%',
            maxWidth: 'calc(100vh - 5rem)',
            maxHeight: 'calc(100vh - 5rem)',
            aspectRatio: '1',
          }}
          onClick={() => setFullscreen(true)}
          title="Click to enlarge"
        />
      </div>

      {/* Fullscreen overlay — fills entire screen, Esc or click to close */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center cursor-pointer"
          onClick={() => setFullscreen(false)}
        >
          <canvas
            ref={(el) => {
              if (!el || !canvasRef.current) return;
              const src = canvasRef.current;
              el.width = src.width;
              el.height = src.height;
              const ctx = el.getContext('2d');
              if (ctx) ctx.drawImage(src, 0, 0);
              // Poll to keep in sync while fullscreen
              const id = setInterval(() => {
                if (!el.isConnected) { clearInterval(id); return; }
                if (src.width > 0) {
                  el.width = src.width;
                  el.height = src.height;
                  const c = el.getContext('2d');
                  if (c) c.drawImage(src, 0, 0);
                }
              }, 50);
            }}
            style={{ imageRendering: 'pixelated', width: '100vw', height: '100vh', objectFit: 'contain' }}
          />
          <button
            className="absolute top-4 right-4 text-white text-3xl font-bold hover:text-gray-300 z-50"
            onClick={(e) => { e.stopPropagation(); setFullscreen(false); }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Frame info */}
      <p className="text-center text-sm text-default-500">
        {frameTypeLabel}
        {currentSymbolId >= 0 && ` #${currentSymbolId}`}
        {sessionInfo && (
          <span className="text-default-400">
            {' '}| K={sessionInfo.K}
          </span>
        )}
      </p>

      {/* Playback controls */}
      <div className="flex justify-center items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant={paused ? "solid" : "flat"}
          color={paused ? "success" : "default"}
          onPress={() => setPaused(p => !p)}
        >
          {paused ? "▶ Play" : "⏸ Pause"}
        </Button>
      </div>
    </div>
  );
};

export default QrTransmitter;

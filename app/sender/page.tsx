// app/sender/page.tsx
"use client";
import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import FileUploader from "@/components/file-uploader";
import { Textarea } from "@heroui/input";
import { Slider } from "@heroui/slider";
import { Divider } from "@heroui/divider";
import { title } from "@/components/primitives";
import SenderStatsPanel from "@/components/sender/SenderStatsPanel";
import type { SenderStats, QrLayout } from "@/components/sender/QrTransmitter";
import { HEADER_LENGTH } from "@/utils/protocol";
import type { QrEccLevel, CompressionMode } from "@/utils/protocol";

// Import QrTransmitter with dynamic and disable SSR
const QrTransmitter = dynamic(() => import('@/components/sender/QrTransmitter'), { ssr: false });


type TransferProfile = 'xs' | 'small' | 'medium' | 'large' | 'custom';

const PROFILES: Record<Exclude<TransferProfile, 'custom'>, {
  qrEcc: QrEccLevel; blockSize: number; interval: number; compression: 'auto' | CompressionMode;
  manifestRepeat: number; label: string; description: string;
}> = {
  xs: { qrEcc: 'L', blockSize: 122, interval: 200, compression: 'auto', manifestRepeat: 20, label: 'XS QR', description: 'V5 · 122B · Fastest recognition' },
  small: { qrEcc: 'L', blockSize: 239, interval: 200, compression: 'auto', manifestRepeat: 20, label: 'Small QR', description: 'V10 · 239B · Best for low-res cameras' },
  medium: { qrEcc: 'L', blockSize: 488, interval: 200, compression: 'auto', manifestRepeat: 20, label: 'Medium QR', description: 'V15 · 488B · Good balance' },
  large: { qrEcc: 'L', blockSize: 826, interval: 200, compression: 'auto', manifestRepeat: 20, label: 'Large QR', description: 'V20 · 826B · Needs steady camera' },
};

const QR_CAPACITY: Record<QrEccLevel, number> = { L: 2953, M: 2331, Q: 1663, H: 1273 };

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timerRef.current = setTimeout(() => setDebounced(value), delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, delay]);
  return debounced;
}

export default function SenderPage() {
  const [input, setInput] = useState<string | File | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [profile, setProfile] = useState<TransferProfile>('xs');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [senderStats, setSenderStats] = useState<SenderStats | null>(null);

  // Advanced controls (only used in custom mode)
  const [blockSize, setBlockSize] = useState<number>(122);
  const [intervalMs, setIntervalMs] = useState<number>(200);
  const [qrEcc, setQrEcc] = useState<QrEccLevel>('L');
  const [compression, setCompression] = useState<'auto' | CompressionMode>('auto');
  const [manifestRepeat, setManifestRepeat] = useState(20);
  const [qrLayout, setQrLayout] = useState<QrLayout>('single');
  const qrDisplayRef = useRef<HTMLDivElement>(null);
  const [shouldScrollToQR, setShouldScrollToQR] = useState(false);

  const debouncedBlockSize = useDebouncedValue(blockSize, 400);

  // Apply profile settings
  const activeConfig = profile === 'custom'
    ? { qrEcc, blockSize: debouncedBlockSize, interval: intervalMs, compression, manifestRepeat }
    : PROFILES[profile];

  const maxPayload = QR_CAPACITY[activeConfig.qrEcc] - HEADER_LENGTH;
  const blockSizeError = activeConfig.blockSize > maxPayload
    ? `Block size exceeds QR capacity (max ${maxPayload} bytes for ECC ${activeConfig.qrEcc})`
    : null;

  // Auto-scroll to QR display only once per input session
  useEffect(() => {
    if (shouldScrollToQR && qrDisplayRef.current) {
      setShouldScrollToQR(false);
      const el = qrDisplayRef.current;
      requestAnimationFrame(() => {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      });
    }
  }, [shouldScrollToQR]);

  const hasInputRef = useRef(false);

  const handleFileUpload = useCallback((file: File) => {
    setInput(file);
    setShowQR(true);
    setShouldScrollToQR(true);
  }, []);

  const handleTextInput = useCallback((text: string) => {
    if (text.length > 0) {
      const isFirstInput = !hasInputRef.current;
      hasInputRef.current = true;
      setInput(text);
      setShowQR(true);
      if (isFirstInput) setShouldScrollToQR(true);
    } else {
      hasInputRef.current = false;
      setInput(null);
      setShowQR(false);
    }
  }, []);

  const showFileUploader = input === null || input instanceof File;

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="text-center">
        <h1 className={title({ size: 'lg' })}>I&apos;m&nbsp;</h1>
        <h1 className={title({ color: "blue", size: 'lg' })}>Sender&nbsp;</h1>
      </div>

      <Divider />

      {/* File upload area */}
      {showFileUploader && (
        <div className="flex justify-center">
          <FileUploader onFileUpload={handleFileUpload} />
        </div>
      )}

      {/* Text input */}
      <Textarea
        label="Text Input"
        placeholder="Enter or paste text here (supports unicode, tabs, special characters)"
        minRows={4}
        maxRows={12}
        onChange={(e) => handleTextInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const value = target.value;
            target.value = value.substring(0, start) + '\t' + value.substring(end);
            target.selectionStart = target.selectionEnd = start + 1;
            handleTextInput(target.value);
          }
        }}
      />

      <Divider />

      {/* Transfer Profile */}
      <div className="flex flex-col gap-4 px-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-default-600">Transfer Profile</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.entries(PROFILES) as [Exclude<TransferProfile, 'custom'>, typeof PROFILES[keyof typeof PROFILES]][]).map(([key, p]) => (
              <button
                key={key}
                onClick={() => {
                  setProfile(key);
                  // Sync slider states with profile values
                  setBlockSize(p.blockSize);
                  setIntervalMs(p.interval);
                  setQrEcc(p.qrEcc);
                  setCompression(p.compression);
                  setManifestRepeat(p.manifestRepeat);
                }}
                className={`rounded-lg p-2 text-left text-xs border transition-colors ${
                  profile === key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-default-200 hover:border-default-300'
                }`}
              >
                <div className="font-medium">{p.label}</div>
                <div className="text-default-400 mt-0.5">{p.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-default-400">
          QR ECC: {activeConfig.qrEcc} | Max payload: {maxPayload} bytes | Block: {activeConfig.blockSize} bytes | Interval: {activeConfig.interval}ms
        </div>

        {blockSizeError && (
          <div className="text-xs text-danger bg-danger/10 p-2 rounded">
            {blockSizeError}
          </div>
        )}

        {/* Advanced toggle */}
        <button
          onClick={() => {
            setShowAdvanced(a => !a);
            if (!showAdvanced) setProfile('custom');
          }}
          className="text-xs text-default-400 hover:text-default-600 text-left"
        >
          {showAdvanced ? '▼ Hide' : '▶ Show'} Advanced Controls
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-4 pl-2 border-l-2 border-default-200">
            <Slider
              label="Block Size (bytes)"
              step={50}
              maxValue={Math.min(2800, maxPayload)}
              minValue={50}
              value={blockSize}
              showSteps={false}
              color="primary"
              size="md"
              onChange={(value) => { setBlockSize(value as number); setProfile('custom'); }}
              className="w-full"
            />
            <Slider
              label="Interval (ms)"
              step={10}
              maxValue={2000}
              minValue={30}
              value={intervalMs}
              showSteps={false}
              color="secondary"
              size="md"
              onChange={(value) => { setIntervalMs(value as number); setProfile('custom'); }}
              className="w-full"
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-default-500">QR ECC Level</label>
                <select
                  value={qrEcc}
                  onChange={(e) => { setQrEcc(e.target.value as QrEccLevel); setProfile('custom'); }}
                  className="rounded-lg border border-default-200 bg-default-50 px-2 py-1 text-sm"
                >
                  <option value="L">L (max {QR_CAPACITY.L}B)</option>
                  <option value="M">M (max {QR_CAPACITY.M}B)</option>
                  <option value="Q">Q (max {QR_CAPACITY.Q}B)</option>
                  <option value="H">H (max {QR_CAPACITY.H}B)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-default-500">Compression</label>
                <select
                  value={compression}
                  onChange={(e) => { setCompression(e.target.value as 'auto' | CompressionMode); setProfile('custom'); }}
                  className="rounded-lg border border-default-200 bg-default-50 px-2 py-1 text-sm"
                >
                  <option value="auto">Auto</option>
                  <option value="none">None</option>
                  <option value="gzip">Gzip</option>
                  <option value="deflate">Deflate</option>
                </select>
              </div>
            </div>
            <Slider
              label="Manifest Repeat Interval"
              step={5}
              maxValue={100}
              minValue={5}
              value={manifestRepeat}
              showSteps={false}
              color="warning"
              size="sm"
              onChange={(value) => { setManifestRepeat(value as number); setProfile('custom'); }}
              className="w-full"
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-default-500">QR Layout (Multi-QR Tiling) — Experimental</label>
              <select
                value={qrLayout}
                onChange={(e) => setQrLayout(e.target.value as QrLayout)}
                className="rounded-lg border border-default-200 bg-default-50 px-2 py-1 text-sm"
              >
                <option value="single">Single QR</option>
                <option value="grid-2x2">2×2 Grid (4 QR codes)</option>
                <option value="grid-3x2">3×2 Grid (6 QR codes)</option>
              </select>
              {qrLayout !== 'single' && (
                <p className="text-xs text-warning mt-1">
                  Requires high-resolution camera. May not work with most phone cameras.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* QR Code display */}
      <div ref={qrDisplayRef} style={{ scrollMarginTop: '3.5rem' }}>
        {showQR && input && !blockSizeError && (
          <QrTransmitter
            input={input}
            blockSize={activeConfig.blockSize}
            interval={activeConfig.interval}
            qrEccLevel={activeConfig.qrEcc}
            compression={activeConfig.compression}
            manifestRepeatInterval={activeConfig.manifestRepeat}
            qrLayout={qrLayout}
            onStatsUpdate={setSenderStats}
          />
        )}
      </div>

      {/* Stats panel */}
      <SenderStatsPanel stats={senderStats} />
    </div>
  );
}

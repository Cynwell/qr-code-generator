// app/receiver/page.tsx
"use client";
import { useState, useCallback, useRef } from "react";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";

import { title } from "@/components/primitives";
import VideoFeed from "@/components/video-feed";
import type { VideoInputSource } from "@/components/video-feed";
import DownloadButton from "@/components/download-button";
import TextDisplay from "@/components/text-display";
import FragmentGrid from "@/components/fragment-grid";
import ReceiverStatsPanel from "@/components/receiver/ReceiverStatsPanel";
import type { ReceiverSession, ReceiverStats, ReceiverState } from "@/utils/receiver/receiver-session";

export default function ReceiverPage() {
  const [scanning, setScanning] = useState(false);
  const [recoveredFlags, setRecoveredFlags] = useState<boolean[]>([]);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [recoveredCount, setRecoveredCount] = useState(0);
  const [receiverState, setReceiverState] = useState<ReceiverState>('idle');
  const [receiverStats, setReceiverStats] = useState<ReceiverStats | null>(null);
  const [hashVerified, setHashVerified] = useState(false);
  const [hashMismatch, setHashMismatch] = useState(false);
  const [multiQrMode, setMultiQrMode] = useState<'single' | '2x2' | '3x2'>('single');
  const [inputSource, setInputSource] = useState<VideoInputSource>('camera');

  // Transfer result
  const [resultData, setResultData] = useState<Uint8Array | null>(null);
  const [resultMode, setResultMode] = useState<'text' | 'binary'>('text');
  const [resultFileName, setResultFileName] = useState('');
  const [resultMimeType, setResultMimeType] = useState('');

  const handleRecoveredUpdate = useCallback((
    flags: boolean[], recovered: number, total: number,
  ) => {
    setRecoveredFlags(flags);
    setRecoveredCount(recovered);
    setTotalBlocks(total);
  }, []);

  const handleComplete = useCallback(async (session: ReceiverSession) => {
    setScanning(false);
    setReceiverState('reconstructing');

    const result = await session.reconstructAndVerify();
    setReceiverStats({ ...session.stats });

    if (result.data) {
      setResultData(result.data);
      setResultMode(result.mode);
      setResultFileName(result.fileName);
      setResultMimeType(result.mimeType);
      setHashVerified(result.hashMatch);
      setHashMismatch(!result.hashMatch);

      if (!result.hashMatch) {
        setReceiverState('hash-mismatch');
      } else {
        setReceiverState('complete');
      }
    } else {
      setReceiverState('failed');
    }
  }, []);

  const handleManifestReceived = useCallback((manifest: {
    mode: string; fileName: string; mimeType: string; K: number;
  }) => {
    // Only initialize flags on first manifest (don't reset existing progress)
    setTotalBlocks(prev => prev > 0 ? prev : manifest.K);
    setRecoveredFlags(prev => prev.length > 0 ? prev : new Array(manifest.K).fill(false));
    setResultMode(manifest.mode === 'binary' ? 'binary' : 'text');
    if (manifest.fileName) setResultFileName(manifest.fileName);
    if (manifest.mimeType) setResultMimeType(manifest.mimeType);
  }, []);

  const handleNewScan = useCallback(() => {
    setRecoveredFlags([]);
    setTotalBlocks(0);
    setRecoveredCount(0);
    setReceiverState('idle');
    setReceiverStats(null);
    setHashVerified(false);
    setHashMismatch(false);
    setResultData(null);
    setResultFileName('');
    setResultMimeType('');
    setScanning(true);
  }, []);

  const toggleScanning = useCallback(() => {
    if (!scanning && resultData) {
      // Start new scan
      handleNewScan();
    } else {
      setScanning(prev => !prev);
    }
  }, [scanning, resultData, handleNewScan]);

  const downloadResult = useCallback(() => {
    if (!resultData) return;
    const blob = new Blob([resultData.buffer as ArrayBuffer], { type: resultMimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date();
    const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
    link.download = resultFileName || `${timestamp}.bin`;
    link.click();
    URL.revokeObjectURL(url);
  }, [resultData, resultFileName, resultMimeType]);

  const stateLabel = (() => {
    switch (receiverState) {
      case 'idle': return '';
      case 'scanning-no-session': return 'Scanning...';
      case 'session-detected': return 'Session detected';
      case 'receiving': return `Receiving: ${recoveredCount}/${totalBlocks} blocks`;
      case 'reconstructing': return 'Reconstructing...';
      case 'verifying-hash': return 'Verifying integrity...';
      case 'complete': return 'Transfer complete ✓';
      case 'hash-mismatch': return 'Hash mismatch ⚠';
      case 'failed': return 'Transfer failed ✗';
      default: return '';
    }
  })();

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="text-center">
        <h1 className={title({ size: 'lg' })}>I&apos;m&nbsp;</h1>
        <h1 className={title({ color: "violet", size: 'lg' })}>Receiver&nbsp;</h1>
      </div>

      <Divider />

      {/* Input source selector */}
      <div className="flex justify-center gap-2">
        <Button
          color={inputSource === 'camera' ? 'primary' : 'default'}
          variant={inputSource === 'camera' ? 'solid' : 'bordered'}
          size="sm"
          onPress={() => setInputSource('camera')}
          isDisabled={scanning}
        >
          Camera
        </Button>
        <Button
          color={inputSource === 'screen' ? 'primary' : 'default'}
          variant={inputSource === 'screen' ? 'solid' : 'bordered'}
          size="sm"
          onPress={() => setInputSource('screen')}
          isDisabled={scanning}
        >
          Screen Share
        </Button>
      </div>

      {/* State indicator */}
      {stateLabel && (
        <div className={`text-center text-sm font-medium ${
          receiverState === 'complete' ? 'text-success' :
          receiverState === 'hash-mismatch' ? 'text-warning' :
          receiverState === 'failed' ? 'text-danger' :
          'text-default-500'
        }`}>
          {stateLabel}
        </div>
      )}

      {/* Fragment grid */}
      <FragmentGrid
        totalFragments={totalBlocks}
        recoveredFlags={recoveredFlags}
      />

      {/* Video component */}
      <VideoFeed
        scanning={scanning}
        inputSource={inputSource}
        multiQrGrid={multiQrMode === 'single' ? null : multiQrMode === '2x2' ? { cols: 2, rows: 2 } : { cols: 3, rows: 2 }}
        onRecoveredUpdate={handleRecoveredUpdate}
        onComplete={handleComplete}
        onStatsUpdate={setReceiverStats}
        onStateChange={setReceiverState}
        onManifestReceived={handleManifestReceived}
      />

      {/* Hash verification status */}
      {hashVerified && (
        <div className="text-center text-xs text-success bg-success/10 p-2 rounded">
          SHA-256 integrity verified ✓
        </div>
      )}
      {hashMismatch && (
        <div className="text-center text-xs text-warning bg-warning/10 p-2 rounded">
          SHA-256 hash mismatch — data may be corrupted. You can still download, but verify manually.
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-center gap-3 flex-wrap">
        <Button
          color="secondary"
          variant="ghost"
          size="lg"
          onPress={toggleScanning}
        >
          {scanning
            ? "Stop"
            : resultData
              ? "New Scan"
              : inputSource === 'screen'
                ? "Share Screen"
                : "Scan"
          }
        </Button>

        {resultData && resultMode === 'binary' && (
          <Button
            color="primary"
            variant="solid"
            size="lg"
            onPress={downloadResult}
          >
            Download {resultFileName || 'File'}
          </Button>
        )}
      </div>

      {/* Text display for text mode */}
      {resultData && resultMode === 'text' && (
        <TextDisplay
          chunks={[new TextDecoder().decode(resultData)]}
        />
      )}

      {/* Stats panel */}
      <ReceiverStatsPanel stats={receiverStats} />

      {/* Multi-QR mode (experimental) */}
      <details className="text-xs text-default-400">
        <summary className="cursor-pointer hover:text-default-600">Advanced: Multi-QR scan mode (experimental)</summary>
        <div className="flex items-center gap-2 mt-2 justify-center">
          <select
            value={multiQrMode}
            onChange={(e) => setMultiQrMode(e.target.value as 'single' | '2x2' | '3x2')}
            className="rounded-lg border border-default-200 bg-default-50 px-2 py-1 text-sm"
            disabled={scanning}
          >
            <option value="single">Single QR</option>
            <option value="2x2">2×2 Grid (4 QR codes)</option>
            <option value="3x2">3×2 Grid (6 QR codes)</option>
          </select>
        </div>
      </details>
    </div>
  );
}

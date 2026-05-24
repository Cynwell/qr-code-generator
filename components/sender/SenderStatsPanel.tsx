"use client";
import React, { useState } from 'react';
import { Button } from '@heroui/button';
import type { SenderStats } from './QrTransmitter';

interface SenderStatsPanelProps {
  stats: SenderStats | null;
}

const SenderStatsPanel: React.FC<SenderStatsPanelProps> = ({ stats }) => {
  const [expanded, setExpanded] = useState(false);

  if (!stats) return null;

  const copyStats = () => {
    navigator.clipboard?.writeText(JSON.stringify(stats, null, 2));
  };

  return (
    <div className="w-full border border-default-200 rounded-lg p-3">
      <div className="flex justify-between items-center">
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-sm font-medium text-default-600 hover:text-default-800"
        >
          {expanded ? '▼' : '▶'} Sender Stats
        </button>
        {expanded && (
          <Button size="sm" variant="light" onPress={copyStats}>
            Copy JSON
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-default-500">
          <span>Session ID:</span>
          <span className="font-mono">0x{stats.sessionId.toString(16).padStart(8, '0')}</span>

          <span>QR ECC:</span>
          <span>{stats.qrEccLevel}</span>

          <span>Block Size:</span>
          <span>{stats.blockSize} bytes</span>

          <span>Source Blocks (K):</span>
          <span>{stats.sourceBlockCount}</span>

          <span>Original Size:</span>
          <span>{formatBytes(stats.originalBytes)}</span>

          <span>Compressed Size:</span>
          <span>{formatBytes(stats.compressedBytes)} ({stats.compressionRatio.toFixed(2)}x)</span>

          <span className="col-span-2 border-t border-default-100 mt-1 pt-1" />

          <span>Frames Rendered:</span>
          <span>{stats.framesRendered}</span>

          <span>Source / Repair / Manifest:</span>
          <span>{stats.sourceFramesRendered} / {stats.repairFramesRendered} / {stats.manifestFramesRendered}</span>

          <span>Actual FPS:</span>
          <span>{stats.actualFps.toFixed(1)}</span>

          <span>Avg Render Time:</span>
          <span>{stats.averageQrRenderMs.toFixed(1)} ms</span>

          <span>Max Render Time:</span>
          <span>{stats.maxQrRenderMs.toFixed(1)} ms</span>

          <span>Underruns:</span>
          <span>{stats.underrunCount}</span>

          <span>Est. Throughput:</span>
          <span>{formatBytes(stats.estimatedPayloadBytesPerSecond)}/s</span>
        </div>
      )}
    </div>
  );
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default SenderStatsPanel;

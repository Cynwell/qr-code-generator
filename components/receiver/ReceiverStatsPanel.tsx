"use client";
import React, { useState } from 'react';
import { Button } from '@heroui/button';
import type { ReceiverStats } from '@/utils/receiver/receiver-session';

interface ReceiverStatsPanelProps {
  stats: ReceiverStats | null;
}

const ReceiverStatsPanel: React.FC<ReceiverStatsPanelProps> = ({ stats }) => {
  const [expanded, setExpanded] = useState(false);

  if (!stats) return null;

  const copyStats = () => {
    navigator.clipboard?.writeText(JSON.stringify(stats, null, 2));
  };

  const elapsed = stats.firstFrameTimestamp
    ? ((stats.completionTimestamp || Date.now()) - stats.firstFrameTimestamp) / 1000
    : 0;

  return (
    <div className="w-full border border-default-200 rounded-lg p-3">
      <div className="flex justify-between items-center">
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-sm font-medium text-default-600 hover:text-default-800"
        >
          {expanded ? '▼' : '▶'} Receiver Stats
        </button>
        {expanded && (
          <Button size="sm" variant="light" onPress={copyStats}>
            Copy JSON
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-default-500">
          <span>Scanner Backend:</span>
          <span>{stats.scannerBackend}</span>

          <span>Scan Mode:</span>
          <span>{stats.scanMode}</span>

          <span>Video Frames:</span>
          <span>{stats.videoFramesObserved}</span>

          <span>Scan Attempts:</span>
          <span>{stats.scanAttempts}</span>

          <span>QR Decodes:</span>
          <span>{stats.successfulQrDecodes}</span>

          <span className="col-span-2 border-t border-default-100 mt-1 pt-1" />

          <span>Unique / Duplicate:</span>
          <span>{stats.uniqueFrames} / {stats.duplicateFrames}</span>

          <span>Source / Repair / Manifest:</span>
          <span>{stats.sourceFrames} / {stats.repairFrames} / {stats.manifestFrames}</span>

          <span>Malformed / CRC Fail:</span>
          <span>{stats.malformedFrames} / {stats.crcFailures}</span>

          <span>Wrong Session:</span>
          <span>{stats.wrongSessionFrames}</span>

          <span className="col-span-2 border-t border-default-100 mt-1 pt-1" />

          <span>Recovered Blocks:</span>
          <span>{stats.recoveredBlocks} / {stats.sourceBlockCount}</span>

          <span>Pending Repairs:</span>
          <span>{stats.pendingRepairSymbols}</span>

          <span>Elapsed:</span>
          <span>{elapsed.toFixed(1)}s</span>

          {stats.effectivePayloadBytesPerSecond !== null && (
            <>
              <span>Throughput:</span>
              <span>{formatBytes(stats.effectivePayloadBytesPerSecond)}/s</span>
            </>
          )}
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

export default ReceiverStatsPanel;

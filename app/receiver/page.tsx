// app/receiver/page.tsx
"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";

import { title } from "@/components/primitives";
import VideoFeed from "@/components/video-feed";
import DownloadButton from "@/components/download-button";
import TextDisplay from "@/components/text-display";
import FragmentGrid from "@/components/fragment-grid";

// Define a type that accommodates Uint8Array, string, and null
type Chunk = Uint8Array | string | null;

export default function ReceiverPage() {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [totalSegments, setTotalSegments] = useState(0);
  const [metadata, setMetadata] = useState({ name: "file.bin", type: "application/octet-stream" });
  const [mode, setMode] = useState("unknown");
  const [scanning, setScanning] = useState(false);
  const [recoveredFlags, setRecoveredFlags] = useState<boolean[]>([]);
  const memoizedChunks = useMemo(() => chunks, [chunks]);

  useEffect(() => {
    const nonNullChunks = memoizedChunks.filter(
      (chunk): chunk is Uint8Array | string => chunk !== null
    );
    if (nonNullChunks.length >= totalSegments && totalSegments > 0) {
      setScanning(false);
    }
  }, [memoizedChunks, totalSegments]);

  const toggleScanning = useCallback(() => {
    if (!scanning && chunks.length > 0) {
      setChunks([]);
      setTotalSegments(0);
      setMetadata({ name: "file.bin", type: "application/octet-stream" });
      setMode("unknown");
      setRecoveredFlags([]);
    }
    setScanning((prev) => !prev);
  }, [scanning, chunks.length]);

  const isBinary = mode !== "utf-8";

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
      <div>
        <h1 className={title()}>I&apos;m&nbsp;</h1>
        <h1 className={title({ color: "violet" })}>Receiver&nbsp;</h1>
      </div>

      <Divider />

      {/* BitTorrent-style fragment grid */}
      <FragmentGrid
        totalFragments={totalSegments}
        recoveredFlags={recoveredFlags}
      />

      {/* Video component to display the camera feed */}
      <VideoFeed
        scanning={scanning}
        setChunks={setChunks}
        setTotalSegments={setTotalSegments}
        setMetadata={setMetadata}
        setMode={setMode}
        setRecoveredFlags={setRecoveredFlags}
      />

      {/* Action buttons */}
      <div className="flex justify-center gap-3 flex-wrap">
        <Button
          color="secondary"
          variant="ghost"
          size="lg"
          onPress={toggleScanning}
        >
          {scanning ? "Stop" : chunks.length > 0 ? "New Scan" : "Scan"}
        </Button>

        {isBinary && (
          <DownloadButton
            chunks={memoizedChunks.filter((chunk): chunk is Uint8Array => chunk instanceof Uint8Array)}
            totalSegments={totalSegments}
            metadata={metadata}
          />
        )}
      </div>

      {mode === "utf-8" && (
        <TextDisplay
          chunks={memoizedChunks.filter((chunk): chunk is string => typeof chunk === "string")}
        />
      )}
    </div>
  );
}

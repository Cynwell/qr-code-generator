// app/receiver/page.tsx
"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Progress } from "@heroui/progress";

import { title } from "@/components/primitives";
import VideoFeed from "@/components/video-feed";
import DownloadButton from "@/components/download-button";
import TextDisplay from "@/components/text-display";

// Define a type that accommodates Uint8Array, string, and null
type Chunk = Uint8Array | string | null;

export default function ReceiverPage() {
  // Update the state type to include nulls
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [totalSegments, setTotalSegments] = useState(0);
  const [metadata, setMetadata] = useState({ name: "file.bin", type: "application/octet-stream" });
  const [mode, setMode] = useState("unknown");
  const [scanning, setScanning] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const memoizedChunks = useMemo(() => chunks, [chunks]);

  useEffect(() => {
    // Filter out null values
    const nonNullChunks = memoizedChunks.filter(
      (chunk): chunk is Uint8Array | string => chunk !== null
    );
    if (nonNullChunks.length >= totalSegments && totalSegments > 0) {
      setScanning(false);
    }
    setProgressValue(
      totalSegments === 0 ? 0 : Math.ceil((nonNullChunks.length / totalSegments) * 100)
    );
  }, [memoizedChunks, totalSegments]);

  const toggleScanning = useCallback(() => {
    if (!scanning && chunks.length > 0) {
      // Resetting the state for a new scanning session
      setChunks([]);
      setTotalSegments(0);
      setMetadata({ name: "file.bin", type: "application/octet-stream" });
      setMode("unknown");
      setProgressValue(0);
    }
    setScanning((prev) => !prev);
  }, [scanning, chunks.length]);

  // Determine if the current mode is binary
  const isBinary = mode !== "utf-8";

  return (
    <div>
      <h1 className={title()}>I&apos;m&nbsp;</h1>
      <h1 className={title({ color: "violet" })}>Receiver&nbsp;</h1>
      <Divider className="my-4" />

      <Progress
        aria-label="Downloading..."
        size="md"
        value={progressValue}
        color="success"
        showValueLabel={true}
        className="max-w-full"
      />

      {/* Video component to display the camera feed */}
      <VideoFeed
        scanning={scanning}
        setChunks={setChunks}
        setTotalSegments={setTotalSegments}
        setMetadata={setMetadata}
        setMode={setMode}
      />

      {/* Button to start/stop scanning */}
      <Button
        color="secondary"
        variant="ghost"
        size="lg"
        onClick={toggleScanning}
        // disabled={memoizedChunks.length !== totalSegments}
      >
        {scanning ? "Stop" : chunks.length > 0 ? "New Scan" : "Scan"}
      </Button>

      {/* DownloadButton rendered only in binary mode */}
      {isBinary && (
        <DownloadButton
          chunks={memoizedChunks.filter((chunk): chunk is Uint8Array => chunk instanceof Uint8Array)}
          totalSegments={totalSegments}
          metadata={metadata}
        />
      )}

      {/* TextDisplay rendered only in UTF-8 mode */}
      {mode === "utf-8" && (
        <TextDisplay
          chunks={memoizedChunks.filter((chunk): chunk is string => typeof chunk === "string")}
        />
      )}
    </div>
  );
}

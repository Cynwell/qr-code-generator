// app/receiver/page.tsx
"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@nextui-org/button";
import { Divider } from "@nextui-org/divider";
import { Progress } from "@nextui-org/react";

import { title } from "@/components/primitives";
import VideoFeed from "@/components/video-feed";
import DownloadButton from "@/components/download-button";
import TextDisplay from "@/components/text-display";

export default function ReceiverPage() {
  const [chunks, setChunks] = useState([]);
  const [totalSegments, setTotalSegments] = useState(0);
  const [metadata, setMetadata] = useState({ name: "file.bin", type: "application/octet-stream" });
  const [mode, setMode] = useState("unknown");
  const [scanning, setScanning] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const memoizedChunks = useMemo(() => chunks, [chunks]);

  useEffect(() => {
    const nonNullChunks = memoizedChunks.filter(chunk => chunk !== null);
    if (nonNullChunks.length === totalSegments && totalSegments > 0) {
      setScanning(false);
    }
    setProgressValue(totalSegments === 0 ? 0 : (nonNullChunks.length / totalSegments) * 100);
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
    setScanning(prev => !prev);
  }, [scanning, chunks.length]);

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

      {/* // A video component here to display the camera feed */}
      {
        <VideoFeed
          scanning={scanning}
          setChunks={setChunks}
          setTotalSegments={setTotalSegments}
          setMetadata={setMetadata}
          setMode={setMode}
        />
      }

      {/* // A button to request camera access */}
      <Button
        color="secondary"
        variant="ghost"
        size="lg"
        onClick={toggleScanning}
      // disabled={memoizedChunks.length !== totalSegments}
      >
        {scanning ? "Stop" : chunks.length > 0 ? "New Scan" : "Scan"}
      </Button>

      {/* // A button to download the scanned data as a file (only when all chunks are received, can be disabled initially, and can check whether all chunks are received or not) */}
      <DownloadButton
        chunks={memoizedChunks}
        totalSegments={totalSegments}
        metadata={metadata}
      />

      {/* // A text component to display the scanned text */}
      {mode === "utf-8" && <TextDisplay chunks={memoizedChunks} />}
    </div>
  );
}

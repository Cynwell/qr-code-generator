// app/receiver/page.tsx
"use client";
import { title } from "@/components/primitives";
import { useState, useMemo, useEffect } from "react";
import VideoFeed from "@/components/video-feed";
import DownloadButton from "@/components/download-button";
import TextDisplay from "@/components/text-display";
// import { button as buttonStyles } from "@nextui-org/theme";
import { Button } from "@nextui-org/button";
import { Divider } from "@nextui-org/divider";
import { Progress } from "@nextui-org/react";


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
  }, [memoizedChunks, totalSegments]);

  return (
    <div>
      <h1 className={title()}>I'm&nbsp;</h1>
      <h1 className={title({ color: "violet" })}>Receiver&nbsp;</h1>
      <Divider className="my-4" />

      <Progress
        aria-label="Downloading..."
        size="md"
        value={progressValue}
        color="success"
        showValueLabel={true}
        className="max-w-md"
      />

      {/* // A video component here to display the camera feed */}
      {/* TODO: Find a way to stop the camera, and should be controlled by the button and the status scanning */}
      {scanning && (
        <VideoFeed
          scanning={scanning}
          chunks={memoizedChunks}
          setChunks={setChunks}
          setTotalSegments={setTotalSegments}
          setMetadata={setMetadata}
          setMode={setMode}
          setProgressValue={setProgressValue}
        />
      )}

      {/* // A button to request camera access */}
      <Button
        color="secondary"
        variant="ghost"
        size="lg"
        onClick={() => setScanning(!scanning)}
        // disabled={memoizedChunks.length !== totalSegments}
      >
        {scanning ? "Stop Scanning" : "Start Scanning"}
      </Button>

      {/* // A button to download the scanned data as a file (only when all chunks are received, can be disabled initially, and can check whether all chunks are received or not) */}
      <DownloadButton
        chunks={memoizedChunks}
        totalSegments={totalSegments}
        metadata={metadata}
      />

      {/* // A text component to display the scanned text */}
      <TextDisplay chunks={memoizedChunks} />
    </div>
  );
}

// app/sender/page.tsx
"use client";
import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import FileUploader from "@/components/file-uploader";
import { Textarea } from "@heroui/input";
import { Slider } from "@heroui/slider";
import { Divider } from "@heroui/divider";
import { title } from "@/components/primitives";

// Import GenerateQRCode with dynamic and disable SSR
const GenerateQRCode = dynamic(() => import('@/utils/generate-qr-code'), { ssr: false });

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    timerRef.current = setTimeout(() => setDebounced(value), delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, delay]);
  return debounced;
}

export default function SenderPage() {
  const [input, setInput] = useState<string | File | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [chunkSize, setChunkSize] = useState<number>(1000);
  const [interval, setInterval] = useState<number>(1000);
  const [redundancy, setRedundancy] = useState<number>(1.5);

  const debouncedChunkSize = useDebouncedValue(chunkSize, 400);
  const debouncedRedundancy = useDebouncedValue(redundancy, 400);

  const handleFileUpload = useCallback((file: File) => {
    setInput(file);
    setShowQR(true);
  }, []);

  const handleTextInput = useCallback((text: string) => {
    setInput(text);
    setShowQR(true);
  }, []);

  // Determine if the FileUploader should be displayed
  const showFileUploader = !input || input instanceof File;

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      <div>
        <h1 className={title()}>I&apos;m&nbsp;</h1>
        <h1 className={title({ color: "blue" })}>Sender&nbsp;</h1>
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
        placeholder="Enter text here to generate QR code"
        minRows={4}
        maxRows={12}
        onChange={(e) => handleTextInput(e.target.value)}
      />

      <Divider />

      {/* Controls */}
      <div className="flex flex-col gap-6 px-2">
        <Slider
          label="Chunk Size (bytes)"
          step={100}
          maxValue={2800}
          minValue={100}
          defaultValue={1000}
          showSteps={true}
          color="primary"
          size="md"
          onChange={(value) => setChunkSize(value as number)}
          className="w-full"
        />
        <Slider
          label="Interval (ms)"
          step={100}
          maxValue={5000}
          minValue={100}
          defaultValue={1000}
          showSteps={true}
          color="secondary"
          size="md"
          onChange={(value) => setInterval(value as number)}
          className="w-full"
        />
        <Slider
          label="Redundancy"
          step={0.1}
          maxValue={3.0}
          minValue={1.0}
          defaultValue={1.5}
          showSteps={true}
          color="warning"
          size="md"
          onChange={(value) => setRedundancy(value as number)}
          className="w-full"
        />
      </div>

      {/* QR Code display */}
      {showQR && input && (
        <GenerateQRCode
          input={input}
          chunkSize={debouncedChunkSize}
          interval={interval}
          redundancy={debouncedRedundancy}
          onComplete={() => console.log("QR Codes generated")}
        />
      )}
    </div>
  );
}

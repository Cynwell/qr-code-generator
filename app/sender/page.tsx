// app/sender/page.tsx
"use client";
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { DarkTheme, BaseProvider } from 'baseui';
import FileUploader from "@/components/file-uploader";
import { Input } from "@nextui-org/input";
import { title } from "@/components/primitives";

// Import GenerateQRCode with dynamic and disable SSR
const GenerateQRCode = dynamic(() => import('@/utils/generate-qr-code'), { ssr: false });
// const engine = new Styletron();

export default function SenderPage() {
  {/* // It would require a state to store the uploaded file or the entered text (probably) */ }
  const [input, setInput] = useState<string | File | null>(null);
  const [showQR, setShowQR] = useState(false);

  const handleFileUpload = (file: File) => {
    setInput(file);
    setShowQR(true);
  };

  const handleTextInput = (text: string) => {
    setInput(text);
    setShowQR(true);
  };

  const DynamicStyletron = dynamic(
    () => Promise.all([
      import('styletron-engine-monolithic').then(mod => ({ Styletron: mod.Client })),
      import('styletron-react').then(mod => ({ StyletronProvider: mod.Provider }))
    ]).then(([styletron, provider]) => {
      const DynamicStyletronComponent = () => (
        <provider.StyletronProvider value={new styletron.Styletron()}>
          <BaseProvider theme={DarkTheme}>
            <FileUploader onFileUpload={handleFileUpload} />
          </BaseProvider>
        </provider.StyletronProvider>
      );
      DynamicStyletronComponent.displayName = 'DynamicStyletron';
      return DynamicStyletronComponent;
    }),
    { ssr: false }
  );

  return (
    <div>
      <h1 className={title()}>I&apos;m&nbsp;</h1>
      <h1 className={title({ color: "blue" })}>Sender&nbsp;</h1>

      {/* A Drag and Drop component here to upload a single file */}
      <DynamicStyletron />

      {/* A text input to manually enter a text to generate a QR code */}
      <Input
        placeholder="Enter text here"
        onChange={(e) => handleTextInput(e.target.value)}
      />

      {/* The generated QR code(s) should be displayed here, and the QR code(s) animations should repeat to display infinitely */}
      {showQR && input && (
        <GenerateQRCode input={input} onComplete={() => console.log("QR Codes generated")} />
      )}
    </div>
  );
}

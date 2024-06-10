// app/sender/page.tsx
"use client";
import { useState } from 'react';
import { Client as Styletron } from 'styletron-engine-monolithic';
import { Provider as StyletronProvider } from 'styletron-react';
import { DarkTheme, BaseProvider } from 'baseui';
import FileUploader from "@/components/file-uploader";
import GenerateQRCode from '@/utils/generate-qr-code';
import { Input } from "@nextui-org/input";
import { Button } from "@nextui-org/button"
import { title } from "@/components/primitives";

const engine = new Styletron();

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

  return (
    <div>
      <h1 className={title()}>I'm&nbsp;</h1>
      <h1 className={title({ color: "blue" })}>Sender&nbsp;</h1>

      {/* A Drag and Drop component here to upload a single file */}
      <StyletronProvider value={engine}>
        <BaseProvider theme={DarkTheme}>
          <FileUploader onFileUpload={handleFileUpload} />
        </BaseProvider>
      </StyletronProvider>

      {/* A text input to manually enter a text to generate a QR code */}
      <Input
        placeholder="Enter text here"
        onChange={(e) => handleTextInput(e.target.value)}
      />

      {/* // TODO: The generated QR code(s) should be displayed here, and the QR code(s) animations should repeat to display infinitely */}
      {showQR && input && (
        <GenerateQRCode input={input} onComplete={() => console.log("QR Codes generated")} />
      )}

      {/* // TODO: (Staled) Add a button to generate a QR code from the uploaded file or the entered text */}
    </div>
  );
}

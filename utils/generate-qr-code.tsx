// utils/generate-qr-code.tsx
import styles from '../styles/qrcode.module.css';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import QRCode from 'qrcode';

interface GenerateQRCodeProps {
  input: string | File;
  chunkSize?: number;
  interval?: number;
  onComplete: () => void;
}

const addHeader = (chunk: Uint8Array, index: number, total: number, mode: string): Uint8ClampedArray => {
  const header = new TextEncoder().encode(`${index + 1}|${total}|${mode}|`);
  // @ts-ignore
  const dataWithHeader = new Uint8Array([...header, ...chunk]);
  return new Uint8ClampedArray(dataWithHeader.buffer);
};

const escapeSpecialCharacters = (input: string): string => {
  const specialCharacters: { [key: string]: string } = {
    "|": "\\|"
  };
  return input.replace(/[|]/g, char => specialCharacters[char]);
};

const chunkArray = (array: Uint8Array, chunkSize: number): Uint8Array[] => {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

const GenerateQRCode: React.FC<GenerateQRCodeProps> = ({ input, chunkSize=500, interval=100, onComplete }) => {
  // Input: A filename
  // Output: A series of QR code images

  // Add your QR code generation logic here
  // Use FileReader() to read the file content

  // const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrCodes, setQRCodes] = useState<string[]>([]);
  const [currentQRIndex, setCurrentQRIndex] = useState(0);
  const qrCodeToShow = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const forceUpdate = useForceUpdate();


  // Generate QR codes when the input changes
  useEffect(() => {
    const generateQR = async (inputData: string | Uint8Array) => {
      const encodingMode = typeof inputData === 'string' ? 'utf-8' : 'binary';
      const buffer = encodingMode === 'utf-8' ? new TextEncoder().encode(escapeSpecialCharacters(inputData as string)) : new Uint8Array(inputData as ArrayBuffer);
      const chunks: Uint8ClampedArray[] = chunkArray(buffer, chunkSize).map((chunk, index, array) => addHeader(chunk, index, array.length, encodingMode));
      const generatedQRCodes: string[] = [];

      for (const chunk of chunks) {
        try {
          // @ts-ignore
          const qrCode = await QRCode.toDataURL([{ data: chunk, mode: 'byte' }, { errorCorrectionLevel: 'H' }]);
          // @ts-ignore
          generatedQRCodes.push(qrCode);
        } catch (err) {
          console.error(err);
        }
      }

      setQRCodes(generatedQRCodes);
      onComplete();
    };

    if (typeof input === 'string') {
      generateQR(input);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const data = new Uint8Array(event.target.result as ArrayBuffer);
          const metadata = {
            name: input.name,
            size: input.size,
            type: input.type,
            lastModified: input.lastModified,
          };
          const metadataArray = new TextEncoder().encode(JSON.stringify(metadata) + '|');
          // @ts-ignore
          const fileDataWithMetadata = new Uint8Array([...metadataArray, ...data]);
          generateQR(fileDataWithMetadata);
        }
      };
      reader.readAsArrayBuffer(input);
    }
  }, [input, onComplete]);

  useEffect(() => {
    if (qrCodes.length > 0) {
      qrCodeToShow.current = qrCodes[0];
      forceUpdate();
    }
  }, [qrCodes, forceUpdate]);

  // Set an interval to change the QR code every 2 seconds
  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set a new interval if there are QR codes
    if (qrCodes.length > 0) {
      let localIndex = 0;
      intervalRef.current = setInterval(() => {
        localIndex = (localIndex + 1) % qrCodes.length;
        qrCodeToShow.current = qrCodes[localIndex];
        // setCurrentQRIndex((prevIndex) => (prevIndex + 1) % qrCodes.length);
        forceUpdate();
      }, interval); // Change QR code every interval milliseconds
    }

    // Clear interval on component unmount or when qrCodes change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [qrCodes, forceUpdate]);

  return (
    <div>
      {/* Render your QR code here */}
      {/* It'll be a series of QR code images */}
      {/* {qrCodes.map((qrCode, index) => (
        <img key={index} src={qrCode} alt={`QR Code ${index + 1}`} />
      ))} */}
      {/* {qrCodes.length > 0 && (
        <img src={qrCodes[currentQRIndex]} alt={`QR Code ${currentQRIndex + 1}`} className={styles.centeredImage} />
      )} */}
      {qrCodeToShow.current && (
        <QRCodeImage src={qrCodeToShow.current} alt={`QR Code ${currentQRIndex + 1}/${qrCodes.length}`} />
      )}
    </div>
  );
};

const QRCodeImage: React.FC<{ src: string, alt: string }> = React.memo(({ src, alt }) => (
  <img src={src} alt={alt} className={styles.centeredImage} />
));

function useForceUpdate() {
  const [, setTick] = useState(0);
  const update = useCallback(() => {
    setTick(tick => tick + 1);
  }, []);
  return update;
}

export default GenerateQRCode;
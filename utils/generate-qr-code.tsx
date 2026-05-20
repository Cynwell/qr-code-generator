// utils/generate-qr-code.tsx
import styles from '../styles/qrcode.module.css';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@heroui/button';
import { Input } from '@heroui/input';
import QRCode from 'qrcode';
import { splitIntoBlocks, encodeSymbol } from './fountain';

interface GenerateQRCodeProps {
  input: string | File;
  chunkSize?: number;
  interval?: number;
  redundancy?: number;
  onComplete: () => void;
}

const escapeSpecialCharacters = (input: string): string => {
  const specialCharacters: { [key: string]: string } = {
    "|": "\\|"
  };
  return input.replace(/[|]/g, char => specialCharacters[char]);
};

const getInputBuffer = (input: string | File): Promise<{ buffer: Uint8Array; encodingMode: string }> => {
  if (typeof input === 'string') {
    return Promise.resolve({
      buffer: new TextEncoder().encode(escapeSpecialCharacters(input)),
      encodingMode: 'utf-8',
    });
  }
  return new Promise((resolve, reject) => {
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
        resolve({ buffer: fileDataWithMetadata, encodingMode: 'binary' });
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(input);
  });
};

const buildFountainHeader = (symbolId: number, K: number, blockSize: number, origLen: number, mode: string): Uint8Array => {
  return new TextEncoder().encode(`F|${symbolId}|${K}|${blockSize}|${origLen}|${mode}|`);
};

const GenerateQRCode: React.FC<GenerateQRCodeProps> = ({ input, chunkSize = 500, interval = 100, redundancy = 1.5, onComplete }) => {
  const [qrCodes, setQRCodes] = useState<string[]>([]);
  const [sourceBlockCount, setSourceBlockCount] = useState(0);
  const qrCodeToShow = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const localIndexRef = useRef(0);
  const generationIdRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [manualIndex, setManualIndex] = useState('');
  const forceUpdate = useForceUpdate();

  // Generate fountain-coded QR codes when input or chunkSize changes
  useEffect(() => {
    const currentGenId = ++generationIdRef.current;

    const generateQR = async () => {
      try {
        const { buffer, encodingMode } = await getInputBuffer(input);
        const sourceBlocks = splitIntoBlocks(buffer, chunkSize);
        const K = sourceBlocks.length;
        const blockSize = sourceBlocks[0].length;
        const origLen = buffer.length;
        const N = Math.max(K, Math.ceil(K * redundancy));

        setSourceBlockCount(K);

        const generatedQRCodes: string[] = [];
        for (let symbolId = 0; symbolId < N; symbolId++) {
          if (currentGenId !== generationIdRef.current) return;

          const encodedData = encodeSymbol(sourceBlocks, symbolId);
          const header = buildFountainHeader(symbolId, K, blockSize, origLen, encodingMode);
          const combined = new Uint8Array(header.length + encodedData.length);
          combined.set(header);
          combined.set(encodedData, header.length);

          try {
            const qrCode = await QRCode.toDataURL(
              // @ts-ignore
              [{ data: new Uint8ClampedArray(combined.buffer, combined.byteOffset, combined.byteLength), mode: 'byte' }],
              { errorCorrectionLevel: 'H' }
            );
            generatedQRCodes.push(qrCode);
          } catch (err) {
            console.error('QR code generation error for symbol', symbolId, err);
          }

          if (generatedQRCodes.length % 10 === 0) {
            await new Promise((r) => setTimeout(r, 0));
          }
        }

        if (currentGenId !== generationIdRef.current) return;
        setQRCodes(generatedQRCodes);
        onComplete();
      } catch (err) {
        console.error('QR generation error:', err);
      }
    };

    generateQR();
  }, [input, chunkSize, redundancy, onComplete]);

  // Show first QR code when codes change
  useEffect(() => {
    if (qrCodes.length > 0) {
      localIndexRef.current = 0;
      qrCodeToShow.current = qrCodes[0];
      setPaused(false);
      forceUpdate();
    }
  }, [qrCodes, forceUpdate]);

  // Carousel: auto-advance unless paused
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (qrCodes.length > 0 && !paused) {
      intervalRef.current = setInterval(() => {
        localIndexRef.current = (localIndexRef.current + 1) % qrCodes.length;
        qrCodeToShow.current = qrCodes[localIndexRef.current];
        forceUpdate();
      }, interval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [qrCodes, interval, paused, forceUpdate]);

  const goToFragment = useCallback((index: number) => {
    if (qrCodes.length === 0) return;
    const clamped = Math.max(0, Math.min(index, qrCodes.length - 1));
    localIndexRef.current = clamped;
    qrCodeToShow.current = qrCodes[clamped];
    forceUpdate();
  }, [qrCodes, forceUpdate]);

  const handlePrev = useCallback(() => {
    goToFragment((localIndexRef.current - 1 + qrCodes.length) % qrCodes.length);
  }, [goToFragment, qrCodes.length]);

  const handleNext = useCallback(() => {
    goToFragment((localIndexRef.current + 1) % qrCodes.length);
  }, [goToFragment, qrCodes.length]);

  const handleManualJump = useCallback(() => {
    const idx = parseInt(manualIndex, 10);
    if (!isNaN(idx) && idx >= 1 && idx <= qrCodes.length) {
      goToFragment(idx - 1);
    }
  }, [manualIndex, qrCodes.length, goToFragment]);

  if (qrCodes.length === 0) return null;

  const totalSymbols = qrCodes.length;
  const extraSymbols = totalSymbols - sourceBlockCount;

  return (
    <div className="mt-6 flex flex-col gap-3">
      {qrCodeToShow.current && (
        <QRCodeImage
          src={qrCodeToShow.current}
          alt={`Symbol ${localIndexRef.current + 1}/${totalSymbols}`}
        />
      )}

      {/* Fragment info */}
      <p className="text-center text-sm text-default-500">
        Symbol {localIndexRef.current + 1} / {totalSymbols}
        {extraSymbols > 0 && (
          <span className="text-default-400"> ({sourceBlockCount} source + {extraSymbols} redundancy)</span>
        )}
      </p>

      {/* Playback controls */}
      <div className="flex justify-center items-center gap-2 flex-wrap">
        <Button size="sm" variant="flat" onPress={handlePrev}>◀ Prev</Button>
        <Button
          size="sm"
          variant={paused ? "solid" : "flat"}
          color={paused ? "success" : "default"}
          onPress={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Play" : "⏸ Pause"}
        </Button>
        <Button size="sm" variant="flat" onPress={handleNext}>Next ▶</Button>
      </div>

      {/* Jump to fragment */}
      <div className="flex justify-center items-center gap-2">
        <Input
          size="sm"
          type="number"
          placeholder={`1–${totalSymbols}`}
          value={manualIndex}
          onChange={(e) => setManualIndex(e.target.value)}
          className="w-24"
          aria-label="Fragment number"
        />
        <Button size="sm" variant="flat" color="primary" onPress={handleManualJump}>
          Go
        </Button>
      </div>
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

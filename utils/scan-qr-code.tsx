// utils/scan-qr-code.tsx
import jsQR from "jsqr";

export interface SequentialResult {
  type: 'sequential';
  index: string;
  total: string;
  mode: string;
  metadata: any;
  decodedData: Uint8Array | string;
}

export interface FountainResult {
  type: 'fountain';
  symbolId: number;
  K: number;
  blockSize: number;
  origLen: number;
  mode: string;
  data: Uint8Array;
}

export type DecodeResult = SequentialResult | FountainResult | null;

export const decodeQR = (imageData: ImageData): DecodeResult => {
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  if (!code) return null;

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const binaryData = new Uint8Array(code.binaryData);
  const decodedString = decoder.decode(binaryData);

  // Detect fountain-coded format: starts with "F|"
  if (decodedString.startsWith("F|")) {
    const parts = decodedString.split("|");
    // F|symbolId|K|blockSize|origLen|mode|...data
    if (parts.length < 7) return null;

    const symbolId = parseInt(parts[1], 10);
    const K = parseInt(parts[2], 10);
    const blockSize = parseInt(parts[3], 10);
    const origLen = parseInt(parts[4], 10);
    const mode = parts[5];

    // Calculate header byte length to extract binary payload
    const headerStr = `F|${parts[1]}|${parts[2]}|${parts[3]}|${parts[4]}|${parts[5]}|`;
    const headerLen = encoder.encode(headerStr).byteLength;
    const data = binaryData.slice(headerLen);

    return { type: 'fountain', symbolId, K, blockSize, origLen, mode, data };
  }

  // Legacy sequential format: index|total|mode|data
  const parts = decodedString.split("|");
  const [index, total, mode, ...dataParts] = parts;

  if (mode === "binary") {
    if (parseInt(index) === 1) {
      const metadata = JSON.parse(dataParts[0]);
      const headerAndMetadataLength = encoder.encode(`${index + 1}|${total}|${mode}|` + dataParts[0]).byteLength;
      const data = binaryData.slice(headerAndMetadataLength);
      return { type: 'sequential', index, total, mode, metadata, decodedData: data };
    } else {
      const headerAndMetadataLength = encoder.encode(`${index + 1}|${total}|${mode}`).byteLength;
      const data = binaryData.slice(headerAndMetadataLength);
      return { type: 'sequential', index, total, mode, metadata: null, decodedData: data };
    }
  } else if (mode === "utf-8") {
    const data = dataParts.join("|");
    return { type: 'sequential', index, total, mode, metadata: "", decodedData: data };
  }

  return null;
};
// Frame type constants and protocol definitions

export const FRAME_MAGIC = 0x5154; // "QT"
export const PROTOCOL_VERSION = 1;
export const HEADER_LENGTH = 32; // Fixed binary header size in bytes

export enum FrameType {
  Manifest = 1,
  Source = 2,
  Repair = 3,
  Calibration = 4,
}

export type CompressionMode = 'none' | 'gzip' | 'deflate';
export type FecScheme = 'systematic-lt-v1';
export type QrEccLevel = 'L' | 'M' | 'Q' | 'H';

/**
 * Fixed binary header layout (32 bytes, big-endian):
 * 
 *  Offset | Size | Field
 *  -------|------|------
 *     0   |   2  | magic (0x5154)
 *     2   |   1  | version
 *     3   |   1  | headerLength
 *     4   |   1  | frameType
 *     5   |   1  | flags (reserved)
 *     6   |   2  | (reserved/padding)
 *     8   |   4  | sessionId
 *    12   |   4  | symbolId
 *    16   |   4  | sourceBlockCount (K)
 *    20   |   2  | blockSize
 *    22   |   2  | payloadLength
 *    24   |   4  | headerCrc32c
 *    28   |   4  | payloadCrc32c
 */

export interface FrameHeader {
  magic: number;
  version: number;
  headerLength: number;
  frameType: FrameType;
  flags: number;
  sessionId: number;
  symbolId: number;
  sourceBlockCount: number;
  blockSize: number;
  payloadLength: number;
  headerCrc32c: number;
  payloadCrc32c: number;
}

export interface ParsedFrame {
  header: FrameHeader;
  payload: Uint8Array;
}

/**
 * Manifest payload layout (variable length, big-endian):
 * 
 *  Offset | Size   | Field
 *  -------|--------|------
 *     0   |   4    | originalLength (uint32)
 *     4   |   4    | compressedLength (uint32)
 *     8   |   1    | compression (0=none, 1=gzip, 2=deflate)
 *     9   |   1    | fecScheme (1=systematic-lt-v1)
 *    10   |   4    | fecSeed (uint32)
 *    14   |   1    | qrEccLevel (0=L, 1=M, 2=Q, 3=H)
 *    15   |   1    | mode (0=text, 1=binary)
 *    16   |  32    | objectHash (SHA-256)
 *    48   |   2    | fileNameLength
 *    50   |   N    | fileName (UTF-8)
 *   50+N  |   2    | mimeTypeLength
 *  52+N   |   M    | mimeType (UTF-8)
 */

export interface ManifestData {
  originalLength: number;
  compressedLength: number;
  compression: CompressionMode;
  fecScheme: FecScheme;
  fecSeed: number;
  qrEccLevel: QrEccLevel;
  mode: 'text' | 'binary';
  objectHash: Uint8Array; // 32 bytes SHA-256
  fileName: string;
  mimeType: string;
}

const COMPRESSION_MAP: CompressionMode[] = ['none', 'gzip', 'deflate'];
const FEC_SCHEME_MAP: FecScheme[] = ['systematic-lt-v1'];
const QR_ECC_MAP: QrEccLevel[] = ['L', 'M', 'Q', 'H'];
const MODE_MAP: ('text' | 'binary')[] = ['text', 'binary'];

export function encodeManifest(manifest: ManifestData): Uint8Array {
  const encoder = new TextEncoder();
  const fileNameBytes = encoder.encode(manifest.fileName);
  const mimeTypeBytes = encoder.encode(manifest.mimeType);

  const size = 48 + 2 + fileNameBytes.length + 2 + mimeTypeBytes.length;
  const buf = new Uint8Array(size);
  const view = new DataView(buf.buffer);

  view.setUint32(0, manifest.originalLength, false);
  view.setUint32(4, manifest.compressedLength, false);
  buf[8] = Math.max(0, COMPRESSION_MAP.indexOf(manifest.compression));
  buf[9] = Math.max(0, FEC_SCHEME_MAP.indexOf(manifest.fecScheme));
  view.setUint32(10, manifest.fecSeed, false);
  buf[14] = Math.max(0, QR_ECC_MAP.indexOf(manifest.qrEccLevel));
  buf[15] = Math.max(0, MODE_MAP.indexOf(manifest.mode));
  buf.set(manifest.objectHash.subarray(0, 32), 16);
  view.setUint16(48, fileNameBytes.length, false);
  buf.set(fileNameBytes, 50);
  view.setUint16(50 + fileNameBytes.length, mimeTypeBytes.length, false);
  buf.set(mimeTypeBytes, 52 + fileNameBytes.length);

  return buf;
}

export function decodeManifest(data: Uint8Array): ManifestData | null {
  if (data.length < 52) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const decoder = new TextDecoder();

  const originalLength = view.getUint32(0, false);
  const compressedLength = view.getUint32(4, false);
  const compression = COMPRESSION_MAP[data[8]] || 'none';
  const fecScheme = FEC_SCHEME_MAP[data[9]] || 'systematic-lt-v1';
  const fecSeed = view.getUint32(10, false);
  const qrEccLevel = QR_ECC_MAP[data[14]] || 'M';
  const mode = MODE_MAP[data[15]] || 'text';
  const objectHash = data.slice(16, 48);

  const fileNameLength = view.getUint16(48, false);
  if (data.length < 52 + fileNameLength) return null;
  const fileName = decoder.decode(data.subarray(50, 50 + fileNameLength));

  const mimeTypeOffset = 50 + fileNameLength;
  if (data.length < mimeTypeOffset + 2) return null;
  const mimeTypeLength = view.getUint16(mimeTypeOffset, false);
  if (data.length < mimeTypeOffset + 2 + mimeTypeLength) return null;
  const mimeType = decoder.decode(data.subarray(mimeTypeOffset + 2, mimeTypeOffset + 2 + mimeTypeLength));

  return {
    originalLength, compressedLength, compression, fecScheme,
    fecSeed, qrEccLevel, mode, objectHash, fileName, mimeType,
  };
}

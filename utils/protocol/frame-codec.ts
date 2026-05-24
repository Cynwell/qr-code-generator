// Binary frame encoder/decoder

import { crc32c } from './crc32c';
import {
  FRAME_MAGIC, PROTOCOL_VERSION, HEADER_LENGTH,
  FrameType, FrameHeader, ParsedFrame,
} from './frame-types';

/**
 * Encode a frame into a binary Uint8Array.
 * Header is 32 bytes with CRC32C protecting both header and payload.
 */
export function encodeFrame(
  frameType: FrameType,
  sessionId: number,
  symbolId: number,
  sourceBlockCount: number,
  blockSize: number,
  payload: Uint8Array,
  flags = 0,
): Uint8Array {
  const totalLen = HEADER_LENGTH + payload.length;
  const buf = new Uint8Array(totalLen);
  const view = new DataView(buf.buffer);

  // Write header fields (big-endian)
  view.setUint16(0, FRAME_MAGIC, false);
  buf[2] = PROTOCOL_VERSION;
  buf[3] = HEADER_LENGTH;
  buf[4] = frameType;
  buf[5] = flags;
  view.setUint16(6, 0, false); // reserved
  view.setUint32(8, sessionId, false);
  view.setUint32(12, symbolId, false);
  view.setUint32(16, sourceBlockCount, false);
  view.setUint16(20, blockSize, false);
  view.setUint16(22, payload.length, false);

  // Compute payload CRC
  const payloadCrc = crc32c(payload);
  view.setUint32(28, payloadCrc, false);

  // Compute header CRC (over bytes 0-23, with headerCrc field zeroed)
  view.setUint32(24, 0, false); // zero headerCrc field before computing
  const headerCrc = crc32c(buf.subarray(0, HEADER_LENGTH));
  view.setUint32(24, headerCrc, false);

  // Write payload
  buf.set(payload, HEADER_LENGTH);

  return buf;
}

/**
 * Parse a binary frame. Returns null for malformed/corrupted frames.
 */
export function parseFrame(data: Uint8Array): ParsedFrame | null {
  if (data.length < HEADER_LENGTH) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // Check magic
  const magic = view.getUint16(0, false);
  if (magic !== FRAME_MAGIC) return null;

  // Check version
  const version = view.getUint8(2);
  if (version !== PROTOCOL_VERSION) return null;

  // Read header length
  const headerLength = view.getUint8(3);
  if (headerLength > data.length) return null;

  // Read payload length
  const payloadLength = view.getUint16(22, false);
  if (headerLength + payloadLength > data.length) return null;

  // Validate header CRC
  const storedHeaderCrc = view.getUint32(24, false);
  // Zero out the headerCrc field for validation
  const headerCopy = new Uint8Array(headerLength);
  headerCopy.set(data.subarray(0, headerLength));
  const hv = new DataView(headerCopy.buffer);
  hv.setUint32(24, 0, false);
  const computedHeaderCrc = crc32c(headerCopy);
  if (storedHeaderCrc !== computedHeaderCrc) return null;

  // Extract payload
  const payload = data.subarray(headerLength, headerLength + payloadLength);

  // Validate payload CRC
  const storedPayloadCrc = view.getUint32(28, false);
  const computedPayloadCrc = crc32c(payload);
  if (storedPayloadCrc !== computedPayloadCrc) return null;

  const header: FrameHeader = {
    magic,
    version,
    headerLength,
    frameType: view.getUint8(4) as FrameType,
    flags: view.getUint8(5),
    sessionId: view.getUint32(8, false),
    symbolId: view.getUint32(12, false),
    sourceBlockCount: view.getUint32(16, false),
    blockSize: view.getUint16(20, false),
    payloadLength,
    headerCrc32c: storedHeaderCrc,
    payloadCrc32c: storedPayloadCrc,
  };

  return { header, payload: new Uint8Array(payload) };
}

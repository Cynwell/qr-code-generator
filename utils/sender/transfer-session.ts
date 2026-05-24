// Transfer session builder and symbol generator

import { SystematicLtEncoder, splitIntoBlocks } from '../fec';
import {
  FrameType, encodeFrame, encodeManifest,
  type ManifestData, type CompressionMode, type QrEccLevel,
} from '../protocol';
import { sha256 } from '../protocol/hash';
import { compressData, shouldCompress } from './compression';

export type TransferMode = 'text' | 'binary';

export interface TransferSessionConfig {
  blockSize: number;
  qrEccLevel: QrEccLevel;
  compression: CompressionMode | 'auto';
  manifestRepeatInterval: number; // emit manifest every N frames
}

export const DEFAULT_CONFIG: TransferSessionConfig = {
  blockSize: 122,
  qrEccLevel: 'L',
  compression: 'auto',
  manifestRepeatInterval: 20,
};

// QR byte-mode capacity per version 40 (max)
const QR_CAPACITY: Record<QrEccLevel, number> = {
  L: 2953,
  M: 2331,
  Q: 1663,
  H: 1273,
};

export function getMaxPayload(eccLevel: QrEccLevel, headerSize: number): number {
  return QR_CAPACITY[eccLevel] - headerSize;
}

export interface TransferSession {
  sessionId: number;
  manifest: ManifestData;
  encoder: SystematicLtEncoder;
  fecSeed: number;
  K: number;
  blockSize: number;
  config: TransferSessionConfig;

  // Pre-encoded manifest frame bytes
  manifestFrame: Uint8Array;
}

/**
 * Build a transfer session from input data.
 */
export async function buildTransferSession(
  inputData: Uint8Array,
  mode: TransferMode,
  fileName: string,
  mimeType: string,
  config: TransferSessionConfig,
): Promise<TransferSession> {
  const sessionId = (Math.random() * 0xFFFFFFFF) >>> 0;
  const fecSeed = (Math.random() * 0xFFFFFFFF) >>> 0;
  const originalLength = inputData.length;

  // Compression
  let compression: CompressionMode = 'none';
  let compressedData = inputData;

  if (config.compression === 'auto') {
    if (mode === 'text' || shouldCompress(fileName)) {
      compression = 'gzip';
    }
  } else {
    compression = config.compression;
  }

  if (compression !== 'none') {
    try {
      compressedData = await compressData(inputData, compression);
      // Only use compression if it actually reduces size
      if (compressedData.length >= inputData.length) {
        compressedData = inputData;
        compression = 'none';
      }
    } catch {
      compressedData = inputData;
      compression = 'none';
    }
  }

  const compressedLength = compressedData.length;

  // Hash the original data
  const objectHash = await sha256(inputData);

  // Split into source blocks
  const sourceBlocks = splitIntoBlocks(compressedData, config.blockSize);
  const K = sourceBlocks.length;
  const blockSize = sourceBlocks[0]?.length ?? config.blockSize;

  // Create encoder
  const encoder = new SystematicLtEncoder(sourceBlocks, fecSeed);

  // Build manifest
  const manifest: ManifestData = {
    originalLength,
    compressedLength,
    compression,
    fecScheme: 'systematic-lt-v1',
    fecSeed,
    qrEccLevel: config.qrEccLevel,
    mode,
    objectHash,
    fileName,
    mimeType,
  };

  // Pre-encode manifest frame
  const manifestPayload = encodeManifest(manifest);
  const manifestFrame = encodeFrame(
    FrameType.Manifest, sessionId, 0, K, blockSize, manifestPayload,
  );

  return {
    sessionId, manifest, encoder, fecSeed, K, blockSize, config,
    manifestFrame,
  };
}

/**
 * Infinite symbol generator. Yields frames in order:
 * - Manifest (periodically)
 * - Source symbols 0..K-1
 * - Repair symbols K, K+1, K+2, ... (infinite)
 */
export class SymbolGenerator {
  private session: TransferSession;
  private frameIndex = 0;
  private symbolId = 0;
  private sourcePhase = true;

  constructor(session: TransferSession) {
    this.session = session;
  }

  reset(): void {
    this.frameIndex = 0;
    this.symbolId = 0;
    this.sourcePhase = true;
  }

  /**
   * Generate the next frame as a binary Uint8Array ready for QR encoding.
   */
  next(): { frame: Uint8Array; frameType: FrameType; symbolId: number } {
    const { session } = this;
    const { sessionId, K, blockSize, config } = session;

    // Emit manifest periodically
    if (this.frameIndex % config.manifestRepeatInterval === 0) {
      this.frameIndex++;
      return {
        frame: session.manifestFrame,
        frameType: FrameType.Manifest,
        symbolId: -1,
      };
    }

    this.frameIndex++;

    if (this.sourcePhase && this.symbolId < K) {
      // Source symbol
      const symId = this.symbolId++;
      const payload = session.encoder.getSourceSymbol(symId);
      const frame = encodeFrame(
        FrameType.Source, sessionId, symId, K, blockSize, payload,
      );
      if (this.symbolId >= K) {
        this.sourcePhase = false;
      }
      return { frame, frameType: FrameType.Source, symbolId: symId };
    }

    // Repair symbol (infinite)
    const repairId = this.symbolId++;
    const payload = session.encoder.getRepairSymbol(repairId);
    const frame = encodeFrame(
      FrameType.Repair, sessionId, repairId, K, blockSize, payload,
    );
    return { frame, frameType: FrameType.Repair, symbolId: repairId };
  }

  getFrameIndex(): number {
    return this.frameIndex;
  }
}

// Receiver session - manages frame ingestion and FEC decode

import { parseFrame, type ParsedFrame, FrameType, decodeManifest, type ManifestData } from '../protocol';
import { SystematicLtDecoder } from '../fec';
import { sha256 } from '../protocol/hash';
import { decompressData } from '../sender/compression';

export type ReceiverState =
  | 'idle'
  | 'scanning-no-session'
  | 'session-detected'
  | 'receiving'
  | 'reconstructing'
  | 'verifying-hash'
  | 'complete'
  | 'hash-mismatch'
  | 'failed';

export interface ReceiverStats {
  scannerBackend: string;
  scanMode: 'full-frame' | 'roi' | 'multi-qr';
  videoFramesObserved: number;
  scanAttempts: number;
  successfulQrDecodes: number;
  malformedFrames: number;
  crcFailures: number;
  wrongSessionFrames: number;
  duplicateFrames: number;
  uniqueFrames: number;
  sourceFrames: number;
  repairFrames: number;
  manifestFrames: number;
  recoveredBlocks: number;
  sourceBlockCount: number;
  pendingRepairSymbols: number;
  firstFrameTimestamp: number | null;
  completionTimestamp: number | null;
  effectivePayloadBytesPerSecond: number | null;
}

export function createInitialStats(): ReceiverStats {
  return {
    scannerBackend: 'jsqr',
    scanMode: 'full-frame',
    videoFramesObserved: 0,
    scanAttempts: 0,
    successfulQrDecodes: 0,
    malformedFrames: 0,
    crcFailures: 0,
    wrongSessionFrames: 0,
    duplicateFrames: 0,
    uniqueFrames: 0,
    sourceFrames: 0,
    repairFrames: 0,
    manifestFrames: 0,
    recoveredBlocks: 0,
    sourceBlockCount: 0,
    pendingRepairSymbols: 0,
    firstFrameTimestamp: null,
    completionTimestamp: null,
    effectivePayloadBytesPerSecond: null,
  };
}

export interface FrameProcessResult {
  newlyRecovered: number[];
  isComplete: boolean;
  manifestReceived: boolean;
  state: ReceiverState;
}

export class ReceiverSession {
  state: ReceiverState = 'scanning-no-session';
  manifest: ManifestData | null = null;
  sessionId: number | null = null;
  decoder: SystematicLtDecoder | null = null;
  stats: ReceiverStats;
  private hashVerified = false;
  private recoveredData: Uint8Array | null = null;

  constructor() {
    this.stats = createInitialStats();
  }

  /**
   * Process a raw QR binary payload. Returns frame processing result.
   */
  processRawPayload(binaryData: Uint8Array): FrameProcessResult {
    this.stats.scanAttempts++;

    // Try to parse as binary frame
    const frame = parseFrame(binaryData);

    if (!frame) {
      // Maybe a legacy frame - try legacy parsing
      const legacyResult = this.tryLegacyParse(binaryData);
      if (legacyResult) return legacyResult;

      this.stats.malformedFrames++;
      return { newlyRecovered: [], isComplete: false, manifestReceived: false, state: this.state };
    }

    this.stats.successfulQrDecodes++;

    if (this.stats.firstFrameTimestamp === null) {
      this.stats.firstFrameTimestamp = Date.now();
    }

    // Session matching
    if (this.sessionId !== null && frame.header.sessionId !== this.sessionId) {
      this.stats.wrongSessionFrames++;
      return { newlyRecovered: [], isComplete: false, manifestReceived: false, state: this.state };
    }

    switch (frame.header.frameType) {
      case FrameType.Manifest:
        return this.handleManifest(frame);
      case FrameType.Source:
        return this.handleSource(frame);
      case FrameType.Repair:
        return this.handleRepair(frame);
      default:
        return { newlyRecovered: [], isComplete: false, manifestReceived: false, state: this.state };
    }
  }

  private handleManifest(frame: ParsedFrame): FrameProcessResult {
    this.stats.manifestFrames++;

    if (this.manifest !== null) {
      // Already have manifest - don't re-report as new
      return { newlyRecovered: [], isComplete: this.isComplete(), manifestReceived: false, state: this.state };
    }

    const manifest = decodeManifest(frame.payload);
    if (!manifest) {
      this.stats.malformedFrames++;
      return { newlyRecovered: [], isComplete: false, manifestReceived: false, state: this.state };
    }

    this.manifest = manifest;
    this.sessionId = frame.header.sessionId;
    this.state = 'session-detected';

    // Initialize decoder
    const K = frame.header.sourceBlockCount;
    const blockSize = frame.header.blockSize;
    this.decoder = new SystematicLtDecoder(K, blockSize, manifest.fecSeed);
    this.stats.sourceBlockCount = K;

    this.state = 'receiving';
    return { newlyRecovered: [], isComplete: false, manifestReceived: true, state: this.state };
  }

  private handleSource(frame: ParsedFrame): FrameProcessResult {
    this.stats.sourceFrames++;

    // If no session yet, initialize from frame header alone
    if (!this.decoder) {
      this.initDecoderFromHeader(frame);
    }

    if (!this.decoder) {
      return { newlyRecovered: [], isComplete: false, manifestReceived: false, state: this.state };
    }

    const { newlyRecovered, isComplete } = this.decoder.addSourceSymbol(
      frame.header.symbolId, frame.payload,
    );

    if (newlyRecovered.length === 0) {
      this.stats.duplicateFrames++;
    } else {
      this.stats.uniqueFrames++;
      this.stats.recoveredBlocks = this.decoder.getRecoveredCount();
      this.stats.pendingRepairSymbols = this.decoder.getPendingCount();
    }

    if (isComplete) {
      this.state = 'reconstructing';
    }

    return { newlyRecovered, isComplete, manifestReceived: false, state: this.state };
  }

  private handleRepair(frame: ParsedFrame): FrameProcessResult {
    this.stats.repairFrames++;

    if (!this.decoder) {
      this.initDecoderFromHeader(frame);
    }

    if (!this.decoder) {
      return { newlyRecovered: [], isComplete: false, manifestReceived: false, state: this.state };
    }

    const { newlyRecovered, isComplete } = this.decoder.addRepairSymbol(
      frame.header.symbolId, frame.payload,
    );

    if (newlyRecovered.length === 0) {
      this.stats.duplicateFrames++;
    } else {
      this.stats.uniqueFrames++;
      this.stats.recoveredBlocks = this.decoder.getRecoveredCount();
      this.stats.pendingRepairSymbols = this.decoder.getPendingCount();
    }

    if (isComplete) {
      this.state = 'reconstructing';
    }

    return { newlyRecovered, isComplete, manifestReceived: false, state: this.state };
  }

  private initDecoderFromHeader(frame: ParsedFrame): void {
    // We can initialize a decoder from the frame header even without a manifest.
    // We just won't have compression/hash info until manifest arrives.
    const K = frame.header.sourceBlockCount;
    const blockSize = frame.header.blockSize;

    // Without manifest, we don't know fecSeed. We need the manifest.
    // For now, skip initialization if no manifest.
    if (!this.manifest) return;

    this.sessionId = frame.header.sessionId;
    this.decoder = new SystematicLtDecoder(K, blockSize, this.manifest.fecSeed);
    this.stats.sourceBlockCount = K;
    this.state = 'receiving';
  }

  /**
   * Try legacy text-based format parsing.
   */
  private tryLegacyParse(binaryData: Uint8Array): FrameProcessResult | null {
    try {
      const text = new TextDecoder().decode(binaryData);
      if (text.startsWith('F|')) {
        // Legacy fountain format
        const parts = text.split('|');
        if (parts.length < 7) return null;

        const symbolId = parseInt(parts[1], 10);
        const K = parseInt(parts[2], 10);
        const blockSize = parseInt(parts[3], 10);
        const origLen = parseInt(parts[4], 10);
        const mode = parts[5];

        // Extract binary payload
        const headerStr = `F|${parts[1]}|${parts[2]}|${parts[3]}|${parts[4]}|${parts[5]}|`;
        const headerLen = new TextEncoder().encode(headerStr).byteLength;
        const data = binaryData.slice(headerLen);

        // Initialize decoder if needed (legacy mode: use symbolId as seed for determinism)
        if (!this.decoder) {
          // Legacy decoder uses the old fountain.ts approach
          // For compatibility, we create a decoder with fecSeed=0 (old behavior used symbolId directly)
          this.decoder = new SystematicLtDecoder(K, blockSize, 0);
          this.sessionId = 0;
          this.stats.sourceBlockCount = K;
          this.state = 'receiving';

          // Create minimal manifest
          this.manifest = {
            originalLength: origLen,
            compressedLength: origLen,
            compression: 'none',
            fecScheme: 'systematic-lt-v1',
            fecSeed: 0,
            qrEccLevel: 'H',
            mode: mode === 'binary' ? 'binary' : 'text',
            objectHash: new Uint8Array(32),
            fileName: '',
            mimeType: mode === 'binary' ? 'application/octet-stream' : 'text/plain',
          };
        }

        // Legacy symbols are all repair-like (non-systematic)
        // Feed them as repair symbols
        const { newlyRecovered, isComplete } = this.decoder.addRepairSymbol(symbolId, data);

        if (newlyRecovered.length > 0) {
          this.stats.uniqueFrames++;
          this.stats.recoveredBlocks = this.decoder.getRecoveredCount();
        } else {
          this.stats.duplicateFrames++;
        }

        if (isComplete) this.state = 'reconstructing';

        return {
          newlyRecovered,
          isComplete,
          manifestReceived: false,
          state: this.state,
        };
      }
    } catch {
      // Not a legacy frame
    }
    return null;
  }

  isComplete(): boolean {
    return this.decoder?.isComplete() ?? false;
  }

  getRecoveredFlags(): boolean[] {
    return this.decoder?.getRecoveredFlags() ?? [];
  }

  getRecoveredBlock(index: number): Uint8Array | null {
    return this.decoder?.getRecoveredBlock(index) ?? null;
  }

  /**
   * Reconstruct the final data, decompress, and verify hash.
   */
  async reconstructAndVerify(): Promise<{
    data: Uint8Array | null;
    hashMatch: boolean;
    mode: 'text' | 'binary';
    fileName: string;
    mimeType: string;
  }> {
    if (!this.decoder || !this.manifest) {
      return { data: null, hashMatch: false, mode: 'text', fileName: '', mimeType: '' };
    }

    this.state = 'reconstructing';

    // Get compressed data
    const compressedData = this.decoder.getRecoveredData(this.manifest.compressedLength);
    if (!compressedData) {
      this.state = 'failed';
      return { data: null, hashMatch: false, mode: this.manifest.mode, fileName: this.manifest.fileName, mimeType: this.manifest.mimeType };
    }

    // Decompress
    let originalData: Uint8Array;
    try {
      originalData = await decompressData(compressedData, this.manifest.compression);
    } catch {
      // Decompression failed - try using raw data
      originalData = compressedData;
    }

    // Trim to original length
    if (originalData.length > this.manifest.originalLength) {
      originalData = originalData.subarray(0, this.manifest.originalLength);
    }

    this.recoveredData = originalData;

    // Verify hash (skip for legacy frames with zero hash)
    this.state = 'verifying-hash';
    const isLegacy = this.manifest.objectHash.every(b => b === 0);
    let hashMatch = true;

    if (!isLegacy) {
      const computedHash = await sha256(originalData);
      hashMatch = computedHash.length === this.manifest.objectHash.length &&
        computedHash.every((b, i) => b === this.manifest!.objectHash[i]);
    }

    if (hashMatch) {
      this.hashVerified = true;
      this.state = 'complete';
      this.stats.completionTimestamp = Date.now();

      if (this.stats.firstFrameTimestamp) {
        const elapsed = (this.stats.completionTimestamp - this.stats.firstFrameTimestamp) / 1000;
        this.stats.effectivePayloadBytesPerSecond = elapsed > 0
          ? this.manifest.originalLength / elapsed
          : 0;
      }
    } else {
      this.state = 'hash-mismatch';
    }

    return {
      data: originalData,
      hashMatch,
      mode: this.manifest.mode,
      fileName: this.manifest.fileName,
      mimeType: this.manifest.mimeType,
    };
  }

  getRecoveredData(): Uint8Array | null {
    return this.recoveredData;
  }

  reset(): void {
    this.state = 'scanning-no-session';
    this.manifest = null;
    this.sessionId = null;
    this.decoder = null;
    this.hashVerified = false;
    this.recoveredData = null;
    this.stats = createInitialStats();
  }
}

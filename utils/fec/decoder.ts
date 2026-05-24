// Systematic LT Decoder with adjacency lists for efficient propagation

import { SystematicLtEncoder } from './encoder';
import { xorInto } from './xor';
import type { FecDecoder, DecodeUpdate } from './types';

interface PendingSymbol {
  id: number;
  data: Uint8Array;
  remaining: Set<number>;
}

export class SystematicLtDecoder implements FecDecoder {
  readonly scheme = 'systematic-lt-v1';
  readonly K: number;
  readonly blockSize: number;
  private fecSeed: number;

  // Recovered source blocks
  private recovered: (Uint8Array | null)[];
  private recoveredCount: number;

  // Pending repair symbols with adjacency lists
  private pendingSymbols: Map<number, PendingSymbol>;
  private pendingByBlock: Set<number>[]; // blockIndex -> set of pending symbolIds
  private nextPendingId: number;

  // Dedup
  private processedSourceIds: Set<number>;
  private processedRepairIds: Set<number>;

  constructor(K: number, blockSize: number, fecSeed: number) {
    this.K = K;
    this.blockSize = blockSize;
    this.fecSeed = fecSeed;
    this.recovered = new Array(K).fill(null);
    this.recoveredCount = 0;
    this.pendingSymbols = new Map();
    this.pendingByBlock = Array.from({ length: K }, () => new Set<number>());
    this.nextPendingId = 0;
    this.processedSourceIds = new Set();
    this.processedRepairIds = new Set();
  }

  isComplete(): boolean {
    return this.recoveredCount >= this.K;
  }

  getRecoveredFlags(): boolean[] {
    return this.recovered.map(b => b !== null);
  }

  getRecoveredCount(): number {
    return this.recoveredCount;
  }

  getPendingCount(): number {
    return this.pendingSymbols.size;
  }

  addSourceSymbol(index: number, data: Uint8Array): DecodeUpdate {
    if (this.isComplete() || this.processedSourceIds.has(index)) {
      return { newlyRecovered: [], isComplete: this.isComplete() };
    }
    this.processedSourceIds.add(index);

    if (this.recovered[index] !== null) {
      return { newlyRecovered: [], isComplete: this.isComplete() };
    }

    const newlyRecovered = this.recoverBlock(index, new Uint8Array(data));
    return { newlyRecovered, isComplete: this.isComplete() };
  }

  addRepairSymbol(symbolId: number, data: Uint8Array): DecodeUpdate {
    if (this.isComplete() || this.processedRepairIds.has(symbolId)) {
      return { newlyRecovered: [], isComplete: this.isComplete() };
    }
    this.processedRepairIds.add(symbolId);

    // Derive indices from symbolId, K, and fecSeed (deterministic)
    const { indices } = SystematicLtEncoder.getRepairSymbolInfo(symbolId, this.K, this.fecSeed);

    // XOR out already-recovered blocks
    const symbolData = new Uint8Array(data);
    const remainingIndices = new Set<number>();

    for (const idx of indices) {
      if (this.recovered[idx] !== null) {
        xorInto(symbolData, this.recovered[idx]!);
      } else {
        remainingIndices.add(idx);
      }
    }

    if (remainingIndices.size === 0) {
      return { newlyRecovered: [], isComplete: this.isComplete() };
    }

    if (remainingIndices.size === 1) {
      const blockIdx = remainingIndices.values().next().value!;
      const newlyRecovered = this.recoverBlock(blockIdx, symbolData);
      return { newlyRecovered, isComplete: this.isComplete() };
    }

    // Store as pending with adjacency links
    const pendingId = this.nextPendingId++;
    const pending: PendingSymbol = { id: pendingId, data: symbolData, remaining: remainingIndices };
    this.pendingSymbols.set(pendingId, pending);
    for (const idx of remainingIndices) {
      this.pendingByBlock[idx].add(pendingId);
    }

    return { newlyRecovered: [], isComplete: this.isComplete() };
  }

  private recoverBlock(blockIndex: number, data: Uint8Array): number[] {
    if (this.recovered[blockIndex] !== null) return [];

    this.recovered[blockIndex] = data;
    this.recoveredCount++;
    const newlyRecovered = [blockIndex];

    // BFS propagation using adjacency lists
    const toProcess = [blockIndex];
    while (toProcess.length > 0) {
      const procIdx = toProcess.shift()!;
      const affected = this.pendingByBlock[procIdx];
      if (!affected || affected.size === 0) continue;

      // Copy the set since we'll modify it
      const affectedIds = [...affected];
      affected.clear();

      for (const pendingId of affectedIds) {
        const symbol = this.pendingSymbols.get(pendingId);
        if (!symbol) continue;

        xorInto(symbol.data, this.recovered[procIdx]!);
        symbol.remaining.delete(procIdx);

        if (symbol.remaining.size === 1) {
          const newIdx = symbol.remaining.values().next().value!;
          // Remove from adjacency
          this.pendingByBlock[newIdx]?.delete(pendingId);
          this.pendingSymbols.delete(pendingId);

          if (this.recovered[newIdx] === null) {
            this.recovered[newIdx] = symbol.data;
            this.recoveredCount++;
            newlyRecovered.push(newIdx);
            toProcess.push(newIdx);
          }
        } else if (symbol.remaining.size === 0) {
          this.pendingSymbols.delete(pendingId);
        }
      }
    }

    return newlyRecovered;
  }

  getRecoveredData(originalLength: number): Uint8Array | null {
    if (!this.isComplete()) return null;

    const result = new Uint8Array(originalLength);
    let offset = 0;
    for (let i = 0; i < this.K; i++) {
      const block = this.recovered[i]!;
      const remaining = originalLength - offset;
      const copyLen = Math.min(block.length, remaining);
      result.set(block.subarray(0, copyLen), offset);
      offset += copyLen;
    }
    return result;
  }

  /**
   * Get a specific recovered block (for incremental chunk updates).
   */
  getRecoveredBlock(index: number): Uint8Array | null {
    return this.recovered[index];
  }
}

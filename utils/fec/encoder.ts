// Systematic LT Encoder
// For symbolId < K: emit raw source block (systematic)
// For symbolId >= K: emit LT repair symbol

import { mulberry32 } from './prng';
import { getDegreeCdf, sampleDegree, sampleIndices } from './distribution';
import { xorInto } from './xor';
import type { FecEncoder } from './types';

export class SystematicLtEncoder implements FecEncoder {
  readonly scheme = 'systematic-lt-v1';
  readonly sourceBlockCount: number;
  readonly blockSize: number;
  private sourceBlocks: Uint8Array[];
  private fecSeed: number;

  constructor(sourceBlocks: Uint8Array[], fecSeed: number) {
    this.sourceBlocks = sourceBlocks;
    this.sourceBlockCount = sourceBlocks.length;
    this.blockSize = sourceBlocks[0]?.length ?? 0;
    this.fecSeed = fecSeed;
  }

  getSourceSymbol(index: number): Uint8Array {
    if (index < 0 || index >= this.sourceBlockCount) {
      throw new RangeError(`Source index ${index} out of range [0, ${this.sourceBlockCount})`);
    }
    return this.sourceBlocks[index];
  }

  getRepairSymbol(symbolId: number): Uint8Array {
    const K = this.sourceBlockCount;
    const cdf = getDegreeCdf(K);
    // Derive seed from fecSeed and symbolId for determinism
    const seed = (this.fecSeed ^ symbolId ^ (symbolId * 2654435761)) >>> 0;
    const rand = mulberry32(seed);
    const degree = sampleDegree(cdf, rand);
    const indices = sampleIndices(K, degree, rand);

    const result = new Uint8Array(this.blockSize);
    for (const idx of indices) {
      xorInto(result, this.sourceBlocks[idx]);
    }
    return result;
  }

  /**
   * Get the degree and source block indices for a repair symbol.
   * Used by the decoder to reconstruct without transmitting index lists.
   */
  static getRepairSymbolInfo(symbolId: number, K: number, fecSeed: number): { degree: number; indices: number[] } {
    const cdf = getDegreeCdf(K);
    const seed = (fecSeed ^ symbolId ^ (symbolId * 2654435761)) >>> 0;
    const rand = mulberry32(seed);
    const degree = sampleDegree(cdf, rand);
    const indices = sampleIndices(K, degree, rand);
    return { degree, indices };
  }
}

/**
 * Split data into equal-sized source blocks (last block padded with zeros).
 */
export function splitIntoBlocks(data: Uint8Array, blockSize: number): Uint8Array[] {
  const K = Math.ceil(data.length / blockSize);
  const blocks: Uint8Array[] = [];
  for (let i = 0; i < K; i++) {
    const block = new Uint8Array(blockSize);
    const start = i * blockSize;
    const end = Math.min(start + blockSize, data.length);
    block.set(data.subarray(start, end));
    blocks.push(block);
  }
  return blocks;
}

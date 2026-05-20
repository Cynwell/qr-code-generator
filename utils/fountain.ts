// utils/fountain.ts
// LT (Luby Transform) fountain code implementation

// Seeded PRNG (Mulberry32)
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Build CDF from Robust Soliton Distribution
function buildDegreeCDF(K: number): number[] {
  if (K === 1) return [0, 1.0];

  const c = 0.1;
  const delta = 0.5;
  const R = c * Math.log(K / delta) * Math.sqrt(K);

  // Ideal soliton
  const rho = new Array(K + 1).fill(0);
  rho[1] = 1 / K;
  for (let d = 2; d <= K; d++) {
    rho[d] = 1 / (d * (d - 1));
  }

  // Tau (robustness component)
  const tau = new Array(K + 1).fill(0);
  const threshold = Math.max(1, Math.floor(K / R));
  for (let d = 1; d < threshold && d <= K; d++) {
    tau[d] = R / (d * K);
  }
  if (threshold <= K) {
    tau[threshold] = R * Math.log(R / delta) / K;
  }

  // Combine and normalize
  let sum = 0;
  for (let d = 1; d <= K; d++) {
    sum += rho[d] + tau[d];
  }

  // Build CDF
  const cdf = new Array(K + 1).fill(0);
  let cumul = 0;
  for (let d = 1; d <= K; d++) {
    cumul += (rho[d] + tau[d]) / sum;
    cdf[d] = cumul;
  }
  cdf[K] = 1.0;

  return cdf;
}

function sampleDegree(cdf: number[], rand: () => number): number {
  const r = rand();
  for (let d = 1; d < cdf.length; d++) {
    if (r < cdf[d]) return d;
  }
  return cdf.length - 1;
}

function sampleIndices(K: number, degree: number, rand: () => number): number[] {
  const indices: number[] = [];
  const available = Array.from({ length: K }, (_, i) => i);
  for (let i = 0; i < degree && available.length > 0; i++) {
    const idx = Math.floor(rand() * available.length);
    indices.push(available[idx]);
    available.splice(idx, 1);
  }
  return indices.sort((a, b) => a - b);
}

function xorBlocks(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const len = Math.max(a.length, b.length);
  const result = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = (a[i] || 0) ^ (b[i] || 0);
  }
  return result;
}

// Get the degree and source block indices for a given symbol
export function getSymbolInfo(symbolId: number, K: number): { degree: number; indices: number[] } {
  const cdf = buildDegreeCDF(K);
  const rand = mulberry32(symbolId);
  const degree = sampleDegree(cdf, rand);
  const indices = sampleIndices(K, degree, rand);
  return { degree, indices };
}

// Encode: XOR selected source blocks for a given symbol ID
export function encodeSymbol(sourceBlocks: Uint8Array[], symbolId: number): Uint8Array {
  const K = sourceBlocks.length;
  const { indices } = getSymbolInfo(symbolId, K);
  const blockSize = sourceBlocks[0].length;

  let result: Uint8Array = new Uint8Array(blockSize);
  for (const idx of indices) {
    result = xorBlocks(result, sourceBlocks[idx]);
  }
  return result;
}

// Split data into equal-sized source blocks (last block padded with zeros)
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

// Decoder using belief propagation (peeling)
export class FountainDecoder {
  K: number;
  blockSize: number;
  origLen: number;
  mode: string;
  recovered: (Uint8Array | null)[];
  recoveredCount: number;
  pendingSymbols: { data: Uint8Array; indices: number[] }[];
  processedSymbolIds: Set<number>;

  constructor(K: number, blockSize: number, origLen: number, mode: string) {
    this.K = K;
    this.blockSize = blockSize;
    this.origLen = origLen;
    this.mode = mode;
    this.recovered = new Array(K).fill(null);
    this.recoveredCount = 0;
    this.pendingSymbols = [];
    this.processedSymbolIds = new Set();
  }

  get isComplete(): boolean {
    return this.recoveredCount >= this.K;
  }

  getRecoveredFlags(): boolean[] {
    return this.recovered.map((b) => b !== null);
  }

  // Add an encoded symbol. Returns indices of newly recovered source blocks.
  addSymbol(symbolId: number, data: Uint8Array): number[] {
    if (this.isComplete || this.processedSymbolIds.has(symbolId)) {
      return [];
    }
    this.processedSymbolIds.add(symbolId);

    const { indices } = getSymbolInfo(symbolId, this.K);
    let symbolData = new Uint8Array(data);
    const remainingIndices: number[] = [];

    // XOR out already-recovered blocks
    for (const idx of indices) {
      if (this.recovered[idx] !== null) {
        symbolData = xorBlocks(symbolData, this.recovered[idx]!);
      } else {
        remainingIndices.push(idx);
      }
    }

    if (remainingIndices.length === 0) {
      return [];
    }

    if (remainingIndices.length === 1) {
      return this.recoverBlock(remainingIndices[0], symbolData);
    }

    // Degree > 1: store for later propagation
    this.pendingSymbols.push({ data: symbolData, indices: remainingIndices });
    return [];
  }

  private recoverBlock(blockIndex: number, data: Uint8Array): number[] {
    if (this.recovered[blockIndex] !== null) return [];

    this.recovered[blockIndex] = data;
    this.recoveredCount++;
    const newlyRecovered = [blockIndex];

    // Propagate using BFS
    const toProcess = [blockIndex];
    while (toProcess.length > 0) {
      const procIdx = toProcess.shift()!;
      for (let i = this.pendingSymbols.length - 1; i >= 0; i--) {
        const symbol = this.pendingSymbols[i];
        const pos = symbol.indices.indexOf(procIdx);
        if (pos !== -1) {
          symbol.data = xorBlocks(symbol.data, this.recovered[procIdx]!);
          symbol.indices.splice(pos, 1);

          if (symbol.indices.length === 1) {
            const newIdx = symbol.indices[0];
            this.pendingSymbols.splice(i, 1);
            if (this.recovered[newIdx] === null) {
              this.recovered[newIdx] = symbol.data;
              this.recoveredCount++;
              newlyRecovered.push(newIdx);
              toProcess.push(newIdx);
            }
          } else if (symbol.indices.length === 0) {
            this.pendingSymbols.splice(i, 1);
          }
        }
      }
    }

    return newlyRecovered;
  }

  // Reassemble the original data from recovered blocks
  getRecoveredData(): Uint8Array | null {
    if (!this.isComplete) return null;

    const result = new Uint8Array(this.origLen);
    let offset = 0;
    for (let i = 0; i < this.K; i++) {
      const block = this.recovered[i]!;
      const remaining = this.origLen - offset;
      const copyLen = Math.min(block.length, remaining);
      result.set(block.subarray(0, copyLen), offset);
      offset += copyLen;
    }
    return result;
  }
}

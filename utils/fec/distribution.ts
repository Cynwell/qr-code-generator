// Robust Soliton Distribution with CDF caching

// Cache degree CDFs by K to avoid recomputation
const degreeCdfCache = new Map<number, Float64Array>();

export function getDegreeCdf(K: number): Float64Array {
  let cdf = degreeCdfCache.get(K);
  if (!cdf) {
    cdf = buildDegreeCDF(K);
    degreeCdfCache.set(K, cdf);
  }
  return cdf;
}

function buildDegreeCDF(K: number): Float64Array {
  if (K === 1) {
    const cdf = new Float64Array(2);
    cdf[1] = 1.0;
    return cdf;
  }

  const c = 0.1;
  const delta = 0.5;
  const R = c * Math.log(K / delta) * Math.sqrt(K);

  // Ideal soliton
  const rho = new Float64Array(K + 1);
  rho[1] = 1 / K;
  for (let d = 2; d <= K; d++) {
    rho[d] = 1 / (d * (d - 1));
  }

  // Tau (robustness component)
  const tau = new Float64Array(K + 1);
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
  const cdf = new Float64Array(K + 1);
  let cumul = 0;
  for (let d = 1; d <= K; d++) {
    cumul += (rho[d] + tau[d]) / sum;
    cdf[d] = cumul;
  }
  cdf[K] = 1.0;

  return cdf;
}

export function sampleDegree(cdf: Float64Array, rand: () => number): number {
  const r = rand();
  for (let d = 1; d < cdf.length; d++) {
    if (r < cdf[d]) return d;
  }
  return cdf.length - 1;
}

/**
 * Optimized index sampling:
 * - Small degree (< K/8): rejection sampling with Set
 * - Large degree: partial Fisher-Yates
 */
export function sampleIndices(K: number, degree: number, rand: () => number): number[] {
  if (degree >= K) {
    // Full coverage
    const indices = [];
    for (let i = 0; i < K; i++) indices.push(i);
    return indices;
  }

  if (degree <= K / 8) {
    return sampleIndicesRejection(K, degree, rand);
  }
  return sampleIndicesFisherYates(K, degree, rand);
}

function sampleIndicesRejection(K: number, degree: number, rand: () => number): number[] {
  const set = new Set<number>();
  while (set.size < degree) {
    set.add(Math.floor(rand() * K));
  }
  return [...set].sort((a, b) => a - b);
}

function sampleIndicesFisherYates(K: number, degree: number, rand: () => number): number[] {
  // Partial Fisher-Yates: only shuffle `degree` elements
  const indices = new Array(degree);
  // We keep a sparse map of swapped values
  const swapped = new Map<number, number>();

  for (let i = 0; i < degree; i++) {
    const j = i + Math.floor(rand() * (K - i));
    const valI = swapped.get(i) ?? i;
    const valJ = swapped.get(j) ?? j;
    indices[i] = valJ;
    swapped.set(j, valI);
    // No need to set swapped[i] since we won't read it again
  }

  return indices.sort((a, b) => a - b);
}

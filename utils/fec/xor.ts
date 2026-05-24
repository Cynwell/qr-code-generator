// XOR utilities - in-place operations to avoid allocation

/**
 * XOR source into target in-place: target[i] ^= source[i]
 */
export function xorInto(target: Uint8Array, source: Uint8Array): void {
  const len = Math.min(target.length, source.length);
  for (let i = 0; i < len; i++) {
    target[i] ^= source[i];
  }
}

/**
 * Create a new Uint8Array that is the XOR of a and b.
 * Only used when a copy is needed (e.g., initial symbol data).
 */
export function xorBlocks(a: Uint8Array, b: Uint8Array): Uint8Array {
  const len = Math.max(a.length, b.length);
  const result = new Uint8Array(len);
  result.set(a);
  for (let i = 0; i < b.length; i++) {
    result[i] ^= b[i];
  }
  return result;
}

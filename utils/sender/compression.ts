// Compression utilities using CompressionStream API

import type { CompressionMode } from '../protocol/frame-types';

// File extensions that are already compressed - skip compression
const COMPRESSED_EXTENSIONS = new Set([
  'zip', 'gz', '7z', 'rar', 'bz2', 'xz', 'lz', 'zst',
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'heic',
  'mp4', 'mov', 'mkv', 'avi', 'webm',
  'mp3', 'aac', 'ogg', 'flac', 'opus',
  'pdf', 'wasm',
]);

export function shouldCompress(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return !COMPRESSED_EXTENSIONS.has(ext);
}

export async function compressData(data: Uint8Array, mode: CompressionMode): Promise<Uint8Array> {
  if (mode === 'none') return data;

  if (typeof CompressionStream === 'undefined') {
    console.warn('CompressionStream not supported, skipping compression');
    return data;
  }

  const cs = new CompressionStream(mode);
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();

  const chunks: Uint8Array[] = [];
  const readAll = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  })();

  writer.write(data.buffer as ArrayBuffer);
  writer.close();
  await readAll;

  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

export async function decompressData(data: Uint8Array, mode: CompressionMode): Promise<Uint8Array> {
  if (mode === 'none') return data;

  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream not supported');
  }

  const ds = new DecompressionStream(mode);
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  const chunks: Uint8Array[] = [];
  const readAll = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  })();

  writer.write(data.buffer as ArrayBuffer);
  writer.close();
  await readAll;

  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

// SHA-256 hashing using Web Crypto API

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  return new Uint8Array(hashBuffer);
}

export function sha256Hex(hash: Uint8Array): string {
  return Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
}

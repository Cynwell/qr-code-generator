// CRC32C (Castagnoli) implementation
// Uses the CRC32C polynomial 0x1EDC6F41

const CRC32C_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0x82F63B78 : crc >>> 1;
    }
    table[i] = crc;
  }
  return table;
})();

export function crc32c(data: Uint8Array, initial = 0): number {
  let crc = ~initial >>> 0;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC32C_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (~crc) >>> 0;
}

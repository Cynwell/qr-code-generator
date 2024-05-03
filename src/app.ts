import QRCode from 'qrcode'

const chunkSize = 2300
const qrInput = document.getElementById('qr-input')
const canvas = document.getElementById('canvas')

const addHeader = (chunk: Uint8Array, index: number, total: number, mode: string): Uint8ClampedArray => {
  const header = new TextEncoder().encode(`${index + 1}|${total}|${mode}|`);
  const dataWithHeader = new Uint8Array(header.length + chunk.length);
  dataWithHeader.set(header);
  dataWithHeader.set(chunk, header.length);
  return new Uint8ClampedArray(dataWithHeader.buffer);
}

const generateQR = async (input: string | Uint8Array) => {
  if (typeof input === 'string' && !input.trim()) {
    // console.log('Input text is empty.');
    return
  }

  let chunks: Uint8ClampedArray[] = [];
  const encodingMode = typeof input === 'string' ? 'utf-8' : 'binary';
  // console.log(`Encoding mode: ${encodingMode} mode`);
  const buffer = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);

  let i = 0, index = 0;
  let total = Math.ceil(buffer.length / chunkSize);
  while (i < buffer.length) {
    let end = i + chunkSize;
    if (end > buffer.length) {
      end = buffer.length;
    }
    chunks.push(addHeader(buffer.slice(i, end), index, total, encodingMode));
    i = end;
    index++;
  }

  // console.log(`Number of chunks: ${chunks.length}`);
  for (let i = 0; i < chunks.length; i++) {
    // console.log(`Chunk ${i + 1} length: ${chunks[i].length}`)
  }

  const decoder = new TextDecoder();
  // Concatenate all the QR code DataURLs, separated by a comma, then write into <input id="copy-input" type="text" readonly>
  // @ts-ignore
  // const dataURLs = await Promise.all(chunks.map(chunk => QRCode.toDataURL([{ data: chunk, mode: 'byte' }, { errorCorrectionLevel: 'L' }])));
  // (document.getElementById('copy-input') as HTMLInputElement).value = dataURLs.join(',');
  for (const chunk of chunks) {
    try {
      console.log('Generating QR code for:', decoder.decode(chunk));
      // console.log('Chunk length:', chunk.length);
      const startTime = performance.now();
      // @ts-ignore
      await QRCode.toCanvas(canvas, [{ data: chunk, mode: 'byte' }, { errorCorrectionLevel: 'L' }]);
      const endTime = performance.now();
      const timeElapsed = endTime - startTime;
      // console.log(`Time consumed: ${timeElapsed.toFixed(1)} ms`);
      // @ts-ignore
      // console.log(await QRCode.toDataURL([{ data: chunk, mode: 'byte' }, { errorCorrectionLevel: 'L' }]))
    } catch (err) {
      console.error(err)
    }
    // Wait for 0.5 seconds before generating the next QR code
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}

if (qrInput) {
  qrInput.addEventListener('input', (e) => {
    if (e.target) {
      generateQR((e.target as HTMLInputElement).value);
    }
  })
}

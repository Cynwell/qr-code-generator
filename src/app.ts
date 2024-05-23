// Checked all the functions in this file, no problem.
import QRCode from 'qrcode';

const chunkSize = 2300;
const qrInput = document.getElementById('qr-input');
const canvas = document.getElementById('canvas');
const uploadInput = document.getElementById('upload') as HTMLInputElement;

const addHeader = (chunk: Uint8Array, index: number, total: number, mode: string): Uint8ClampedArray => {
  const header = new TextEncoder().encode(`${index + 1}|${total}|${mode}|`);
  const dataWithHeader = new Uint8Array(header.length + chunk.length);
  dataWithHeader.set(header);
  dataWithHeader.set(chunk, header.length);
  return new Uint8ClampedArray(dataWithHeader.buffer);
}

const escapeSpecialCharacters = (input: string): string => {
  // Define the special characters and their escaped counterparts
  const specialCharacters: { [key: string]: string } = {
    // '\\': '\\\\',
    // '\b': '\\b',
    // '\f': '\\f',
    // '\n': '\\n',
    // '\r': '\\r',
    // '\t': '\\t',
    // '\"': '\\"',
    // "\'": "\\'",
    "|": "\\|"
  };

  // Replace each special character with its escaped counterpart
  // return input.replace(/[\\bfnrt"']/g, char => specialCharacters[char]);
  return input.replace(/[|]/g, char => specialCharacters[char]);
}

const generateQR = async (input: string | Uint8Array) => {
  // Logic:
  // 1. utf-8 mode:
  //   Text data -> Escape special characters -> Encode to utf-8
  // 2. Binary mode:
  //   Metadata -> JSON.stringify -> Escape special characters -> Encode to utf-8
  //   Binary data -> Uint8Array
  //   Concatenate metadata and binary data
  if (typeof input === 'string' && !input.trim()) {
    // console.log('Input text is empty.');
    return
  }

  const encodingMode = typeof input === 'string' ? 'utf-8' : 'binary';
  console.log(`Encoding mode: ${encodingMode} mode`);
  const buffer = encodingMode === 'utf-8' ? new TextEncoder().encode(escapeSpecialCharacters(input as string)) : new Uint8Array(input as ArrayBuffer);
  console.log(`Buffer length: ${buffer.length}`);
  const chunks: Uint8ClampedArray[] = chunkArray(buffer, chunkSize).map((chunk, index, array) => addHeader(chunk, index, array.length, encodingMode));

  console.log(`Number of chunks: ${chunks.length}`);
  for (let i = 0; i < chunks.length; i++) {
    console.log(`Chunk ${i + 1} length: ${chunks[i].length}`)
  }
  console.log('Chunks:', chunks);

  const decoder = new TextDecoder();
  // @ts-ignore
  for (const chunk of chunks) {
    try {
      console.log('Hey');
      console.log('Generating QR code for:', decoder.decode(chunk));
      // console.log('Chunk length:', chunk.length);
      const startTime = performance.now();
      // @ts-ignore
      await QRCode.toCanvas(canvas, [{ data: chunk, mode: 'byte' }, { errorCorrectionLevel: 'L' }]);
      const endTime = performance.now();
      const timeElapsed = endTime - startTime;
      console.log(`Time consumed: ${timeElapsed.toFixed(1)} ms`);
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

if (uploadInput) {
  uploadInput.addEventListener('change', async (event) => {
    console.log('File uploaded:', (event.target as HTMLInputElement).files?.[0]?.name);
    const fileInput = event.target as HTMLInputElement;
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      const decoder = new TextDecoder();

      reader.onload = async (event) => {
        if (event.target) {
          const data = new Uint8Array(event.target.result as ArrayBuffer);
          const chunks: Uint8Array[] = chunkArray(data, chunkSize); // Split the data into chunks of chunkSize bytes each

          for (const chunk of chunks) {
            // console.log('Generating QR code for:', decoder.decode(chunk.buffer));
            // const startTime = performance.now();
            const metadata = {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified,
                // Include all properties of the File object
            };
            console.table(metadata);
            console.log('Chunk length:', chunk.length);
            // Convert metadata to JSON string and encode it into a Uint8Array
            const metadataArray = new TextEncoder().encode(JSON.stringify(metadata) + '|');
            // Concatenate metadata array and data array
            const fileDataWithMetadata = new Uint8Array([...metadataArray, ...chunk]);
            // @ts-ignore
            generateQR(fileDataWithMetadata);
            // const endTime = performance.now();
            // const timeElapsed = endTime - startTime;
            // console.log(`Time consumed: ${timeElapsed.toFixed(1)} ms`);
            // await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds before generating the next QR code
          }
        }
      };

      reader.readAsArrayBuffer(file);
    }
  });
}

function chunkArray(array: Uint8Array, chunkSize: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

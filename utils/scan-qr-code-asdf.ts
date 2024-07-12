// utils/scan-qr-code.ts
import jsQR from "jsqr";

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const context = canvas.getContext('2d');
const output = document.getElementById('decoded-output') as HTMLTextAreaElement;
const downloadButton = document.getElementById('download-btn');

let chunks: Uint8Array[] | string[] = []; // Array to store the binary data
let totalSegments = 0;
let metadata = { 'name': 'file.bin', 'type': 'application/octet-stream' }; // Default metadata
let mode = 'unknown'; // Default mode

const unescapeSpecialCharacters = (input: string): string => {
  // Define the escaped counterparts and their original characters
  const specialCharacters: { [key: string]: string } = {
    "\\|": "|"
  };

  // Replace each escaped counterpart with its original character
  return input.replace(/\\\|/g, char => specialCharacters[char]);
}


const decodeQR = (imageData: ImageData) => {
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  console.log('QR code:', code);
  if (code) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const binaryData = new Uint8Array(code.binaryData);
    const decodedString = decoder.decode(binaryData);
    const parts = decodedString.split('|');

    const [index, total, mode, ...dataParts] = parts;
    if (mode === 'binary') {
      if (parseInt(index) === 1) {
        metadata = JSON.parse(dataParts[0]);
        try {
          // const data = dataParts.length > 1 ? dataParts.slice(1).join('|') : '';
          // const data = binaryData.slice(encoder.encode(JSON.stringify(metadata) + '|').byteLength);
          // const data = binaryData.slice(encoder.encode(JSON.stringify(metadata) + '|').byteLength);
          const headerAndMetadataLength = encoder.encode(`${index + 1}|${total}|${mode}|` + dataParts[0]).byteLength;
          const data = binaryData.slice(headerAndMetadataLength);
          console.log('[DEBUG] JSON.stringify(metadata) + \'|\': ', JSON.stringify(metadata) + '|');
          console.log('[DEBUG] JSON.stringify(metadata) + \'|\'.length: ', encoder.encode(JSON.stringify(metadata) + '|').length);
          console.log('[DEBUG] JSON.stringify(metadata) + \'|\'.byteLength: ', encoder.encode(JSON.stringify(metadata) + '|').byteLength);
          console.table({ index, total, mode, metadata, data });
          return { index, total, mode, metadata, decodedData: data };
        } catch (error) {
          console.error('Failed to parse binary data:', error);
        }
      }
      else {
        try {
          // const data = dataParts.join('|');
          // const data = binaryData;
          const headerAndMetadataLength = encoder.encode(`${index + 1}|${total}|${mode}`).byteLength;
          const data = binaryData.slice(headerAndMetadataLength);
          console.table({ index, total, mode, metadata, data });
          return { index, total, mode, metadata, decodedData: data };
        } catch (error) {
          console.error('Failed to parse binary data:', error);
        }
      }
    } else if (mode === 'utf-8') {
      try {
        const data = dataParts.join('|');
        console.table({ index, total, mode, metadata: '', data });
        return { index, total, mode, metadata: '', decodedData: data };
      } catch (error) {
        console.error('Failed to parse utf-8 data:', error);
      }
    }
    // const [index, total, mode, metadataStr, ...dataParts] = parts;
    // console.table({ index, total, mode, metadataStr, dataParts });
    // if (parseInt(index) === 1) { // Only parse metadata if it's the first chunk
    //   if (mode === 'binary') {
    //     try {
    //       metadata = JSON.parse(metadataStr.replace(/(\|)/g, '|'));
    //     } catch (error) {
    //       console.error('Failed to parse metadata:', error);
    //       metadata = { 'name': 'file.bin', 'type': 'application/octet-stream' };
    //     }
    //     // Concatenate dataParts into chunks
    //     // const data = dataParts.join('|');
    //     let metadataPlusDelimiter = encoder.encode(metadataStr + '|');
    //     let startOfData = metadataPlusDelimiter.byteLength;
    //     let data = binaryData.slice(startOfData);

    //     console.table({ index, total, mode, metadata, data });
    //     return { index, total, mode, metadata, decodedData: data };
    //   }
    //   else if (mode === 'utf-8') {
    //     console.log('utf-8 mode');
    //     const data = dataParts.length > 1 ? (metadataStr + '|' + dataParts.join('|')).replace(/(\|)/g, '|') : metadataStr.replace(/(\|)/g, '|');
    //     console.table({ index, total, mode, metadata: '', data });
    //     return { index, total, mode, metadata: '', decodedData: data };
    //   }
    // }
    // else {
    //   if (mode === 'binary') {
    //     let metadataPlusDelimiter = encoder.encode(metadataStr + '|');
    //     let startOfData = metadataPlusDelimiter.byteLength;
    //     let data = binaryData.slice(startOfData);

    //     console.table({ index, total, mode, metadata, data });
    //     return { index, total, mode, metadata, decodedData: data };
    //   } else if (mode === 'utf-8') {
    //     const data = dataParts.length > 1 ? (metadataStr + '|' + dataParts.join('|')).replace(/(\|)/g, '|') : metadataStr.replace(/(\|)/g, '|');
    //     console.table({ index, total, mode, metadata: '', data });
    //     return { index, total, mode, metadata: '', decodedData: data };
    //   }
    // }
  }
}

let total = 0;

const scanQR = async () => {
  const imageData = context?.getImageData(0, 0, canvas.width, canvas.height);
  if (imageData) {
    console.log('Scanning QR code...');
    const result = decodeQR(imageData);
    if (result) {
      console.log('Result:', result)
      chunks[parseInt(result.index) - 1] = result.decodedData; // Convert Uint8Array to string
      total = parseInt(result.total);
      mode = result.mode;
    }
  }

  // Enable the download button when scanning is finished
  console.log('Chunks received:', chunks.length, 'Total:', total)
  if (chunks.length === total) {
    // downloadButton.disabled = false;
    downloadButton?.removeAttribute('disabled');
  }
}

if (downloadButton) {
  downloadButton.addEventListener('click', () => {
    console.log('Download button clicked');
    let data;
    if (typeof chunks[0] === 'string') {
      data = new TextEncoder().encode(chunks.join(''));
    } else {
      data = concatenateUint8Arrays(chunks as Uint8Array[]);
    }

    console.table(metadata);
    const blob = new Blob([data], { type: metadata.type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;

    // Get the current timestamp and format it in the 'YYYY-MM-DD HH:MM:SS' format
    const date = new Date();
    const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
    link.download = metadata.name || `${timestamp}.bin`; // Use the original file name if available; otherwise use the timestamp as the file name
    link.click();

    URL.revokeObjectURL(url);
  });
}

function concatenateUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += arr.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}

// Create a MutationObserver to listen for changes to the canvas
const observer = new MutationObserver(scanQR);
observer.observe(canvas, { attributes: true, childList: true, subtree: true });

export { unescapeSpecialCharacters, decodeQR };
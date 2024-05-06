import jsQR from "jsqr";

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const context = canvas.getContext('2d');
const output = document.getElementById('decoded-output') as HTMLTextAreaElement;
const downloadButton = document.getElementById('download-button');

let chunks: Uint8Array[] | string[] = []; // Array to store the binary data
let totalSegments = 0;
let metadata = {'name': 'file.bin', 'type': 'application/octet-stream'}; // Default metadata

const decodeQR = (imageData: ImageData) => {
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  console.log('QR code:', code);
  if (code) {
    const decoder = new TextDecoder();
    const binaryData = new Uint8Array(code.binaryData);
    const decodedString = decoder.decode(binaryData);
    const parts = decodedString.split('|');
    const [index, total, mode, metadataStr, ...dataParts] = parts;
    if (parseInt(index) === 1) { // Only parse metadata if it's the first chunk
      try {
        metadata = JSON.parse(metadataStr);
      } catch (error) {
        console.error('Failed to parse metadata:', error);
        return null;
      }
    }
    const data = dataParts.join('|');
    console.table({ index, total, mode, metadata, data });
    totalSegments = parseInt(total);
    let decodedData;
    if (data !== '') { // Check if data is defined
      if (mode === 'utf-8') {
        console.log('utf-8 mode');
        decodedData = data;
      } else {
        console.log('binary mode');
        // Find the index of the separator in the binaryData
        const separatorIndex = binaryData.findIndex((byte, i) => i > metadataStr.length && byte === '|'.charCodeAt(0));
        if (separatorIndex !== -1) {
          // Split the binaryData into metadata and fileData
          const fileData = binaryData.slice(separatorIndex + 1);
          decodedData = fileData;
        } else {
          decodedData = binaryData;
        }
      }
      chunks[parseInt(index) - 1] = decodedData;
      console.log('Decoded data:', decodedData);
      return { index, total, mode, metadata, decodedData };
    }
  }
  return null;
}

let total = 0;

const scanQR = async () => {
  observer.disconnect(); // Disconnect the observer while scanning

  const imageData = context?.getImageData(0, 0, canvas.width, canvas.height);
  if (imageData) {
    console.log('Scanning QR code...');
    const result = decodeQR(imageData);
    if (result) {
      console.log('Result:', result)
      chunks[Number(result.index) - 1] = result.decodedData; // Convert Uint8Array to string
      total = parseInt(result.total);
      if (typeof result.decodedData === 'string') {
        output.value += result.decodedData;
      } else {
        const decoder = new TextDecoder();
        output.value += decoder.decode(result.decodedData);
      }
      console.log('Metadata:', result.metadata); // Log the metadata
    }
  }

  observer.observe(canvas, { attributes: true, childList: true, subtree: true }); // Reconnect the observer

  // Enable the download button when scanning is finished
  console.log('Chunks:', chunks.length, 'Total:', total)
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
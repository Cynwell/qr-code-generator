import jsQR from "jsqr";

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const context = canvas.getContext('2d');
const output = document.getElementById('decoded-output');

const decodeQR = (imageData: ImageData) => {
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  if (code) {
    const [index, total, mode, data] = code.data.split('|');
    console.table({ index, total, mode, data });
    let decodedData;
    if (mode === 'utf-8') {
      const decoder = new TextDecoder(mode);
      // @ts-ignore
      console.log('Decoded data:', decoder.decode(new Uint8Array(data)));
      // @ts-ignore
      const decodedData = decoder.decode(new Uint8Array(data));
    } else {
      // @ts-ignore
      decodedData = new Uint8Array(data);
    }
    console.log('Decoded data:', decodedData);
    return { index, total, decodedData };
  }
  return null;
}

const scanQR = async () => {
  const chunks: string[] = [];
  let total = 0;

  while (true) {
    const imageData = context?.getImageData(0, 0, canvas.width, canvas.height);
    if (imageData) { // Add a check for undefined
      console.log('Scanning QR code...');
      console.log('Image data:', imageData.data);
      const result = decodeQR(imageData);
      if (result) {
        console.log('Decoded data:', result.decodedData);
        // @ts-ignore
        chunks[result.index - 1] = result.decodedData;
        total = parseInt(result.total);
        if (chunks.length === total) {
          break;
        }
      }
    }
    // Wait for 0.5 seconds before scanning the next QR code
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Create a MutationObserver to listen for changes to the canvas
  const observer = new MutationObserver(scanQR);
  observer.observe(canvas, { attributes: true, childList: true, subtree: true });

  const data = chunks.join('');
  console.log('Decoded data:', data);
}

scanQR();
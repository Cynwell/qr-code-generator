// utils/scan-qr-code.tsx
import jsQR from "jsqr";

export const decodeQR = (imageData: ImageData) => {
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  if (code) {
    console.log('QR Code detected!')
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const binaryData = new Uint8Array(code.binaryData);
    const decodedString = decoder.decode(binaryData);
    const parts = decodedString.split("|");

    const [index, total, mode, ...dataParts] = parts;
    console.log('Chunk', index, 'of', total, 'in', mode, 'mode');
    if (mode === "binary") {
      console.log("Binary mode")
      if (parseInt(index) === 1) {
        const metadata = JSON.parse(dataParts[0]);
        const headerAndMetadataLength = encoder.encode(`${index + 1}|${total}|${mode}|` + dataParts[0]).byteLength;
        const data = binaryData.slice(headerAndMetadataLength);
        console.table({ index, total, mode, metadata, data });
        return { index, total, mode, metadata, decodedData: data };
      } else {
        const headerAndMetadataLength = encoder.encode(`${index + 1}|${total}|${mode}`).byteLength;
        const data = binaryData.slice(headerAndMetadataLength);
        console.table({ index, total, mode, metadata: null, data });
        return { index, total, mode, metadata: null, decodedData: data };
      }
    } else if (mode === "utf-8") {
      console.log("utf-8 mode");
      const data = dataParts.join("|");
      return { index, total, mode, metadata: "", decodedData: data };
    } else {
      console.log("unknown mode");
      return null;
    }
  }
};
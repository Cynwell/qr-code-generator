// components/DownloadButton.tsx
// import { button as buttonStyles } from "@nextui-org/theme";
import { Button } from "@nextui-org/button";

const DownloadButton = ({ chunks, totalSegments, metadata }: { chunks: Uint8Array[], totalSegments: number, metadata: { name: string, type: string } }) => {
  const concatenateUint8Arrays = (arrays: Uint8Array[]) => {
    // Scan and check which index is null (can have more than one), then list the result using console.table
    const nullIndices = arrays.reduce((acc, arr, index) => {
      if (arr === null) {
        acc.push(index);
      }
      return acc;
    }, [] as number[]);
    console.log("Null indices:", nullIndices);

    // Check if any arr in arrays is null
    if (arrays.some(arr => arr === null)) {
      // console.log("Some arrays are null");
      // return null;
      throw new Error("Some arrays are null");
    }

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
  };

  const downloadFile = () => {
    let data;
    if (data === null) {
      throw new Error("Data is null");
    }
    if (typeof chunks[0] === "string") {
      data = new TextEncoder().encode(chunks.join(""));
    } else {
      data = concatenateUint8Arrays(chunks as Uint8Array[]);
    }
    const blob = new Blob([data], { type: metadata.type || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const date = new Date();
    const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
    link.download = metadata.name || `${timestamp}.bin`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      color="secondary"
      variant="ghost"
      size="lg"
      onClick={downloadFile}
    >
      Download File
    </Button>
  );
}

export default DownloadButton;
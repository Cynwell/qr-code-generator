// components/text-display.tsx

export default function TextDisplay({ chunks }: { chunks: string[] }) {
// export default function TextDisplay(chunks: string[]) {
  return (
    <textarea readOnly value={chunks.join("\n")} style={{ width: "100%", height: "200px" }} />
  );
}
// components/video-feed.tsx
import { useEffect, useRef, memo } from "react";
import { decodeQR } from "@/utils/scan-qr-code";

// TODO: Optimize the execution speed of the scanQRCode function, and make it more efficient, less resource-intensive, more performant and non-blocking
const VideoFeed = ({ scanning, chunks, setChunks, setTotalSegments, setMetadata, setMode, setProgressValue }: { scanning: boolean, chunks: Uint8Array[] | string[], setChunks: Function, setTotalSegments: Function, setMetadata: Function, setMode: Function, setProgressValue: Function }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!video || !canvas || !context) {
      return;
    }

    const scanQRCode = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = decodeQR(imageData);
        if (result) {
          setChunks((prevChunks: Uint8Array[] | string[]) => {
            const total = parseInt(result.total);
            const index = parseInt(result.index) - 1;

            if (chunks.length === 0) {
              // Initialize the chunks array to the total length upon receiving the first chunk
              const initialChunks = new Array(total).fill(null);
              initialChunks[index] = result.decodedData;
              // setChunks(initialChunks);
              setTotalSegments(total);
              setMode(result.mode);
              console.log('Initialized and saved first chunk:', index + 1, 'of', total, 'in', result.mode, 'mode');
              return initialChunks;
            } else {
              const newChunks = [...prevChunks];
              if (!newChunks[index]) {
                newChunks[index] = result.decodedData;
                console.log('Saving new chunk:', index + 1, 'of', total, 'in', result.mode, 'mode');
              } else {
                console.log('Chunk', index + 1, 'of', total, 'in', result.mode, 'mode', 'already exists, skipping');
              }
              // Set metadata when chunk with index 1 is received
              if (index === 0) {
                setMetadata(result.metadata);
              }
              return newChunks;
            }
          });

          // Log the updated chunks array after the state update
          console.table(chunks);
          // setProgressValue(chunks.length === 0 ? 0 : (chunks.filter(chunk => chunk !== null).length / chunks.length) * 100);
        }
      }
      animationFrameRef.current = requestAnimationFrame(scanQRCode);
    };

    if (scanning) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((stream) => {
        // I don't know what the difference between these two approaches, the error is still here, but happened in a different place:
        // Approach 1:
        // video.srcObject = stream;
        // video.setAttribute("playsinline", true); // Required for iOS Safari
        // video.play();
        // animationFrameRef.current = requestAnimationFrame(scanQRCode);

        // Approach 2:
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true"); // Required for iOS Safari
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              animationFrameRef.current = requestAnimationFrame(scanQRCode);
            }).catch((error) => {
              console.error('Video playback failed:', error);
            });
          }
        }
      });
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (video && video.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
        video.srcObject = null;
      }
    };
  }, [scanning, chunks, setChunks, setTotalSegments, setMetadata, setMode, setProgressValue]);

  return (
    <div>
      <video ref={videoRef} style={{ display: "block" }}>
        <track kind="captions" />
      </video>
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
};

export default memo(VideoFeed);

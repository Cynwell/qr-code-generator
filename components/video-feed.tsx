// components/video-feed.tsx
import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Button } from "@heroui/button";

import { decodeQR } from "@/utils/scan-qr-code";

// Define a type that accommodates Uint8Array, string, and null
type Chunk = Uint8Array | string | null;

interface VideoFeedProps {
  scanning: boolean;
  setChunks: React.Dispatch<React.SetStateAction<Chunk[]>>;
  setTotalSegments: React.Dispatch<React.SetStateAction<number>>;
  setMetadata: React.Dispatch<React.SetStateAction<{ name: string; type: string }>>;
  setMode: React.Dispatch<React.SetStateAction<string>>;
}

const VideoFeed: React.FC<VideoFeedProps> = ({
  scanning,
  setChunks,
  setTotalSegments,
  setMetadata,
  setMode,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("");

  const startVideoStream = useCallback((stream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute("playsinline", "true");
      videoRef.current.play();
    }
  }, []);

  const stopVideoStream = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const switchCamera = () => {
    if (devices.length > 1) {
      const currentDeviceIndex = devices.findIndex(
        (device) => device.deviceId === currentDeviceId
      );
      const nextDeviceIndex = (currentDeviceIndex + 1) % devices.length;
      setCurrentDeviceId(devices[nextDeviceIndex].deviceId);
    }
  };

  useEffect(() => {
    if (!scanning) {
      return;
    }

    navigator.mediaDevices
      .enumerateDevices()
      .then((deviceList) => {
        const videoDevices = deviceList.filter(
          (device) => device.kind === "videoinput"
        );
        setDevices(videoDevices);
        if (videoDevices.length > 0 && !currentDeviceId) {
          setCurrentDeviceId(videoDevices[0].deviceId);
        }
      })
      .catch((error) => {
        console.error("Error enumerating devices:", error);
      });
  }, [scanning, currentDeviceId]);

  useEffect(() => {
    const constraints =
      currentDeviceId === ""
        ? { video: { facingMode: { exact: "environment" } } }
        : { video: { deviceId: { exact: currentDeviceId } } };
    if (scanning) {
      stopVideoStream();
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          startVideoStream(stream);
        })
        .catch((error) => {
          console.error("Error accessing camera:", error);
        });
    } else {
      stopVideoStream();
      setCurrentDeviceId("");
    }
    console.log("Current device ID:", currentDeviceId);
  }, [
    scanning,
    currentDeviceId,
    startVideoStream,
    stopVideoStream,
  ]);

  const scanQRCode = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (
      video &&
      canvas &&
      context &&
      video.readyState === video.HAVE_ENOUGH_DATA
    ) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = decodeQR(imageData);

      if (result) {
        const { index, total, mode, metadata, decodedData } = result;
        const totalSegments = parseInt(total, 10);
        const chunkIndex = parseInt(index, 10) - 1;

        setChunks((prevChunks: Chunk[]) => {
          const newChunks = prevChunks.length === 0
            ? new Array(totalSegments).fill(null)
            : [...prevChunks];

          if (!newChunks[chunkIndex]) {
            newChunks[chunkIndex] = decodedData;
          }

          if (chunkIndex === 0 && metadata) {
            setMetadata(metadata);
          }

          if (prevChunks.length === 0) {
            setTotalSegments(totalSegments);
            setMode(mode);
          }

          return newChunks;
        });
      }
    }
    animationFrameRef.current = requestAnimationFrame(scanQRCode);
  }, [setChunks, setTotalSegments, setMetadata, setMode]);

  useEffect(() => {
    if (!scanning || !currentDeviceId) return;

    animationFrameRef.current = requestAnimationFrame(scanQRCode);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [scanning, currentDeviceId, scanQRCode]);

  return (
    <div>
      <video ref={videoRef} style={{ display: "block" }}>
        <track kind="captions" />
      </video>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {devices.length > 1 && (
        <Button
          color="secondary"
          variant="ghost"
          size="lg"
          onClick={switchCamera}
        >
          Switch Camera
        </Button>
      )}
    </div>
  );
};

export default memo(VideoFeed);

// components/video-feed.tsx
import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Button } from "@heroui/button";
import { Slider } from "@heroui/slider";

import { decodeQR, FountainResult, SequentialResult } from "@/utils/scan-qr-code";
import { FountainDecoder } from "@/utils/fountain";

// Define a type that accommodates Uint8Array, string, and null
type Chunk = Uint8Array | string | null;

interface VideoFeedProps {
  scanning: boolean;
  setChunks: React.Dispatch<React.SetStateAction<Chunk[]>>;
  setTotalSegments: React.Dispatch<React.SetStateAction<number>>;
  setMetadata: React.Dispatch<React.SetStateAction<{ name: string; type: string }>>;
  setMode: React.Dispatch<React.SetStateAction<string>>;
  setRecoveredFlags?: React.Dispatch<React.SetStateAction<boolean[]>>;
}

const VideoFeed: React.FC<VideoFeedProps> = ({
  scanning,
  setChunks,
  setTotalSegments,
  setMetadata,
  setMode,
  setRecoveredFlags,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const fountainDecoderRef = useRef<FountainDecoder | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: 0.1 });
  const [zoomLevel, setZoomLevel] = useState(1);

  const startVideoStream = useCallback((stream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute("playsinline", "true");
      videoRef.current.play();
    }
    // Check capabilities of the video track
    const track = stream.getVideoTracks()[0];
    trackRef.current = track;
    if (track) {
      const capabilities = track.getCapabilities() as any;
      // Torch
      if (capabilities?.torch) {
        setTorchSupported(true);
      } else {
        setTorchSupported(false);
      }
      // Zoom
      if (capabilities?.zoom) {
        setZoomSupported(true);
        setZoomRange({
          min: capabilities.zoom.min,
          max: capabilities.zoom.max,
          step: capabilities.zoom.step || 0.1,
        });
        setZoomLevel(capabilities.zoom.min);
      } else {
        setZoomSupported(false);
      }
    }
  }, []);

  const stopVideoStream = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    trackRef.current = null;
    setTorchOn(false);
    setTorchSupported(false);
    setZoomSupported(false);
  }, []);

  const switchCamera = useCallback(() => {
    if (devices.length > 1) {
      const currentDeviceIndex = devices.findIndex(
        (device) => device.deviceId === currentDeviceId
      );
      const nextDeviceIndex = (currentDeviceIndex + 1) % devices.length;
      setCurrentDeviceId(devices[nextDeviceIndex].deviceId);
    }
  }, [devices, currentDeviceId]);

  const toggleTorch = useCallback(async () => {
    if (trackRef.current) {
      try {
        await trackRef.current.applyConstraints({
          advanced: [{ torch: !torchOn } as any],
        });
        setTorchOn((prev) => !prev);
      } catch (err) {
        console.error("Error toggling torch:", err);
      }
    }
  }, [torchOn]);

  const handleZoomChange = useCallback(async (value: number | number[]) => {
    const zoom = typeof value === 'number' ? value : value[0];
    setZoomLevel(zoom);
    if (trackRef.current) {
      try {
        await trackRef.current.applyConstraints({
          advanced: [{ zoom } as any],
        });
      } catch (err) {
        console.error("Error setting zoom:", err);
      }
    }
  }, []);

  useEffect(() => {
    if (!scanning) {
      fountainDecoderRef.current = null;
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
        if (result.type === 'fountain') {
          handleFountainSymbol(result);
        } else {
          handleSequentialChunk(result);
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(scanQRCode);
  }, [setChunks, setTotalSegments, setMetadata, setMode, setRecoveredFlags]);

  const handleFountainSymbol = useCallback((result: FountainResult) => {
    const { symbolId, K, blockSize, origLen, mode, data } = result;

    // Initialize decoder on first symbol
    if (!fountainDecoderRef.current || fountainDecoderRef.current.K !== K) {
      fountainDecoderRef.current = new FountainDecoder(K, blockSize, origLen, mode);
      setTotalSegments(K);
      setMode(mode);
      setChunks(new Array(K).fill(null));
      if (setRecoveredFlags) setRecoveredFlags(new Array(K).fill(false));
    }

    const decoder = fountainDecoderRef.current;
    const newlyRecovered = decoder.addSymbol(symbolId, data);

    if (newlyRecovered.length > 0) {
      // Update chunks with newly recovered blocks
      setChunks((prev) => {
        const updated = [...prev];
        for (const idx of newlyRecovered) {
          updated[idx] = decoder.recovered[idx]!;
        }
        return updated;
      });

      if (setRecoveredFlags) {
        setRecoveredFlags(decoder.getRecoveredFlags());
      }

      // If complete, parse metadata for binary mode
      if (decoder.isComplete) {
        const fullData = decoder.getRecoveredData();
        if (fullData && mode === 'binary') {
          try {
            const text = new TextDecoder().decode(fullData);
            const pipeIdx = text.indexOf('|');
            if (pipeIdx > 0) {
              const metaJson = text.substring(0, pipeIdx);
              const parsed = JSON.parse(metaJson);
              if (parsed.name) setMetadata(parsed);
            }
          } catch {
            // metadata parsing failed, use defaults
          }
        }

        // Replace chunks with final reassembled data segments
        setChunks((prev) => {
          const updated = [...prev];
          for (let i = 0; i < K; i++) {
            updated[i] = decoder.recovered[i]!;
          }
          return updated;
        });
      }
    }
  }, [setChunks, setTotalSegments, setMetadata, setMode, setRecoveredFlags]);

  const handleSequentialChunk = useCallback((result: SequentialResult) => {
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

    // Update recovered flags for sequential mode
    if (setRecoveredFlags) {
      setRecoveredFlags((prev) => {
        const flags = prev.length === 0 ? new Array(totalSegments).fill(false) : [...prev];
        flags[chunkIndex] = true;
        return flags;
      });
    }
  }, [setChunks, setTotalSegments, setMetadata, setMode, setRecoveredFlags]);

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
    <div className="flex flex-col gap-3">
      {/* Video feed */}
      <div className="relative w-full rounded-lg overflow-hidden bg-default-100">
        <video ref={videoRef} className="w-full block rounded-lg">
          <track kind="captions" />
        </video>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Camera controls - only shown while scanning */}
      {scanning && (
        <div className="flex flex-col gap-3">
          {/* Buttons row */}
          <div className="flex justify-center gap-2 flex-wrap">
            {devices.length > 1 && (
              <Button
                color="primary"
                variant="flat"
                size="sm"
                onPress={switchCamera}
              >
                Switch Camera
              </Button>
            )}
            {torchSupported && (
              <Button
                color={torchOn ? "warning" : "default"}
                variant={torchOn ? "solid" : "flat"}
                size="sm"
                onPress={toggleTorch}
              >
                {torchOn ? "Flashlight On" : "Flashlight Off"}
              </Button>
            )}
          </div>

          {/* Zoom slider */}
          {zoomSupported && zoomRange.max > zoomRange.min && (
            <Slider
              label="Zoom"
              step={zoomRange.step}
              minValue={zoomRange.min}
              maxValue={zoomRange.max}
              value={zoomLevel}
              size="sm"
              color="primary"
              onChange={handleZoomChange}
              className="w-full px-2"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default memo(VideoFeed);

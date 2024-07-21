// components/video-feed.tsx
import { useEffect, useRef, memo, useState, use } from "react";
import { Button } from "@nextui-org/button";

import { decodeQR } from "@/utils/scan-qr-code";

// TODO: Optimize the execution speed of the scanQRCode function, and make it more efficient, less resource-intensive, more performant and non-blocking
const VideoFeed = ({ scanning, setChunks, setTotalSegments, setMetadata, setMode }: { scanning: boolean, setChunks: Function, setTotalSegments: Function, setMetadata: Function, setMode: Function }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("");

  const startVideoStream = (stream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute("playsinline", "true"); // Required for iOS Safari
      const onLoadedMetadata = () => {
      const playPromise = videoRef.current?.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log("Video playback started successfully");
            // Additional actions after successful playback
          })
            .catch((error) => {
              console.error("Video playback failed:", error);
              // Additional actions on playback error
          });
          videoRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata);
        }
      }
      videoRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
    }
  };

  const stopVideoStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const switchCamera = () => {
    if (devices.length > 1) {
      const currentDeviceIndex = devices.findIndex(device => device.deviceId === currentDeviceId);
      const nextDeviceIndex = (currentDeviceIndex + 1) % devices.length;
      setCurrentDeviceId(devices[nextDeviceIndex].deviceId);
    }
  };

  // Separate effect for device enumeration
  useEffect(() => {
    if (!scanning) {
      return;
    }

    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoDevices = devices.filter(device => device.kind === "videoinput");
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !currentDeviceId) {
        setCurrentDeviceId(videoDevices[0].deviceId);
      }
    }).catch((error) => {
      console.error("Error enumerating devices:", error);
    });
  }, [currentDeviceId]);

  // TODO: Implement a request permission function to request camera access
  useEffect(() => {
    const constraints = currentDeviceId === "" ? { video: { facingMode: { exact: "environment" } } } : { video: { deviceId: { exact: currentDeviceId } } };
    if (scanning) {
      stopVideoStream();
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          /* use the stream */
          if (videoRef.current) {
            const deviceId = stream.getVideoTracks()[0].getSettings().deviceId || "";
            setCurrentDeviceId(deviceId);
            startVideoStream(stream);
          }
        })
        .catch((error) => {
          /* handle the error */
          console.error("Error accessing the camera:", error);
          stopVideoStream();
          setCurrentDeviceId("");
        })
    } else {
      // Stop the video stream when scanning is disabled
      stopVideoStream();
      setCurrentDeviceId("");
    }
    console.log("Current device ID:", currentDeviceId);
  }, [scanning, currentDeviceId]);

  useEffect(() => {
    if (!scanning || !currentDeviceId) return;

    const video = videoRef.current;
    if (!video) return;

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

            if (prevChunks.length === 0) {
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
              // Log the updated chunks array after the state update
              // console.table(newChunks);
              return newChunks;
            }
          });
        }
      }
      animationFrameRef.current = requestAnimationFrame(scanQRCode);
    }
    animationFrameRef.current = requestAnimationFrame(scanQRCode);
  }, [scanning, currentDeviceId, setChunks, setTotalSegments, setMetadata, setMode]);

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

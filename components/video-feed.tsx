// components/video-feed.tsx
import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Button } from "@heroui/button";
import { Slider } from "@heroui/slider";

import { JsQrBackend, MultiRegionJsQrBackend, BarcodeDetectorBackend, type DecodedQr, type ScannerBackend } from "@/utils/receiver/scanner-backends";
import { RoiTracker } from "@/utils/receiver/roi-tracker";
import { ReceiverSession, type ReceiverStats, type ReceiverState } from "@/utils/receiver/receiver-session";

export type VideoInputSource = 'camera' | 'screen';

interface VideoFeedProps {
  scanning: boolean;
  inputSource?: VideoInputSource;
  multiQrGrid?: { cols: number; rows: number } | null;
  onRecoveredUpdate: (flags: boolean[], recoveredCount: number, totalBlocks: number) => void;
  onComplete: (session: ReceiverSession) => void;
  onStatsUpdate?: (stats: ReceiverStats) => void;
  onStateChange?: (state: ReceiverState) => void;
  onManifestReceived?: (manifest: { mode: string; fileName: string; mimeType: string; K: number }) => void;
}

const VideoFeed: React.FC<VideoFeedProps> = ({
  scanning,
  inputSource = 'camera',
  multiQrGrid,
  onRecoveredUpdate,
  onComplete,
  onStatsUpdate,
  onStateChange,
  onManifestReceived,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const videoFrameCallbackRef = useRef<number | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const sessionRef = useRef<ReceiverSession>(new ReceiverSession());
  const singleScannerRef = useRef(new JsQrBackend());
  const multiScannerRef = useRef<MultiRegionJsQrBackend | null>(null);
  const barcodeDetectorRef = useRef<BarcodeDetectorBackend | null>(null);
  const roiTrackerRef = useRef(new RoiTracker());
  const canvasSizeSetRef = useRef(false);

  // Select the appropriate scanner based on multiQrGrid prop
  const getScanner = useCallback((): ScannerBackend => {
    if (multiQrGrid && multiQrGrid.cols * multiQrGrid.rows > 1) {
      if (!multiScannerRef.current) {
        multiScannerRef.current = new MultiRegionJsQrBackend(multiQrGrid.cols, multiQrGrid.rows);
      } else {
        multiScannerRef.current.setGrid(multiQrGrid.cols, multiQrGrid.rows);
      }
      return multiScannerRef.current;
    }
    return singleScannerRef.current;
  }, [multiQrGrid]);

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
      videoRef.current.play().catch((err) => {
        // AbortError is expected when switching cameras (play() interrupted by new load)
        if (err.name !== 'AbortError') {
          console.error("Error playing video:", err);
        }
      });
    }
    const track = stream.getVideoTracks()[0];
    trackRef.current = track;
    canvasSizeSetRef.current = false;
    if (track) {
      const capabilities = track.getCapabilities() as any;
      if (capabilities?.torch) {
        setTorchSupported(true);
      } else {
        setTorchSupported(false);
      }
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
    canvasSizeSetRef.current = false;
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
      sessionRef.current = new ReceiverSession();
      roiTrackerRef.current.reset();
      return;
    }

    // Only enumerate camera devices when using camera source
    if (inputSource !== 'camera') return;

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
  }, [scanning, currentDeviceId, inputSource]);

  useEffect(() => {
    if (!scanning) {
      stopVideoStream();
      setCurrentDeviceId("");
      return;
    }

    if (inputSource === 'screen') {
      // Screen capture mode
      stopVideoStream();
      navigator.mediaDevices
        .getDisplayMedia({ video: true, audio: false })
        .then((stream) => {
          startVideoStream(stream);
          // Auto-stop scanning if user ends screen share
          stream.getVideoTracks()[0]?.addEventListener('ended', () => {
            stopVideoStream();
          });
        })
        .catch((error) => {
          console.error("Error accessing screen capture:", error);
        });
    } else {
      // Camera mode
      const constraints =
        currentDeviceId === ""
          ? { video: { facingMode: { exact: "environment" } } }
          : { video: { deviceId: { exact: currentDeviceId } } };
      stopVideoStream();
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          startVideoStream(stream);
        })
        .catch((error) => {
          console.error("Error accessing camera:", error);
        });
    }
  }, [scanning, currentDeviceId, inputSource, startVideoStream, stopVideoStream]);

  const scanQRCode = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!video || !canvas || !context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      scheduleNextScan();
      return;
    }

    const session = sessionRef.current;
    session.stats.videoFramesObserved++;

    // Set canvas size only when video dimensions change (not every frame)
    if (!canvasSizeSetRef.current || canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      roiTrackerRef.current.setFrameSize(video.videoWidth, video.videoHeight);
      canvasSizeSetRef.current = true;
    }

    const isMultiQr = multiQrGrid && multiQrGrid.cols * multiQrGrid.rows > 1;
    const scanner = getScanner();

    // In multi-QR mode, always use full frame (no ROI)
    let imageData: ImageData;
    if (isMultiQr) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      session.stats.scanMode = 'multi-qr';
    } else {
      // ROI scanning for single QR mode
      const roi = roiTrackerRef.current.getRoi();
      if (roi) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        imageData = context.getImageData(roi.x, roi.y, roi.width, roi.height);
        session.stats.scanMode = 'roi';
      } else {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        session.stats.scanMode = 'full-frame';
      }
    }

    // Scan using the backend
    const results = scanner.scan(imageData);

    if (results.length > 0) {
      for (const qr of results) {
        // Update ROI from detection location (only in single-QR mode)
        if (!isMultiQr && qr.location) {
          const roi = roiTrackerRef.current.getRoi();
          if (roi) {
            const adjustedLocation = {
              topLeftCorner: { x: qr.location.topLeftCorner.x + roi.x, y: qr.location.topLeftCorner.y + roi.y },
              topRightCorner: { x: qr.location.topRightCorner.x + roi.x, y: qr.location.topRightCorner.y + roi.y },
              bottomLeftCorner: { x: qr.location.bottomLeftCorner.x + roi.x, y: qr.location.bottomLeftCorner.y + roi.y },
              bottomRightCorner: { x: qr.location.bottomRightCorner.x + roi.x, y: qr.location.bottomRightCorner.y + roi.y },
            };
            roiTrackerRef.current.updateFromDetection(adjustedLocation);
          } else {
            roiTrackerRef.current.updateFromDetection(qr.location);
          }
        }

        // Process through receiver session
        const result = session.processRawPayload(qr.binaryData);

        if (result.manifestReceived && session.manifest) {
          onManifestReceived?.({
            mode: session.manifest.mode,
            fileName: session.manifest.fileName,
            mimeType: session.manifest.mimeType,
            K: session.stats.sourceBlockCount,
          });
        }

        if (result.newlyRecovered.length > 0) {
          const flags = session.getRecoveredFlags();
          onRecoveredUpdate(flags, session.stats.recoveredBlocks, session.stats.sourceBlockCount);
        }

        onStateChange?.(result.state);

        if (result.isComplete) {
          onComplete(session);
          return; // Stop scanning
        }
      }
    } else {
      roiTrackerRef.current.markMiss();
    }

    // Report stats periodically
    if (session.stats.videoFramesObserved % 10 === 0) {
      onStatsUpdate?.({ ...session.stats });
    }

    scheduleNextScan();
  }, [onRecoveredUpdate, onComplete, onStatsUpdate, onStateChange, onManifestReceived, multiQrGrid, getScanner]);

  const scheduleNextScan = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      animationFrameRef.current = requestAnimationFrame(scanQRCode);
      return;
    }

    // Use requestVideoFrameCallback when available
    if ('requestVideoFrameCallback' in video) {
      videoFrameCallbackRef.current = (video as any).requestVideoFrameCallback(
        () => scanQRCode()
      );
    } else {
      animationFrameRef.current = requestAnimationFrame(scanQRCode);
    }
  }, [scanQRCode]);

  useEffect(() => {
    if (!scanning || (!currentDeviceId && inputSource === 'camera')) return;

    scheduleNextScan();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (videoFrameCallbackRef.current && videoRef.current && 'cancelVideoFrameCallback' in videoRef.current) {
        (videoRef.current as any).cancelVideoFrameCallback(videoFrameCallbackRef.current);
        videoFrameCallbackRef.current = null;
      }
    };
  }, [scanning, currentDeviceId, scheduleNextScan]);

  return (
    <div className="flex flex-col gap-3">
      {/* Video feed */}
      <div className="relative w-full rounded-lg overflow-hidden bg-default-100">
        <video ref={videoRef} className="w-full block rounded-lg">
          <track kind="captions" />
        </video>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Camera controls (only shown for camera source) */}
      {scanning && inputSource === 'camera' && (
        <div className="flex flex-col gap-3">
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

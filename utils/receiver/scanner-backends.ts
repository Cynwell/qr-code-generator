// Scanner backends - abstraction layer for QR decoding

import jsQR from 'jsqr';

export interface DecodedQr {
  binaryData: Uint8Array;
  location: {
    topLeftCorner: { x: number; y: number };
    topRightCorner: { x: number; y: number };
    bottomLeftCorner: { x: number; y: number };
    bottomRightCorner: { x: number; y: number };
  } | null;
}

export interface ScannerBackend {
  readonly name: string;
  scan(imageData: ImageData): DecodedQr[];
}

/**
 * jsQR backend with dontInvert optimization.
 */
export class JsQrBackend implements ScannerBackend {
  readonly name = 'jsqr';

  scan(imageData: ImageData): DecodedQr[] {
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });
    if (!code) return [];

    return [{
      binaryData: new Uint8Array(code.binaryData),
      location: code.location,
    }];
  }
}

/**
 * Multi-QR scanner that finds multiple QR codes in a single frame.
 * Uses a scan-and-mask approach: scan the frame, blank out the found QR region,
 * scan again, repeat until no more codes or max count reached.
 * This avoids fixed-grid alignment issues with camera perspective.
 */
export class MultiRegionJsQrBackend implements ScannerBackend {
  readonly name = 'jsqr-multi';
  private maxCodes: number;

  constructor(cols: number, rows: number) {
    this.maxCodes = cols * rows;
  }

  setGrid(cols: number, rows: number) {
    this.maxCodes = cols * rows;
  }

  scan(imageData: ImageData): DecodedQr[] {
    const results: DecodedQr[] = [];
    // Work on a copy so masking doesn't affect the original
    const workingData = new Uint8Array(imageData.data.length);
    workingData.set(imageData.data);
    const workingImageData = new ImageData(
      new Uint8ClampedArray(workingData.buffer),
      imageData.width,
      imageData.height,
    );

    for (let attempt = 0; attempt < this.maxCodes; attempt++) {
      const code = jsQR(workingImageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (!code) break;

      results.push({
        binaryData: new Uint8Array(code.binaryData),
        location: code.location,
      });

      // Mask out the found QR code region with white pixels so next scan finds a different one
      const loc = code.location;
      const points = [
        loc.topLeftCorner, loc.topRightCorner,
        loc.bottomLeftCorner, loc.bottomRightCorner,
      ];

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }

      // Expand mask region by 10% to ensure full coverage
      const w = maxX - minX;
      const h = maxY - minY;
      const expandX = Math.ceil(w * 0.1);
      const expandY = Math.ceil(h * 0.1);
      const x0 = Math.max(0, Math.floor(minX - expandX));
      const y0 = Math.max(0, Math.floor(minY - expandY));
      const x1 = Math.min(imageData.width, Math.ceil(maxX + expandX));
      const y1 = Math.min(imageData.height, Math.ceil(maxY + expandY));

      // Fill region with white (RGBA: 255, 255, 255, 255)
      const data = workingImageData.data;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * imageData.width + x) * 4;
          data[idx] = 255;     // R
          data[idx + 1] = 255; // G
          data[idx + 2] = 255; // B
          data[idx + 3] = 255; // A
        }
      }
    }

    return results;
  }
}

/**
 * Native BarcodeDetector backend (async, returns Promise).
 * Falls back to jsQR if not available.
 */
export class BarcodeDetectorBackend implements ScannerBackend {
  readonly name = 'barcode-detector';
  private detector: any | null = null;
  private fallback: JsQrBackend;

  constructor() {
    this.fallback = new JsQrBackend();
    if (typeof globalThis !== 'undefined' && 'BarcodeDetector' in globalThis) {
      try {
        this.detector = new (globalThis as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        this.detector = null;
      }
    }
  }

  scan(imageData: ImageData): DecodedQr[] {
    // BarcodeDetector.detect() is async, so for the sync interface we fall back to jsQR
    // The async path is used separately when needed
    return this.fallback.scan(imageData);
  }

  async scanAsync(source: ImageBitmap | HTMLCanvasElement | HTMLVideoElement): Promise<DecodedQr[]> {
    if (!this.detector) return [];
    try {
      const results = await this.detector.detect(source);
      return results.map((r: any) => {
        // Prefer rawBytes (binary-safe) over rawValue (text)
        const binaryData = r.rawBytes
          ? new Uint8Array(r.rawBytes)
          : new TextEncoder().encode(r.rawValue);
        return {
          binaryData,
          location: r.cornerPoints ? {
            topLeftCorner: r.cornerPoints[0],
            topRightCorner: r.cornerPoints[1],
            bottomRightCorner: r.cornerPoints[2],
            bottomLeftCorner: r.cornerPoints[3],
          } : null,
        };
      });
    } catch {
      return [];
    }
  }

  get isNativeAvailable(): boolean {
    return this.detector !== null;
  }
}

/**
 * Auto backend - uses BarcodeDetector when available, falls back to jsQR.
 */
export function createAutoBackend(): ScannerBackend {
  const bd = new BarcodeDetectorBackend();
  if (bd.isNativeAvailable) return bd;
  return new JsQrBackend();
}

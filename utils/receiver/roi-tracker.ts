// ROI (Region of Interest) tracker for scanner optimization

export interface ScanRoi {
  x: number;
  y: number;
  width: number;
  height: number;
  lostFrameCount: number;
}

const ROI_MARGIN = 0.3; // 30% expansion
const MAX_LOST_FRAMES = 10; // Return to full-frame after this many misses

export class RoiTracker {
  private roi: ScanRoi | null = null;
  private frameWidth = 0;
  private frameHeight = 0;

  setFrameSize(width: number, height: number): void {
    this.frameWidth = width;
    this.frameHeight = height;
  }

  /**
   * Update ROI after a successful QR detection.
   */
  updateFromDetection(location: {
    topLeftCorner: { x: number; y: number };
    topRightCorner: { x: number; y: number };
    bottomLeftCorner: { x: number; y: number };
    bottomRightCorner: { x: number; y: number };
  }): void {
    const points = [
      location.topLeftCorner,
      location.topRightCorner,
      location.bottomLeftCorner,
      location.bottomRightCorner,
    ];

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    const w = maxX - minX;
    const h = maxY - minY;
    const marginX = w * ROI_MARGIN;
    const marginY = h * ROI_MARGIN;

    this.roi = {
      x: Math.max(0, Math.floor(minX - marginX)),
      y: Math.max(0, Math.floor(minY - marginY)),
      width: Math.min(this.frameWidth, Math.ceil(w + 2 * marginX)),
      height: Math.min(this.frameHeight, Math.ceil(h + 2 * marginY)),
      lostFrameCount: 0,
    };

    // Clamp to frame bounds
    if (this.roi.x + this.roi.width > this.frameWidth) {
      this.roi.width = this.frameWidth - this.roi.x;
    }
    if (this.roi.y + this.roi.height > this.frameHeight) {
      this.roi.height = this.frameHeight - this.roi.y;
    }
  }

  /**
   * Mark a missed frame. Returns to full-frame after too many misses.
   */
  markMiss(): void {
    if (this.roi) {
      this.roi.lostFrameCount++;
      if (this.roi.lostFrameCount >= MAX_LOST_FRAMES) {
        this.roi = null;
      }
    }
  }

  /**
   * Get the current ROI, or null for full-frame mode.
   */
  getRoi(): ScanRoi | null {
    return this.roi;
  }

  /**
   * Whether we're in ROI mode vs full-frame mode.
   */
  get isRoiMode(): boolean {
    return this.roi !== null;
  }

  reset(): void {
    this.roi = null;
  }
}

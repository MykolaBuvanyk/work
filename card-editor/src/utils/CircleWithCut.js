import * as fabricNS from "fabric";

// Custom dynamic shape: switches between a full circle and a cut-off (vertical clipped) circle
// Behavior:
// - If width >= height: render a full circle (diameter = height) and auto-keep aspect ratio during scaling (height follows width)
// - If width < height: render two vertical lines and top/bottom arcs between them (cut-off look)

const fabric = (fabricNS && (fabricNS.fabric || fabricNS)) || null;

export class CircleWithCut extends (fabric?.Object || Object) {
  static type = "circle-with-cut";

  constructor(options = {}) {
    super(options);
    this.type = "circle-with-cut";
    this.orientation =
      options.orientation === "horizontal" ? "horizontal" : "vertical"; // default vertical
    // Bounding box in object coordinates (Fabric will apply scaleX/scaleY)
    this.width = options.width || 60;
    this.height = options.height || 80;
    this.originX = options.originX || "center";
    this.originY = options.originY || "center";
    this.fill = options.fill ?? "transparent";
    this.stroke = options.stroke ?? "#FD7714";
    this.strokeWidth = options.strokeWidth ?? 1.5;
    this.strokeUniform = options.strokeUniform ?? true;
    this.selectable = options.selectable ?? true;
    this.hasControls = options.hasControls ?? true;
    this.lockScalingFlip = options.lockScalingFlip ?? true;
    this.toleranceRatio =
      typeof options.toleranceRatio === "number"
        ? options.toleranceRatio
        : 0.02; // 2% от доминирующей стороны
    this.toleranceMin =
      typeof options.toleranceMin === "number" ? options.toleranceMin : 1; // минимальная толерантность в px объектных координатах

    // During scaling: if effective width would exceed height, clamp width to height (make perfect circle)
    this.on("scaling", () => {
      try {
        const w0 = this.width || 0;
        const h0 = this.height || 0;
        const sx = this.scaleX || 1;
        const sy = this.scaleY || 1;
        const effW = w0 * sx;
        const effH = h0 * sy;
        const tol = Math.max(
          this.toleranceMin,
          (this.toleranceRatio || 0) *
            (this.orientation === "vertical" ? effH : effW)
        );
        if (this.orientation === "vertical") {
          if (w0 > 0 && effW > effH - tol) {
            // clamp scaleX so effW == effH (snap to circle near-threshold)
            this.scaleX = (h0 * sy) / w0;
          }
        } else {
          if (h0 > 0 && effH > effW - tol) {
            // horizontal mode: clamp height to width (snap)
            this.scaleY = (w0 * sx) / h0;
          }
        }
      } catch {}
    });

    // Normalize dimensions after transform to bake scale into width/height
    this.on("modified", () => {
      try {
        let newW = (this.width || 0) * (this.scaleX || 1);
        let newH = (this.height || 0) * (this.scaleY || 1);
        const tol2 = Math.max(
          this.toleranceMin,
          (this.toleranceRatio || 0) *
            (this.orientation === "vertical" ? newH : newW)
        );
        // Circle zone: square the box (snap near-threshold)
        if (this.orientation === "vertical") {
          if (newW >= newH - tol2) newW = newH; // width follows height
        } else {
          if (newH >= newW - tol2) newH = newW; // height follows width
        }
        this.set({ width: newW, height: newH, scaleX: 1, scaleY: 1 });
        if (typeof this.setCoords === "function") this.setCoords();
        if (this.canvas) this.canvas.requestRenderAll();
      } catch {}
    });
  }

  _render(ctx) {
    const w = this.width || 0;
    const h = this.height || 0;
    if (w <= 0 || h <= 0) return;

    const r = h / 2; // target circle radius driven by height
    const halfW = w / 2;

    ctx.beginPath();

    const tol = Math.max(
      this.toleranceMin,
      (this.toleranceRatio || 0) * (this.orientation === "vertical" ? h : w)
    );
    const isCircle =
      this.orientation === "vertical" ? w >= h - tol : h >= w - tol;
    if (isCircle) {
      // Full circle (diameter = min(width,height) based on orientation)
      const radius = this.orientation === "vertical" ? h / 2 : w / 2;
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
    } else if (this.orientation === "vertical") {
      // Vertical capsule: straight sides, exact circular arcs top/bottom
      const sq = Math.max(0, r * r - halfW * halfW);
      const y0 = Math.sqrt(sq);
      // sides
      ctx.moveTo(-halfW, -y0);
      ctx.lineTo(-halfW, y0);
      ctx.moveTo(halfW, -y0);
      ctx.lineTo(halfW, y0);
      // angles defining arc endpoints on the circle
      const ang = Math.acos(Math.min(1, Math.max(-1, halfW / r)));
      // Top arc: from (halfW,-y0) to (-halfW,-y0) along the top (anticlockwise)
      ctx.moveTo(halfW, -y0);
      ctx.arc(0, 0, r, -ang, -Math.PI + ang, true);
      // Bottom arc: from (-halfW,y0) to (halfW,y0) along the bottom (anticlockwise)
      ctx.moveTo(-halfW, y0);
      ctx.arc(0, 0, r, Math.PI - ang, ang, true);
    } else {
      // Horizontal capsule: straight top/bottom, arcs left/right
      const halfH = h / 2;
      const rH = w / 2; // radius driven by width
      const sq = Math.max(0, rH * rH - halfH * halfH);
      const x0 = Math.sqrt(sq);
      // top/bottom lines
      ctx.moveTo(-x0, -halfH);
      ctx.lineTo(x0, -halfH);
      ctx.moveTo(-x0, halfH);
      ctx.lineTo(x0, halfH);
      // angles
      const ang = Math.acos(Math.min(1, Math.max(-1, halfH / rH)));
      // Left arc: from top to bottom along left side
      ctx.moveTo(-x0, -halfH);
      ctx.arc(0, 0, rH, Math.PI + ang, Math.PI - ang, true);
      // Right arc: from bottom to top along right side
      ctx.moveTo(x0, halfH);
      ctx.arc(0, 0, rH, ang, -ang, true);
    }

    if (this.stroke) {
      this._renderStroke(ctx);
    }
  }
}

export const createCircleWithCut = (options = {}) => {
  return new CircleWithCut(options);
};

export default CircleWithCut;

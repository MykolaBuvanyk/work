/*
  Custom caret renderer for Fabric IText/Textbox.
  - Disables built-in caret drawing and draws our own minimal caret.
  - Does NOT rely on Fabric internal caret code; uses only public props and canvas 2D API.
*/

import * as fabric from "fabric";

function getLines(text) {
  // split by \r\n | \n | \r
  return String(text || "").split(/\r\n|\n|\r/);
}

function getLineAndOffset(text, caretIndex) {
  const lines = getLines(text);
  let remaining = Math.max(0, Number(caretIndex) || 0);
  for (let i = 0; i < lines.length; i++) {
    const len = lines[i].length;
    if (remaining <= len) {
      return { line: i, offset: remaining, lines };
    }
    // account for line break char
    remaining -= len + 1;
  }
  // clamp to end of last line
  const last = Math.max(0, lines.length - 1);
  return { line: last, offset: lines[last]?.length || 0, lines };
}

function setCtxFontFromText(ctx, itext) {
  const fontStyle = itext.fontStyle || "normal";
  const fontWeight = itext.fontWeight || "normal";
  const fontSize = Math.max(1, Number(itext.fontSize) || 16);
  const fontFamily = itext.fontFamily || "sans-serif";
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
}

function measureTextWidth(ctx, text) {
  if (!text) return 0;
  try {
    return ctx.measureText(text).width || 0;
  } catch {
    return 0;
  }
}

function drawCaret(ctx, itext) {
  const selStart =
    typeof itext.selectionStart === "number" ? itext.selectionStart : 0;
  const selEnd =
    typeof itext.selectionEnd === "number" ? itext.selectionEnd : selStart;
  if (!itext.isEditing || selStart !== selEnd) return;

  const text = String(itext.text || "");
  const { line, offset, lines } = getLineAndOffset(text, selStart);

  // Prepare measurement context (same transform as object render will already be set by Fabric)
  setCtxFontFromText(ctx, itext);

  // Compute x within line by measuring substring width
  const lineText = lines[line] || "";
  const before = lineText.slice(0, offset);
  const measured = measureTextWidth(ctx, before);

  // Approximate line height: fontSize * lineHeight
  const fontSize = Math.max(1, Number(itext.fontSize) || 16);
  const lineHeightPx = fontSize * (Number(itext.lineHeight) || 1.16);

  // Determine local origin used by Fabric text rendering (center origin is typical)
  // In Fabric, during _render() the object transform is applied and text is drawn relative to its internal bbox.
  // We'll treat (0,0) as object center and shift by half width/height to top-left.
  const halfW = (itext.width || 0) / 2;
  const halfH = (itext.height || 0) / 2;

  // Horizontal alignment offset
  let alignOffsetX = 0;
  const align = itext.textAlign || "left";
  const currentLineWidth = measureTextWidth(ctx, lineText);
  if (align === "center")
    alignOffsetX = ((itext.width || currentLineWidth) - currentLineWidth) / 2;
  else if (align === "right")
    alignOffsetX = (itext.width || currentLineWidth) - currentLineWidth;

  // caret local position in object space
  const caretX = -halfW + alignOffsetX + measured;
  const caretY = -halfH + line * lineHeightPx;

  // caret visual size
  const caretHeight = Math.max(1, lineHeightPx * 0.9);
  // color: use fill or stroke as baseline
  const color = itext.fill || itext.stroke || "#000";

  ctx.save();
  try {
    // Simple blinking: toggle visibility based on time; in OFF phase draw nothing at all
    const period = 1000; // ms
    const phase = (performance.now() % period) / period; // 0..1
    if (phase >= 0.5) return; // OFF phase -> fully invisible

    // Align to device pixel for crisp 1px stroke regardless of zoom
    let sx = 1;
    try {
      const m = ctx.getTransform?.();
      if (m) {
        // scaleX as hypot of a,b to account for rotations
        sx = Math.max(1e-6, Math.hypot(m.a, m.b));
      }
    } catch {}
    const lineWidth = 1 / sx;
    const xAligned = Math.round(caretX * sx) / sx + 0.5 / sx;

    ctx.beginPath();
    ctx.moveTo(xAligned, caretY);
    ctx.lineTo(xAligned, caretY + caretHeight);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.lineCap = "butt";
    ctx.stroke();
  } finally {
    ctx.restore();
  }
}

export function installCustomCaret() {
  if (!fabric || !fabric.IText) return;
  const render = function (ctx) {
    drawCaret(ctx, this);
  };
  try {
    // Override both IText and Textbox
    fabric.IText.prototype.renderCursor = render;
  } catch {}
  try {
    if (fabric.Textbox) {
      fabric.Textbox.prototype.renderCursor = render;
    }
  } catch {}

  // Force-hide hiddenTextarea right after Fabric tries to (re)position or create it
  const hideTA = (ta) => {
    if (!ta) return;
    try {
      ta.setAttribute("data-fabric-hidden-textarea", "1");
      ta.style.position = "fixed";
      ta.style.top = "-100000px";
      ta.style.left = "-100000px";
      ta.style.width = "0";
      ta.style.height = "0";
      ta.style.opacity = "0";
      ta.style.pointerEvents = "none";
      ta.style.caretColor = "transparent";
      ta.style.color = "transparent";
      ta.style.background = "transparent";
      ta.style.border = "0";
      ta.style.outline = "none";
    } catch {}
  };
  const wrap = (proto, name) => {
    const orig = proto[name];
    if (typeof orig !== "function") return;
    proto[name] = function (...args) {
      const res = orig.apply(this, args);
      try {
        hideTA(this.hiddenTextarea);
      } catch {}
      return res;
    };
  };
  try {
    wrap(fabric.IText.prototype, "updateTextareaPosition");
  } catch {}
  try {
    wrap(fabric.IText.prototype, "initHiddenTextarea");
  } catch {}
  try {
    fabric.Textbox && wrap(fabric.Textbox.prototype, "updateTextareaPosition");
  } catch {}
  try {
    fabric.Textbox && wrap(fabric.Textbox.prototype, "initHiddenTextarea");
  } catch {}
}

// auto-install when this module is imported
installCustomCaret();

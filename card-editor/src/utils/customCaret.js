import * as fabric from "fabric";

function hideHiddenTextarea(ta) {
  if (!ta) return;

  try {
    ta.setAttribute("data-fabric-hidden-textarea", "1");
    ta.style.position = "fixed";
    ta.style.top = "-100000px";
    ta.style.left = "-100000px";
    ta.style.width = "0";
    ta.style.height = "0";
    ta.style.minWidth = "0";
    ta.style.minHeight = "0";
    ta.style.padding = "0";
    ta.style.margin = "0";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    ta.style.caretColor = "transparent";
    ta.style.color = "transparent";
    ta.style.background = "transparent";
    ta.style.border = "0";
    ta.style.outline = "none";
    ta.style.overflow = "hidden";
    ta.style.transform = "translate3d(-100000px, -100000px, 0)";
    ta.style.zIndex = "-1";
  } catch {}
}

function wrapTextareaMethod(proto, name) {
  const original = proto?.[name];
  if (typeof original !== "function" || original.__cardEditorWrapped) return;

  const wrapped = function (...args) {
    const result = original.apply(this, args);
    hideHiddenTextarea(this.hiddenTextarea);
    return result;
  };

  wrapped.__cardEditorWrapped = true;
  proto[name] = wrapped;
}

export function installCustomCaret() {
  if (!fabric?.IText) return;

  const disableFabricCursor = function () {};

  try {
    fabric.IText.prototype.renderCursor = disableFabricCursor;
  } catch {}
  try {
    if (fabric.Textbox) fabric.Textbox.prototype.renderCursor = disableFabricCursor;
  } catch {}

  wrapTextareaMethod(fabric.IText.prototype, "updateTextareaPosition");
  wrapTextareaMethod(fabric.IText.prototype, "initHiddenTextarea");
  if (fabric.Textbox) {
    wrapTextareaMethod(fabric.Textbox.prototype, "updateTextareaPosition");
    wrapTextareaMethod(fabric.Textbox.prototype, "initHiddenTextarea");
  }
}

installCustomCaret();

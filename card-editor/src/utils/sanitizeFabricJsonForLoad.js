const isTextLikeNode = (node) => {
  const type = typeof node?.type === "string" ? node.type.toLowerCase() : "";
  if (type === "text" || type === "i-text" || type === "textbox") return true;
  if (type.includes("text")) return true;

  return (
    Object.prototype.hasOwnProperty.call(node, "text") ||
    Object.prototype.hasOwnProperty.call(node, "styles") ||
    Object.prototype.hasOwnProperty.call(node, "fontFamily") ||
    Object.prototype.hasOwnProperty.call(node, "fontSize")
  );
};

export const sanitizeFabricJsonForLoad = (jsonInput, { clone = true } = {}) => {
  if (!jsonInput || typeof jsonInput !== "object") return jsonInput;

  let root = jsonInput;
  if (clone) {
    try {
      root = JSON.parse(JSON.stringify(jsonInput));
    } catch {
      root = jsonInput;
    }
  }

  const visited = new WeakSet();

  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (visited.has(node)) return;
    visited.add(node);

    if (isTextLikeNode(node)) {
      if (typeof node.text !== "string") {
        if (Array.isArray(node.textLines) && node.textLines.length > 0) {
          node.text = node.textLines.map((line) => String(line ?? "")).join("\n");
        } else {
          node.text = node.text == null ? "" : String(node.text);
        }
      }

      if (node.styles == null || typeof node.styles !== "object" || Array.isArray(node.styles)) {
        node.styles = {};
      }

      if (node.fontFamily != null && typeof node.fontFamily !== "string") {
        node.fontFamily = String(node.fontFamily);
      }
    }

    Object.values(node).forEach((value) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry && typeof entry === "object") {
            visit(entry);
          }
        });
        return;
      }
      visit(value);
    });
  };

  visit(root);
  return root;
};

export default sanitizeFabricJsonForLoad;

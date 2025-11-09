import express from "express";
import cors from "cors";
import PDFDocument from "pdfkit";
import svgToPdf from "svg-to-pdfkit";

const MM_TO_PT = 72 / 25.4;
const DEFAULT_PORT = Number(process.env.LAYOUT_EXPORT_PORT || 4177);
const ALLOWED_ORIGINS = process.env.LAYOUT_EXPORT_ORIGINS
  ? process.env.LAYOUT_EXPORT_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : null;
const OUTLINE_STROKE_COLOR = "#0000FF";

const app = express();

app.use(
  cors(
    ALLOWED_ORIGINS
      ? { origin: ALLOWED_ORIGINS, credentials: true }
      : { origin: true, credentials: true }
  )
);

app.use(express.json({ limit: "50mb" }));

const mmToPoints = (valueMm = 0) => (Number(valueMm) || 0) * MM_TO_PT;

const escapeForSvg = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const buildFallbackSvgMarkup = (placement, message) => {
  const width = Math.max(Number(placement?.width) || 0, 0);
  const height = Math.max(Number(placement?.height) || 0, 0);
  const label = escapeForSvg(message || "SVG недоступний");

  if (width <= 0 || height <= 0) {
    return null;
  }

  const inset = Math.min(width, height) > 2 ? 0.6 : 0.2;
  const fontSize = Math.min(Math.max(height * 0.18, 2), 6);
  const textY = height - Math.max(fontSize * 0.4, 1.5);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <rect x="${inset}" y="${inset}" width="${Math.max(width - inset * 2, 0)}" height="${Math.max(height - inset * 2, 0)}" fill="none" stroke="${OUTLINE_STROKE_COLOR}" stroke-width="${Math.min(inset * 2, 1)}" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
  <text x="${inset * 2}" y="${textY}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="#404040">${label}</text>
</svg>`;
};

app.post("/api/layout-pdf", async (req, res) => {
  try {
    const { sheets, sheetLabel = "sheet", timestamp } = req.body || {};

    if (!Array.isArray(sheets) || sheets.length === 0) {
      return res.status(400).json({ error: "Очікуємо принаймні один аркуш для експорту." });
    }

    const safeSheetLabel = String(sheetLabel || "sheet").replace(/[^a-z0-9-_]+/gi, "-");
    const fileNameParts = [safeSheetLabel || "sheet"];
    if (timestamp) {
      fileNameParts.push(String(timestamp).replace(/[^0-9-]+/g, ""));
    }
    const fileName = `${fileNameParts.join("-") || "layout"}.pdf`;

    const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    doc.pipe(res);

    sheets.forEach((sheet, sheetIndex) => {
      const pageWidthPt = mmToPoints(sheet?.width);
      const pageHeightPt = mmToPoints(sheet?.height);

      if (!Number.isFinite(pageWidthPt) || !Number.isFinite(pageHeightPt) || pageWidthPt <= 0 || pageHeightPt <= 0) {
        console.warn(`Пропускаємо аркуш ${sheetIndex} через некоректні розміри.`);
        return;
      }

      doc.addPage({ size: [pageWidthPt, pageHeightPt], margin: 0 });

      (sheet.placements || []).forEach((placement, placementIndex) => {
        const widthPt = mmToPoints(placement?.width);
        const heightPt = mmToPoints(placement?.height);
        const xPt = mmToPoints(placement?.x);
        const yTopPt = mmToPoints(placement?.y || 0);

        if (!Number.isFinite(widthPt) || !Number.isFinite(heightPt) || widthPt <= 0 || heightPt <= 0) {
          console.warn(`Пропускаємо елемент ${placementIndex} на аркуші ${sheetIndex} через некоректні розміри.`);
          return;
        }

        if (!Number.isFinite(xPt) || !Number.isFinite(yTopPt)) {
          console.warn(`Пропускаємо елемент ${placementIndex} на аркуші ${sheetIndex} через некоректні координати.`);
          return;
        }

        if (placement?.svgMarkup) {
          try {
            // Логування для діагностики
            if (placement.svgMarkup.includes('<text')) {
              console.log(`SVG містить текст для ${placement?.id || placementIndex}`);
              const textMatch = placement.svgMarkup.match(/<text[^>]*>/);
              if (textMatch) {
                console.log('Приклад тегу text:', textMatch[0]);
              }
            }
            
            svgToPdf(doc, placement.svgMarkup, xPt, yTopPt, {
              assumePt: false,
              width: widthPt,
              height: heightPt,
              preserveAspectRatio: "xMidYMid meet",
            });
            return;
          } catch (error) {
            console.error(`Не вдалося відрендерити SVG для ${placement?.id || placementIndex}`, error);
          }
        }

        const fallbackMarkup = buildFallbackSvgMarkup(placement, placement?.svgMarkup ? "SVG недоступний" : "SVG відсутній");
        if (fallbackMarkup) {
          try {
            svgToPdf(doc, fallbackMarkup, xPt, yTopPt, {
              assumePt: false,
              width: widthPt,
              height: heightPt,
              preserveAspectRatio: "xMidYMid meet",
            });
            return;
          } catch (error) {
            console.error(`Не вдалося відрендерити fallback SVG для ${placement?.id || placementIndex}`, error);
          }
        }

        // Якщо fallback SVG теж не вдався, малюємо мінімальний прямокутник у класичній системі координат.
        const yBottomPt = pageHeightPt - mmToPoints((placement?.y || 0) + (placement?.height || 0));
        doc.save();
        doc.lineWidth(1);
        doc.strokeColor(OUTLINE_STROKE_COLOR);
        doc.rect(xPt, yBottomPt, widthPt, heightPt).stroke();
        doc.restore();
      });
    });

    doc.end();
  } catch (error) {
    console.error("Помилка експорту PDF", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Не вдалося створити PDF." });
    } else {
      res.end();
    }
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(DEFAULT_PORT, () => {
  console.log(`Layout export server запущено на порту ${DEFAULT_PORT}`);
  if (ALLOWED_ORIGINS) {
    console.log(`Дозволені домени: ${ALLOWED_ORIGINS.join(", ")}`);
  }
});

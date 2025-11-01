import React, { useState, useEffect } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import * as fabric from "fabric";
import styles from "./ShapeProperties.module.css";

// Semiround: новая логика заокругления — как у прямоугольника (roundedCorners), но с верхней дугой
export const makeRoundedSemiRoundPath = (w, h, r) => {
  // Верхняя дуга — полуокружность
  const k = 0.5522847498307936;
  const radius = w / 2;
  const cx = w / 2;
  const cy = 0;
  // Увеличиваем максимальный радиус для более сильного скругления
  const maxR = Math.min(h * 0.9, w * 0.49); // было h/2, w/4
  const rClamped = Math.max(0, Math.min(r || 0, maxR));

  // Ключевые точки
  const left = 0;
  const right = w;
  const top = 0;
  const bottom = h;

  // Верхняя дуга (полуокружность)
  const c1x = left;
  const c1y = top + radius - k * radius;
  const c2x = cx - k * radius;
  const c2y = cy;
  const c3x = cx + k * radius;
  const c3y = cy;
  const c4x = right;
  const c4y = top + radius - k * radius;

  let d = "";
  // Старт с нижнего левого скругленного угла
  if (rClamped > 0) {
    d += `M ${left + rClamped} ${bottom}`;
    d += `Q ${left} ${bottom} ${left} ${bottom - rClamped}`;
  } else {
    d += `M ${left} ${bottom}`;
  }
  // Левая вертикаль вверх до дуги
  d += `L ${left} ${top + radius}`;
  // Верхняя полуокружность (две Безье)
  d += `C ${c1x} ${c1y} ${c2x} ${c2y} ${cx} ${cy}`;
  d += `C ${c3x} ${c3y} ${c4x} ${c4y} ${right} ${top + radius}`;
  // Правая вертикаль вниз
  d += `L ${right} ${bottom - rClamped}`;
  // Нижний правый угол
  if (rClamped > 0) {
    d += `Q ${right} ${bottom} ${right - rClamped} ${bottom}`;
  } else {
    d += `L ${right} ${bottom}`;
  }
  // Нижняя горизонталь
  d += `L ${left + rClamped} ${bottom}`;
  d += "Z";
  return d;
};

const ShapeProperties = ({
  isOpen: propIsOpen,
  activeShape: propActiveShape,
  onClose: propOnClose,
}) => {
  const { canvas, shapePropertiesOpen, setShapePropertiesOpen, globalColors } =
    useCanvasContext();

  // Використовуємо пропси якщо вони передані (з ShapeSelector), інакше контекст
  const isOpen = propIsOpen !== undefined ? propIsOpen : shapePropertiesOpen;
  const activeShape = propActiveShape || null;
  const onClose = propOnClose || (() => setShapePropertiesOpen(false));

  const [properties, setProperties] = useState({
    width: 0, // mm
    height: 0, // mm
    rotation: 0,
    cornerRadius: 0,
    thickness: 1, // mm
    fill: false,
    cut: false,
  });

  const [isManuallyEditing, setIsManuallyEditing] = useState(false);
  // Запам'ятовуємо попередню товщину перед увімкненням Cut, щоб відновити її після вимкнення Cut
  const [prevThicknessBeforeCut, setPrevThicknessBeforeCut] = useState(null);

  const activeObject = activeShape || canvas?.getActiveObject();

  // Якщо фігура прийшла з ShapeSelector і ще не визначила режим темної заливки — відключаємо її
  useEffect(() => {
    if (!activeObject) return;
    const fromShapeTab =
      activeObject.fromShapeTab === true ||
      (activeObject.data && activeObject.data.fromShapeTab === true);
    if (!fromShapeTab) return;
    if (activeObject.useThemeColor === undefined) {
      try {
        activeObject.set({ useThemeColor: false });
      } catch {
        activeObject.useThemeColor = false;
      }
    }
    if (activeObject.followThemeStroke === undefined) {
      activeObject.followThemeStroke = true;
    }
    if (
      activeObject.pendingShapePropsDefaults &&
      typeof activeObject.pendingShapePropsDefaults === "object"
    ) {
      const defaults = activeObject.pendingShapePropsDefaults;
      if (defaults.fill === false) {
        try {
          activeObject.set({ fill: "transparent", useThemeColor: false });
        } catch {
          activeObject.fill = "transparent";
          activeObject.useThemeColor = false;
        }
      }
      if (defaults.cut === false) {
        try {
          activeObject.set({ isCutElement: false, cutType: null });
        } catch {
          activeObject.isCutElement = false;
          activeObject.cutType = null;
        }
      }
      delete activeObject.pendingShapePropsDefaults;
      if (canvas && typeof canvas.requestRenderAll === "function") {
        canvas.requestRenderAll();
      }
    }
    if (
      activeObject.initialFillColor === undefined &&
      typeof activeObject.fill === "string"
    ) {
      activeObject.initialFillColor = activeObject.fill;
    }
    if (
      activeObject.initialStrokeColor === undefined &&
      typeof activeObject.stroke === "string"
    ) {
      activeObject.initialStrokeColor = activeObject.stroke;
    }
  }, [activeObject]);

  // Unit conversion (96 DPI)
  const PX_PER_MM = 96 / 25.4;
  // Демпфер чутливості для Corner Radius: 1 = без згладжування
  const RADIUS_DAMPING = 1;
  const mmToPx = (mm) => (typeof mm === "number" ? mm * PX_PER_MM : 0);
  const pxToMm = (px) => (typeof px === "number" ? px / PX_PER_MM : 0);
  const roundMm = (mm) => Math.round((mm || 0) * 10) / 10;

  const buildRoundedPolygonPath = (points, radius, options) => {
    if (!points || points.length < 3) return "";
    const { clampFactor = 0.5 } = options || {};
    const n = points.length;
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      area += a.x * b.y - b.x * a.y;
    }
    const ccw = area > 0;
    const rMaxGlobal = clampRadiusForEdges(points, radius, clampFactor);
    if (rMaxGlobal <= 0) {
      let d0 = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < n; i++) d0 += ` L ${points[i].x} ${points[i].y}`;
      d0 += " Z";
      return d0;
    }
    let d = "";
    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const curr = points[i];
      const next = points[(i + 1) % n];
      const v1x = curr.x - prev.x,
        v1y = curr.y - prev.y;
      const v2x = next.x - curr.x,
        v2y = next.y - curr.y;
      const len1 = Math.hypot(v1x, v1y) || 1;
      const len2 = Math.hypot(v2x, v2y) || 1;
      const u1x = v1x / len1,
        u1y = v1y / len1;
      const u2x = v2x / len2,
        u2y = v2y / len2;
      const cross = u1x * u2y - u1y * u2x;
      const isConvex = ccw ? cross > 0 : cross < 0;
      const rLocal = Math.max(
        0,
        Math.min(
          rMaxGlobal,
          len1 * clampFactor - 0.001,
          len2 * clampFactor - 0.001
        )
      );
      if (!isConvex || rLocal <= 0) {
        if (i === 0) d += `M ${curr.x} ${curr.y}`;
        else d += ` L ${curr.x} ${curr.y}`;
        continue;
      }
      const p1x = curr.x - u1x * rLocal;
      const p1y = curr.y - u1y * rLocal;
      const p2x = curr.x + u2x * rLocal;
      const p2y = curr.y + u2y * rLocal;
      if (i === 0) d += `M ${p1x} ${p1y}`;
      else d += ` L ${p1x} ${p1y}`;
      d += ` Q ${curr.x} ${curr.y} ${p2x} ${p2y}`;
    }
    d += " Z";
    return d;
  };

  const makeRoundedHexagonPath = (w, h, r) => {
    const pts = [
      { x: w * 0.25, y: 0 },
      { x: w * 0.75, y: 0 },
      { x: w, y: h * 0.5 },
      { x: w * 0.75, y: h },
      { x: w * 0.25, y: h },
      { x: 0, y: h * 0.5 },
    ];
    return buildRoundedPolygonPath(pts, r);
  };
  const makeRoundedOctagonPath = (w, h, r) => {
    const pts = [
      { x: w * 0.3, y: 0 },
      { x: w * 0.7, y: 0 },
      { x: w, y: h * 0.3 },
      { x: w, y: h * 0.7 },
      { x: w * 0.7, y: h },
      { x: w * 0.3, y: h },
      { x: 0, y: h * 0.7 },
      { x: 0, y: h * 0.3 },
    ];
    return buildRoundedPolygonPath(pts, r);
  };
  const makeRoundedTrianglePath = (w, h, r) => {
    const pts = [
      { x: w / 2, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];
    return buildRoundedPolygonPath(pts, r);
  };
  // Warning triangle: ручной билд без лишних боковых линий, скругляем лишь 3 угла
  const makeRoundedWarningTrianglePath = (w, h, r) => {
    // Ключевые точки фигуры по пропорциям из палитры
    const L1 = { x: 0, y: h * 0.62 }; // верхняя точка левого борта
    const L2 = { x: 0, y: h }; // нижний левый угол
    const R2 = { x: w, y: h }; // нижний правый угол
    const R1 = { x: w, y: h * 0.62 }; // верхняя точка правого борта
    const A = { x: w * 0.51, y: 0 }; // верхняя вершина

    const len = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
    const unit = (p, q) => {
      const dx = q.x - p.x,
        dy = q.y - p.y;
      const L = Math.hypot(dx, dy) || 1;
      return { x: dx / L, y: dy / L };
    };

    // Длины рёбер
    const lenBottom = len(L2, R2);
    const lenRight = len(R2, R1);
    const lenLeft = len(L2, L1);
    const lenARight = len(A, R1);
    const lenALeft = len(A, L1);

    // Единый лимит по половинам рёбер, чтобы не «выкручивало» при больших радиусах
    const eps = 1;
    const rUniform = Math.max(
      0,
      Math.min(
        r || 0,
        (lenBottom - eps) / 2,
        (lenRight - eps) / 2,
        (lenLeft - eps) / 2,
        (lenARight - eps) / 2,
        (lenALeft - eps) / 2
      )
    );

    // Локальные пределы радиуса по 5 углам (A, L1, L2, R2, R1), с запасом на вершины
    const clamp = 0.95;
    const maxBL = Math.min(len(L1, L2), len(L2, R2)) * clamp; // нижний левый
    const maxBR = Math.min(len(R1, R2), len(R2, L2)) * clamp; // нижний правый
    const maxA = Math.min(len(A, L1), len(A, R1)) * clamp; // верхний
    const maxR1 = Math.min(len(R1, A), len(R1, R2)) * clamp; // правое «плечо»
    const maxL1 = Math.min(len(L1, A), len(L1, L2)) * clamp; // левое «плечо»
    let rBL = Math.max(0, Math.min(rUniform, maxBL));
    let rBR = Math.max(0, Math.min(rUniform, maxBR));
    let rA = Math.max(0, Math.min(rUniform, maxA));
    let rR1 = Math.max(0, Math.min(rUniform, maxR1));
    let rL1 = Math.max(0, Math.min(rUniform, maxL1));

    // Итеративно ужимаем радиусы под доступные длины (обеспечиваем монотонность на рёбрах)
    for (let i = 0; i < 6; i++) {
      rBL = Math.max(
        0,
        Math.min(rBL, maxBL, lenBottom - rBR - eps, lenLeft - rL1 - eps)
      );
      rBR = Math.max(
        0,
        Math.min(rBR, maxBR, lenBottom - rBL - eps, lenRight - rR1 - eps)
      );
      rR1 = Math.max(
        0,
        Math.min(rR1, maxR1, lenRight - rBR - eps, lenARight - rA - eps)
      );
      rL1 = Math.max(
        0,
        Math.min(rL1, maxL1, lenLeft - rBL - eps, lenALeft - rA - eps)
      );
      rA = Math.max(
        0,
        Math.min(rA, maxA, lenARight - rR1 - eps, lenALeft - rL1 - eps)
      );
    }

    // Точки входа/выхода дуг для трёх углов
    // Низ левый (L2): между L1->L2 (вниз) и L2->R2 (вправо)
    const uL21 = unit(L2, L1); // вверх по левому борту
    const uL22 = unit(L2, R2); // вправо по низу
    const P_bl1 = { x: L2.x + uL21.x * rBL, y: L2.y + uL21.y * rBL }; // на левом борту выше на rBL
    const P_bl2 = { x: L2.x + uL22.x * rBL, y: L2.y + uL22.y * rBL }; // на нижнем ребре правее на rBL

    // Низ правый (R2): между R1->R2 (вниз) и R2->L2 (влево)
    const uR21 = unit(R2, R1); // вверх по правому борту
    const uR22 = unit(R2, L2); // влево по низу
    const P_br1 = { x: R2.x + uR22.x * rBR, y: R2.y + uR22.y * rBR }; // на нижнем ребре левее на rBR
    const P_br2 = { x: R2.x + uR21.x * rBR, y: R2.y + uR21.y * rBR }; // на правом борту выше на rBR

    // Верхняя вершина (A): между A->R1 и A->L1
    const uA1 = unit(A, R1);
    const uA2 = unit(A, L1);
    const P_a2 = { x: A.x + uA1.x * rA, y: A.y + uA1.y * rA }; // на ребре A->R1
    const P_a1 = { x: A.x + uA2.x * rA, y: A.y + uA2.y * rA }; // на ребре A->L1

    // Плавное «втопление»: сначала обычное скругление (контроль в вершине),
    // затем лёгкий заход внутрь по мере роста радиуса (smoothstep)
    const centroid = {
      x: (L1.x + L2.x + R2.x + R1.x + A.x) / 5,
      y: (L1.y + L2.y + R2.y + R1.y + A.y) / 5,
    };
    const norm = (v) => {
      const L = Math.hypot(v.x, v.y) || 1;
      return { x: v.x / L, y: v.y / L };
    };
    const bisectorIn = (prev, V, next) => {
      const u1 = norm({ x: prev.x - V.x, y: prev.y - V.y });
      const u2 = norm({ x: next.x - V.x, y: next.y - V.y });
      let b = { x: u1.x + u2.x, y: u1.y + u2.y };
      let d = norm(b);
      const toC = { x: centroid.x - V.x, y: centroid.y - V.y };
      if (d.x * toC.x + d.y * toC.y < 0) d = { x: -d.x, y: -d.y };
      return d;
    };
    // Порог и максимум для захода внутрь
    const BULGE_START = 4; // px — до этого только обычное скругление
    const BULGE_FULL = 12; // px — к этому радиусу достигаем полной силы
    const BULGE_K_MAX = 0.25; // доля радиуса для лёгкого смещения контроля внутрь
    const smoothstep = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
    const bulgeDist = (rc) => {
      if (!rc || rc <= 0) return 0;
      const t = smoothstep((rc - BULGE_START) / (BULGE_FULL - BULGE_START));
      return rc * BULGE_K_MAX * t;
    };
    const dir_bl = bisectorIn(L1, L2, R2);
    const C_bl = (() => {
      const d = bulgeDist(rBL);
      return { x: L2.x + dir_bl.x * d, y: L2.y + dir_bl.y * d };
    })();
    const dir_br = bisectorIn(R1, R2, L2);
    const C_br = (() => {
      const d = bulgeDist(rBR);
      return { x: R2.x + dir_br.x * d, y: R2.y + dir_br.y * d };
    })();
    const dir_r1 = bisectorIn(R2, R1, A);
    const C_r1 = (() => {
      const d = bulgeDist(rR1);
      return { x: R1.x + dir_r1.x * d, y: R1.y + dir_r1.y * d };
    })();
    const dir_a = bisectorIn(R1, A, L1);
    const C_a = (() => {
      const d = bulgeDist(rA);
      return { x: A.x + dir_a.x * d, y: A.y + dir_a.y * d };
    })();
    const dir_l1 = bisectorIn(A, L1, L2);
    const C_l1 = (() => {
      const d = bulgeDist(rL1);
      return { x: L1.x + dir_l1.x * d, y: L1.y + dir_l1.y * d };
    })();

    // Строим замкнутый контур, избегая лишних вершин посередине рёбер
    let d = ``;
    // старт: если rBL>0 — сдвигаемся на P_bl2, иначе от самого угла L2
    if (rBL > 0) d += `M ${P_bl2.x} ${P_bl2.y}`;
    else d += `M ${L2.x} ${L2.y}`;

    // низ -> правый низ
    if (rBR > 0) {
      d += ` L ${P_br1.x} ${P_br1.y}`;
      if (
        P_br1.x === R2.x &&
        P_br1.y === R2.y &&
        P_br2.x === R2.x &&
        P_br2.y === R2.y
      ) {
        d += ` L ${R2.x} ${R2.y}`;
      } else {
        d += ` Q ${C_br.x} ${C_br.y} ${P_br2.x} ${P_br2.y}`;
      }
    } else {
      d += ` L ${R2.x} ${R2.y}`;
    }

    // Правая стенка и плечо R1
    const uR1_in = unit(R1, R2);
    const uR1_out = unit(R1, A);
    const P_r1_before = { x: R1.x + uR1_in.x * rR1, y: R1.y + uR1_in.y * rR1 };
    const P_r1_after = { x: R1.x + uR1_out.x * rR1, y: R1.y + uR1_out.y * rR1 };
    if (rR1 > 0) {
      d += ` L ${P_r1_before.x} ${P_r1_before.y}`;
      if (
        P_r1_before.x === R1.x &&
        P_r1_before.y === R1.y &&
        P_r1_after.x === R1.x &&
        P_r1_after.y === R1.y
      ) {
        d += ` L ${R1.x} ${R1.y}`;
      } else {
        d += ` Q ${C_r1.x} ${C_r1.y} ${P_r1_after.x} ${P_r1_after.y}`;
      }
    } else {
      d += ` L ${R1.x} ${R1.y}`;
    }

    // Верхняя вершина A
    if (rA > 0) {
      d += ` L ${P_a2.x} ${P_a2.y}`;
      if (
        P_a2.x === A.x &&
        P_a2.y === A.y &&
        P_a1.x === A.x &&
        P_a1.y === A.y
      ) {
        d += ` L ${A.x} ${A.y}`;
      } else {
        d += ` Q ${C_a.x} ${C_a.y} ${P_a1.x} ${P_a1.y}`;
      }
    } else {
      d += ` L ${A.x} ${A.y}`;
    }

    // Левая стенка и плечо L1
    const uL1_in = unit(L1, A);
    const uL1_out = unit(L1, L2);
    const P_l1_before = { x: L1.x + uL1_in.x * rL1, y: L1.y + uL1_in.y * rL1 };
    const P_l1_after = { x: L1.x + uL1_out.x * rL1, y: L1.y + uL1_out.y * rL1 };
    if (rL1 > 0) {
      d += ` L ${P_l1_before.x} ${P_l1_before.y}`;
      if (
        P_l1_before.x === L1.x &&
        P_l1_before.y === L1.y &&
        P_l1_after.x === L1.x &&
        P_l1_after.y === L1.y
      ) {
        d += ` L ${L1.x} ${L1.y}`;
      } else {
        d += ` Q ${C_l1.x} ${C_l1.y} ${P_l1_after.x} ${P_l1_after.y}`;
      }
    } else {
      d += ` L ${L1.x} ${L1.y}`;
    }

    // Нижний левый угол и замыкание
    if (rBL > 0) {
      d += ` L ${P_bl1.x} ${P_bl1.y}`;
      if (
        P_bl1.x === L2.x &&
        P_bl1.y === L2.y &&
        P_bl2.x === L2.x &&
        P_bl2.y === L2.y
      ) {
        d += ` L ${L2.x} ${L2.y}`;
      } else {
        d += ` Q ${C_bl.x} ${C_bl.y} ${P_bl2.x} ${P_bl2.y}`;
      }
    } else {
      d += ` L ${L2.x} ${L2.y}`;
    }
    d += ` Z`;
    return d;
  };
  const makeRoundedArrowLeftPath = (w, h, r) => {
    const pts = [
      { x: 0, y: h * 0.5625 },
      { x: w * 0.25, y: h * 0.1875 },
      { x: w * 0.25, y: h * 0.375 },
      { x: w, y: h * 0.375 },
      { x: w, y: h * 0.75 },
      { x: w * 0.25, y: h * 0.75 },
      { x: w * 0.25, y: h * 0.9375 },
    ];
    return buildRoundedPolygonPath(pts, r);
  };
  const makeRoundedArrowRightPath = (w, h, r) => {
    const pts = [
      { x: w, y: h * 0.5625 },
      { x: w * 0.75, y: h * 0.1875 },
      { x: w * 0.75, y: h * 0.375 },
      { x: 0, y: h * 0.375 },
      { x: 0, y: h * 0.75 },
      { x: w * 0.75, y: h * 0.75 },
      { x: w * 0.75, y: h * 0.9375 },
    ];
    return buildRoundedPolygonPath(pts, r);
  };

  // Хелпер для ограничения радиуса по рёбрам (локально, чтобы не зависеть от Toolbar)
  const clampRadiusForEdges = (points, r) => {
    if (!r || r <= 0) return 0;
    let minEdge = Infinity;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len > 0) minEdge = Math.min(minEdge, len);
    }
    const maxR = Math.max(0, minEdge / 2 - 0.001);
    return Math.max(0, Math.min(r, maxR));
  };

  // Перевірка підтримки скруглення для path-фігур (стрілки ліворуч/праворуч — виключені)
  const supportsCornerRadiusForPath = (obj) => {
    const t = obj?.shapeType;
    return (
      obj?.type === "path" &&
      [
        "hexagon",
        "octagon",
        "triangle",
        "warningTriangle",
        "semiround",
        "roundTop",
        "turnLeft",
        "turnRight",
      ].includes(t)
    );
  };

  // RoundTop: используем ту же логику (дуга сверху + скругление только нижних углов)
  const makeRoundedRoundTopPath = (w, h, r) => {
    return makeRoundedSemiRoundPath(w, h, r);
  };

  // Turn Left: аппроксимація ламаною з оригінального шляху з очень сильним скругленням
  const makeRoundedTurnLeftPath = (w, h, r) => {
    // 5 ключевых точек, как раньше
    const pts = [
      { x: w * 0.325, y: h },
      { x: w, y: h },
      { x: w, y: 0 },
      { x: w * 0.3, y: 0 },
      { x: 0, y: h * 0.51 },
    ];
    // Максимальный радиус — почти до половины min(w, h), чтобы форма была максимально округлой
    const maxR = Math.min(w, h) * 0.49;
    const rClamped = Math.max(0, Math.min(r || 0, maxR));
    return buildRoundedPolygonPath(pts, rClamped);
  };

  // Turn Right: аппроксимація ламаною з оригінального шляху с дуже сильним скругленням
  const makeRoundedTurnRightPath = (w, h, r) => {
    const pts = [
      { x: w * 0.675, y: h },
      { x: 0, y: h },
      { x: 0, y: 0 },
      { x: w * 0.7, y: 0 },
      { x: w, y: h * 0.51 },
    ];
    const maxR = Math.min(w, h) * 0.49;
    const rClamped = Math.max(0, Math.min(r || 0, maxR));
    return buildRoundedPolygonPath(pts, rClamped);
  };

  // Маппінг shapeType -> builder для заокруглення path-фігур
  const roundedBuilders = {
    hexagon: makeRoundedHexagonPath,
    octagon: makeRoundedOctagonPath,
    triangle: makeRoundedTrianglePath,
    warningTriangle: makeRoundedWarningTrianglePath,
    semiround: makeRoundedSemiRoundPath,
    roundTop: makeRoundedRoundTopPath,
    turnLeft: makeRoundedTurnLeftPath,
    turnRight: makeRoundedTurnRightPath,
  };

  // Утиліта: застосувати радіус до існуючого Path без пересоздання об'єкта
  const applyCornerRadiusToPathShape = (obj, rPx) => {
    if (!obj || obj.type !== "path") return;
    if (obj.shapeType === "semiround") {
      // Використовуємо тільки квадратну область (ширина = висота)
      const size =
        obj.height ||
        (obj.getScaledHeight ? obj.getScaledHeight() / (obj.scaleY || 1) : 0) ||
        0;
      const currentScale = Math.min(obj.scaleX || 1, obj.scaleY || 1) || 1;
      const rLocal = (rPx || 0) / currentScale;
      const d = makeRoundedSemiRoundPath(size, size, rLocal);
      if (!d) return;
      try {
        const temp = new fabric.Path(d);
        obj.set({
          path: temp.path,
          pathOffset: temp.pathOffset,
          baseCornerRadius: rLocal,
        });
      } catch {}
      return;
    }
    const builder = roundedBuilders[obj.shapeType];
    if (!builder) return;
    const baseW =
      obj.width ||
      (obj.getScaledWidth ? obj.getScaledWidth() / (obj.scaleX || 1) : 0) ||
      0;
    const baseH =
      obj.height ||
      (obj.getScaledHeight ? obj.getScaledHeight() / (obj.scaleY || 1) : 0) ||
      0;
    const currentScale = Math.min(obj.scaleX || 1, obj.scaleY || 1) || 1;
    const rLocalDesired = (rPx || 0) / currentScale;

    // Для semiround и roundTop — особые ограничения радиуса (только по ширине)
    let rLocal;
    if (obj.shapeType === "semiround" || obj.shapeType === "roundTop") {
      rLocal = Math.max(0, Math.min(rLocalDesired, baseW / 4 - 0.001));
    } else {
      rLocal = Math.max(
        0,
        Math.min(rLocalDesired, Math.min(baseW, baseH) / 2 - 0.001)
      );
    }

    let d;
    if (obj.shapeType === "semiround") {
      // Використовуємо завжди baseH як ширину і висоту, як у ShapeSelector
      d = makeRoundedSemiRoundPath(baseH, baseH, rLocal);
    } else {
      d = builder(baseW, baseH, rLocal);
    }
    if (!d) return;
    try {
      const temp = new fabric.Path(d);
      obj.set({
        path: temp.path,
        pathOffset: temp.pathOffset,
        baseCornerRadius: rLocal,
      });
    } catch {}
  };

  // Поточний радіус кутів у мм: для Rect беремо rx з урахуванням масштабу
  const getCornerRadiusMmForRounded = (obj) => {
    // Если ранее мы сохранили дисплейное значение — используем его
    if (typeof obj.displayCornerRadiusMm === "number") {
      return Math.max(0, Math.round(obj.displayCornerRadiusMm));
    }
    // Резервне поле: кутовий радіус у міліметрах
    if (typeof obj.cornerRadiusMm === "number") {
      return Math.max(0, Math.round(obj.cornerRadiusMm));
    }
    if (obj.type === "rect") {
      const scale = Math.min(obj.scaleX || 1, obj.scaleY || 1);
      const rPx = (obj.rx || 0) * scale;
      return Math.round(pxToMm(rPx));
    }
    // fallback
    const scale = Math.min(obj.scaleX || 1, obj.scaleY || 1);
    const rPx = (obj.baseCornerRadius || 0) * scale;
    return Math.round(pxToMm(rPx));
  };

  useEffect(() => {
    if (activeObject && (isOpen || shapePropertiesOpen)) {
      // Функція для оновлення властивостей
      const updateProperties = () => {
        // Не оновлюємо якщо користувач зараз редагує вручну
        if (!isManuallyEditing) {
          const isManualCut =
            !!activeObject.isCutElement || activeObject.cutType === "manual";
          const supportedPathShapes = new Set([
            "roundedCorners",
            "rectangle",
            "hexagon",
            "octagon",
            "triangle",
            "warningTriangle",
            "semiround",
            "roundTop",
            "turnLeft",
            "turnRight",
          ]);
          const fillVal = activeObject.fill;
          const hasFill =
            typeof fillVal === "string" &&
            fillVal !== "" &&
            fillVal !== "transparent" &&
            fillVal !== "none";
          setProperties({
            width: roundMm(pxToMm(activeObject.getScaledWidth() || 0)),
            height: roundMm(pxToMm(activeObject.getScaledHeight() || 0)),
            rotation: Math.round(activeObject.angle || 0),
            cornerRadius:
              activeObject.type === "rect" ||
              supportedPathShapes.has(activeObject.shapeType)
                ? getCornerRadiusMmForRounded(activeObject)
                : 0,
            thickness: roundMm(pxToMm(activeObject.strokeWidth || 2)),
            // При активному Cut (manual) считаем Fill выключенным в UI
            fill: !isManualCut && hasFill,
            cut: isManualCut,
          });
        }
      };

      // Оновлюємо властивості при зміні activeObject
      updateProperties();

      // Додаємо слухачі подій безпосередньо до об'єкта
      if (activeObject.on) {
        const handleObjectModified = () => updateProperties();
        const handleObjectScaling = () => updateProperties();
        const handleObjectRotating = () => updateProperties();

        activeObject.on("modified", handleObjectModified);
        activeObject.on("scaling", handleObjectScaling);
        activeObject.on("rotating", handleObjectRotating);

        // Прибираємо слухачі при розмонтуванні
        return () => {
          if (activeObject.off) {
            activeObject.off("modified", handleObjectModified);
            activeObject.off("scaling", handleObjectScaling);
            activeObject.off("rotating", handleObjectRotating);
          }
        };
      }
    }
  }, [activeObject, isOpen, shapePropertiesOpen]);

  // Додатковий useEffect для відстеження змін через canvas
  useEffect(() => {
    if (!canvas || !activeObject || !(isOpen || shapePropertiesOpen)) return;

    const updateProperties = () => {
      const currentActiveObject = canvas.getActiveObject();
      if (currentActiveObject === activeObject && !isManuallyEditing) {
        const isManualCut =
          !!activeObject.isCutElement || activeObject.cutType === "manual";
        const supportedPathShapes = new Set([
          "roundedCorners",
          "rectangle",
          "hexagon",
          "octagon",
          "triangle",
          "warningTriangle",
          "semiround",
          "roundTop",
          "turnLeft",
          "turnRight",
        ]);
        const fillVal = activeObject.fill;
        const hasFill =
          typeof fillVal === "string" &&
          fillVal !== "" &&
          fillVal !== "transparent" &&
          fillVal !== "none";
        setProperties({
          width: roundMm(pxToMm(activeObject.getScaledWidth() || 0)),
          height: roundMm(pxToMm(activeObject.getScaledHeight() || 0)),
          rotation: Math.round(activeObject.angle || 0),
          cornerRadius:
            activeObject.type === "rect" ||
            supportedPathShapes.has(activeObject.shapeType)
              ? getCornerRadiusMmForRounded(activeObject)
              : 0,
          thickness: roundMm(pxToMm(activeObject.strokeWidth || 2)),
          fill: !isManualCut && hasFill,
          cut: isManualCut,
        });
      }
    };

    const throttledAfterRender = () => {
      clearTimeout(throttledAfterRender._t);
      throttledAfterRender._t = setTimeout(updateProperties, 50);
    };

    canvas.on("object:modified", updateProperties);
    canvas.on("object:scaling", updateProperties);
    canvas.on("object:rotating", updateProperties);
    canvas.on("object:moving", updateProperties);
    canvas.on("after:render", throttledAfterRender);

    return () => {
      canvas.off("object:modified", updateProperties);
      canvas.off("object:scaling", updateProperties);
      canvas.off("object:rotating", updateProperties);
      canvas.off("object:moving", updateProperties);
      canvas.off("after:render", throttledAfterRender);
      if (throttledAfterRender._t) clearTimeout(throttledAfterRender._t);
    };
  }, [canvas, activeObject, isOpen, shapePropertiesOpen, isManuallyEditing]);

  // Коли змінюється активний об'єкт, примусово скидаємо ручне редагування
  // і оновлюємо властивості з нового об'єкта, щоб не переносити попередні значення (товщина тощо)
  useEffect(() => {
    if (!activeObject) return;
    setIsManuallyEditing(false);
    const isManualCut =
      !!activeObject.isCutElement || activeObject.cutType === "manual";
    const supportedPathShapes = new Set([
      "roundedCorners",
      "rectangle",
      "hexagon",
      "octagon",
      "triangle",
      "warningTriangle",
      "semiround",
      "roundTop",
      "turnLeft",
      "turnRight",
    ]);
    const fillVal = activeObject.fill;
    const hasFill =
      typeof fillVal === "string" &&
      fillVal !== "" &&
      fillVal !== "transparent" &&
      fillVal !== "none";
    setProperties({
      width: roundMm(pxToMm(activeObject.getScaledWidth() || 0)),
      height: roundMm(pxToMm(activeObject.getScaledHeight() || 0)),
      rotation: Math.round(activeObject.angle || 0),
      cornerRadius:
        activeObject.type === "rect" ||
        supportedPathShapes.has(activeObject.shapeType)
          ? getCornerRadiusMmForRounded(activeObject)
          : 0,
      thickness: roundMm(pxToMm(activeObject.strokeWidth || 2)),
      fill: !isManualCut && hasFill,
      cut: isManualCut,
    });
  }, [activeObject]);

  // Реакция на смену цветовой темы: если Fill активен у фигуры (не cut shape), обновить fill под новый textColor
  useEffect(() => {
    if (!canvas || !activeObject) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    // Не трогаем врожденные cut-элементы из CUT-селектора
    const isCutShape = obj.isCutElement && obj.cutType === "shape";
    if (isCutShape) return;
    // Если включен Cut manual — оставляем белую заливку
    if (obj.isCutElement && obj.cutType === "manual") return;
  // Якщо фігура відмовилась від темної заливки — не примушуємо зміну кольору
  if (obj.useThemeColor !== true) return;
    // Якщо у об'єкта активний Fill — синхронізуємо із темою
    const themeText = globalColors?.textColor || "#000000";
    if (properties.fill) {
      try {
        obj.set({ fill: themeText, useThemeColor: true });
        if (typeof obj.setCoords === "function") obj.setCoords();
        canvas.requestRenderAll();
      } catch {}
    }
  }, [canvas, activeObject, globalColors?.textColor, properties.fill]);

  // Оновлення властивостей активного об'єкта
  const updateProperty = (property, value) => {
    if (!canvas) return;
    // Беремо тільки реальний активний об'єкт із canvas, не використовуємо копії з контексту
    const obj =
      typeof canvas.getActiveObject === "function"
        ? canvas.getActiveObject() || null
        : null;
    if (!obj || typeof obj.set !== "function") return;

    // Допоміжні прапорці
    const isArrow =
      obj?.shapeType === "leftArrow" || obj?.shapeType === "rightArrow";

    // Хелпер: зберегти центр об'єкта (для стрілок)
    const holdCenterIfArrow = (applyChange) => {
      if (!isArrow) {
        applyChange(obj);
        return;
      }
      const center = obj.getCenterPoint
        ? obj.getCenterPoint()
        : { x: obj.left, y: obj.top };
      applyChange(obj);
      if (obj.setPositionByOrigin) {
        obj.setPositionByOrigin(center, "center", "center");
      } else {
        obj.set({ left: center.x, top: center.y });
      }
    };

    // Дозволяємо зміну Fill навіть якщо Cut активний

    // Corner Radius: приводимо к целому неотрицательному
    if (property === "cornerRadius") {
      // Целые и в диапазоне [0..30] мм
      value = Math.max(0, Math.min(30, Math.round(value || 0)));
    }
    // Локально оновлюємо стан, щоб інпут одразу відображав нове значення
    // Для кола синхронізуємо ширину і висоту між собою
    const isCircleLocal =
      obj?.type === "circle" ||
      obj?.isCircle === true ||
      obj?.shapeType === "round";
    setProperties((prev) => {
      if (isCircleLocal && (property === "width" || property === "height")) {
        return { ...prev, width: value, height: value };
      }
      return { ...prev, [property]: value };
    });

    switch (property) {
      case "width": {
        const targetPx = Math.max(0, mmToPx(value));
        // Для halfCircle використовуємо стабільну базу ширини (bbox), щоб уникати стрибка
        const isHalf = obj.shapeType === "halfCircle";
        const baseW = isHalf
          ? obj.__baseBBoxW || obj.width || obj.getScaledWidth() || 1
          : obj.width || obj.getScaledWidth() || 1;
        const newScaleX = targetPx / baseW;
        holdCenterIfArrow((o) => {
          o.set({ scaleX: newScaleX });
          // Для кругових фігур дзеркалимо масштаб по Y, щоб зберегти 1:1
          if (
            o.isCircle === true ||
            o.type === "circle" ||
            o.shapeType === "round" ||
            o.shapeType === "halfCircle"
          ) {
            const sx = Math.abs(o.scaleX || 1);
            o.set({ scaleY: sx });
          }
        });
        break;
      }
      case "height": {
        const targetPx = Math.max(0, mmToPx(value));
        const isHalf = obj.shapeType === "halfCircle";
        // Для halfCircle стабільна база висоти (bbox) — це початковий радіус
        const baseH = isHalf
          ? obj.__baseBBoxH || obj.height || obj.getScaledHeight() || 1
          : obj.height || obj.getScaledHeight() || 1;
        const newScaleY = targetPx / baseH;
        holdCenterIfArrow((o) => {
          o.set({ scaleY: newScaleY });
          // Для кругових фігур дзеркалимо масштаб по X, щоб зберегти 1:1
          if (
            o.isCircle === true ||
            o.type === "circle" ||
            o.shapeType === "round" ||
            o.shapeType === "halfCircle"
          ) {
            const sy = Math.abs(o.scaleY || 1);
            o.set({ scaleX: sy });
          }
        });
        break;
      }
      case "rotation": {
        holdCenterIfArrow((o) => {
          o.set("angle", value || 0);
        });
        break;
      }
      case "cornerRadius": {
        const shapeType = obj.shapeType;
        // Целевой радиус в мм (целое) для отображения и сохранения (кламп 0..30)
        const rMmInt = Math.max(0, Math.min(30, Math.round(value || 0)));
        // Более плавное скругление: уменьшаем эффективный радиус через демпфер
        const rPxScaled = Math.max(0, mmToPx(rMmInt) * RADIUS_DAMPING);
        if (obj.type === "rect" || shapeType === "roundedCorners") {
          holdCenterIfArrow((o) => {
            const currentScale = Math.min(o.scaleX || 1, o.scaleY || 1);
            const baseRx = rPxScaled / (currentScale || 1);
            const maxBaseRx = Math.max(
              0,
              Math.min(o.width || 0, o.height || 0) / 2 - 0.001
            );
            const clampedBaseRx = Math.max(0, Math.min(baseRx, maxBaseRx));
            o.set({
              rx: clampedBaseRx,
              ry: clampedBaseRx,
              displayCornerRadiusMm: rMmInt,
              cornerRadiusMm: rMmInt,
            });
          });
          break;
        }
        // Підтримувані path-фігури — оновлюємо in-place
        if (supportsCornerRadiusForPath(obj)) {
          // Для warningTriangle — плавность: замедление в 2 раза
          const localRadiusPx =
            shapeType === "warningTriangle" ? rPxScaled * 0.5 : rPxScaled;
          holdCenterIfArrow((o) => {
            applyCornerRadiusToPathShape(o, localRadiusPx);
            o.set({ displayCornerRadiusMm: rMmInt, cornerRadiusMm: rMmInt });
          });
          obj.setCoords();
          canvas.requestRenderAll();
        }
        break;
      }
      case "thickness": {
        // Дозволяємо товщину 0 мм (без мінімуму 1)
        const applied = Math.max(0, value || 0);
        holdCenterIfArrow((o) => {
          o.set("strokeWidth", mmToPx(applied));
        });
        break;
      }
      case "fill": {
        holdCenterIfArrow((o) => {
          if (value) {
            const themeFill = globalColors?.textColor || "#000000";
            o.set({ fill: themeFill, useThemeColor: true });
          } else {
            o.set({ fill: "transparent", useThemeColor: false });
          }
        });
        break;
      }
      case "cut": {
        const themeTextColor = globalColors?.textColor || "#000000";
        const themeStrokeColor = globalColors?.strokeColor || "#000000";
        // Используем фирменный оранжевый, как в остальных элементах UI
        const ORANGE = "#FD7714";
        holdCenterIfArrow((o) => {
          const isCutShape = o?.cutType === "shape"; // объекты, добавленные из CUT-селектора
          const isFromShapeTab = !!(o?.fromShapeTab || o?.data?.fromShapeTab);
          if (value) {
            // Cut ON
            o.set("stroke", ORANGE);
            o.set({ fill: "#FFFFFF", useThemeColor: false });
            if (isCutShape) {
              // Не трогаем блокировки для врожденных CUT-элементов
              o.set({ isCutElement: true });
            } else {
              // Ручной Cut: фигуры из ShapeSelector (и прочие) остаются масштабируемыми
              o.set({
                isCutElement: true,
                cutType: "manual",
                hasControls: true,
                lockScalingX: false,
                lockScalingY: false,
                lockUniScaling: false,
              });
            }
          } else {
            // Cut OFF
            o.set("stroke", themeStrokeColor);
            if (isCutShape) {
              // Для элементов CUT-селектора не снимаем их особенности управления
              // (оставляем их как есть)
              o.set({ isCutElement: true });
              // Белая заливка обычно сохраняется для cut-элементов, но если нужно — можно сделать прозрачной
            } else {
              o.set({
                isCutElement: false,
                cutType: null,
                hasControls: true,
                lockScalingX: false,
                lockScalingY: false,
                lockUniScaling: false,
              });
              // При включённом Fill заливаем цветом текста, иначе прозрачная заливка
              if (properties.fill) {
                o.set({ fill: themeTextColor, useThemeColor: true });
              } else {
                o.set({ fill: "transparent", useThemeColor: false });
              }
            }
          }
        });
        break;
      }
      default:
        break;
    }

    const current =
      typeof canvas.getActiveObject === "function"
        ? canvas.getActiveObject()
        : null;
    if (current && typeof current.setCoords === "function") current.setCoords();
    canvas.requestRenderAll();

    // Не сбрасываем ручной режим здесь, чтобы не перетирать ввод пользователя во время печати
    // Режим завершается в onBlur соответствующих инпутов
  };

  const incrementValue = (property, increment = 1) => {
    setIsManuallyEditing(true);
    const currentValue = properties[property];
    const newValue = currentValue + increment;
    if (isCircle && (property === "width" || property === "height")) {
      // Для кола оновлюємо обидва
      updateProperty("width", newValue);
      updateProperty("height", newValue);
    } else {
      updateProperty(property, newValue);
    }
  };

  const decrementValue = (property, decrement = 1) => {
    setIsManuallyEditing(true);
    const currentValue = properties[property];
    let newValue;

    if (property === "rotation") {
      // Для rotation дозволяємо від'ємні значення
      newValue = currentValue - decrement;
    } else {
      // Для інших властивостей не дозволяємо від'ємні значення
      newValue = Math.max(0, currentValue - decrement);
    }

    if (isCircle && (property === "width" || property === "height")) {
      updateProperty("width", newValue);
      updateProperty("height", newValue);
    } else {
      updateProperty(property, newValue);
    }
  };

  if (!isOpen || !activeObject) return null;
  // Не показывать модалку для QR-кода
  if (
    activeObject?.isQRCode === true ||
    (activeObject?.data && activeObject.data.isQRCode === true)
  )
    return null;

  // Визначаємо, чи Corner radius має бути вимкнено (коло та деякі стрілки)
  const isCircle =
    activeObject?.type === "circle" ||
    activeObject?.isCircle === true ||
    activeObject?.shapeType === "round";

  // Чи підтримує поточна фігура радіус кутів
  const supportsCornerRadius = (() => {
    const st = activeObject?.shapeType;
    const supported = new Set([
      "roundedCorners",
      "rectangle",
      "hexagon",
      "octagon",
      "triangle",
      "warningTriangle",
      "semiround",
      "roundTop",
      "turnLeft",
      "turnRight",
      "leftArrow",
      "rightArrow",
    ]);
    // arrows (left/right) за вимогою — не підтримують Corner radius
    if (st === "leftArrow" || st === "rightArrow") return false;
    return activeObject?.type === "rect" || (st && supported.has(st));
  })();

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.titleWrapper}>
          <h3 className={styles.title}>Shape</h3>
          <button
            className={styles.closeIcon}
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12.0003 12L14.8287 14.8284M9.17188 14.8284L12.0003 12L9.17188 14.8284ZM14.8287 9.17157L12.0003 12L14.8287 9.17157ZM12.0003 12L9.17188 9.17157L12.0003 12Z"
                stroke="#006CA4"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                stroke="#006CA4"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <div className={styles.propertyGroup}>
          <label className={styles.label}>
            Width:
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                value={
                  typeof properties.width === "string"
                    ? properties.width
                    : properties.width === 0
                    ? ""
                    : properties.width
                }
                step={0.1}
                onChange={(e) => {
                  const val = e.target.value;
                  // Дозволяємо вводити будь-який текст, включаючи порожній
                  if (val === "") {
                    setProperties((prev) => ({ ...prev, width: "" }));
                    updateProperty("width", 0);
                  } else {
                    // Дозволяємо вводити коми, крапки, поки не завершено
                    setProperties((prev) => ({ ...prev, width: val }));
                    // Якщо це валідне число — оновлюємо розмір
                    const parsed = parseFloat(val.replace(",", "."));
                    if (!isNaN(parsed)) {
                      updateProperty("width", parsed);
                    }
                  }
                }}
                onFocus={() => setIsManuallyEditing(true)}
                onBlur={() =>
                  setTimeout(() => setIsManuallyEditing(false), 100)
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => incrementValue("width", 5)}
                ></i>
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => decrementValue("width", 5)}
                ></i>
              </div>
            </div>
          </label>
          <label className={styles.label}>
            Rotate:
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                value={
                  typeof properties.rotation === "string"
                    ? properties.rotation
                    : properties.rotation === 0
                    ? ""
                    : properties.rotation
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setProperties((prev) => ({ ...prev, rotation: "" }));
                    updateProperty("rotation", 0);
                  } else {
                    setProperties((prev) => ({ ...prev, rotation: val }));
                    const parsed = parseInt(val);
                    if (!isNaN(parsed)) {
                      updateProperty("rotation", parsed);
                    }
                  }
                }}
                onFocus={() => setIsManuallyEditing(true)}
                onBlur={() =>
                  setTimeout(() => setIsManuallyEditing(false), 100)
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => incrementValue("rotation", 15)}
                ></i>
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => decrementValue("rotation", 15)}
                ></i>
              </div>
            </div>
          </label>
          <label className={styles.label}>
            Height:
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                value={
                  typeof properties.height === "string"
                    ? properties.height
                    : properties.height === 0
                    ? ""
                    : properties.height
                }
                step={0.1}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setProperties((prev) => ({ ...prev, height: "" }));
                    updateProperty("height", 0);
                  } else {
                    setProperties((prev) => ({ ...prev, height: val }));
                    const parsed = parseFloat(val.replace(",", "."));
                    if (!isNaN(parsed)) {
                      updateProperty("height", parsed);
                    }
                  }
                }}
                onFocus={() => setIsManuallyEditing(true)}
                onBlur={() =>
                  setTimeout(() => setIsManuallyEditing(false), 100)
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => incrementValue("height", 5)}
                ></i>
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => decrementValue("height", 5)}
                ></i>
              </div>
            </div>
          </label>
          <label
            className={styles.label}
            style={{
              opacity: isCircle || !supportsCornerRadius ? 0.5 : 1,
              cursor:
                isCircle || !supportsCornerRadius ? "not-allowed" : "default",
            }}
          >
            Corner Radius:
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                value={
                  typeof properties.cornerRadius === "string"
                    ? properties.cornerRadius
                    : properties.cornerRadius === 0
                    ? ""
                    : properties.cornerRadius
                }
                disabled={isCircle || !supportsCornerRadius}
                style={{
                  cursor:
                    isCircle || !supportsCornerRadius ? "not-allowed" : "text",
                }}
                step={1}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!isCircle && supportsCornerRadius) {
                    if (val === "") {
                      setProperties((prev) => ({ ...prev, cornerRadius: "" }));
                      updateProperty("cornerRadius", 0);
                    } else {
                      setProperties((prev) => ({ ...prev, cornerRadius: val }));
                      const parsed = parseInt(val);
                      if (!isNaN(parsed)) {
                        updateProperty("cornerRadius", parsed);
                      }
                    }
                  }
                }}
                onFocus={() =>
                  !isCircle &&
                  supportsCornerRadius &&
                  setIsManuallyEditing(true)
                }
                onBlur={() =>
                  !isCircle &&
                  supportsCornerRadius &&
                  setTimeout(() => setIsManuallyEditing(false), 100)
                }
              />
              <div
                className={styles.arrows}
                style={{
                  pointerEvents:
                    isCircle || !supportsCornerRadius ? "none" : "auto",
                  opacity: isCircle || !supportsCornerRadius ? 0.6 : 1,
                }}
              >
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() =>
                    !isCircle &&
                    supportsCornerRadius &&
                    incrementValue("cornerRadius")
                  }
                ></i>
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() =>
                    !isCircle &&
                    supportsCornerRadius &&
                    decrementValue("cornerRadius")
                  }
                ></i>
              </div>
            </div>
          </label>
          <label className={styles.label}>
            Thickness:
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                disabled={properties.fill || properties.cut}
                style={{
                  cursor:
                    properties.fill || properties.cut ? "not-allowed" : "text",
                  opacity: properties.fill || properties.cut ? 0.7 : 1,
                }}
                value={
                  typeof properties.thickness === "string"
                    ? properties.thickness
                    : properties.thickness === 0.5
                    ? ""
                    : properties.thickness
                }
                step={0.5}
                onKeyDown={(e) => {
                  if (e.key === ".") {
                    e.preventDefault();
                    const el = e.currentTarget;
                    const start = el.selectionStart ?? el.value.length;
                    const end = el.selectionEnd ?? start;
                    const v = String(el.value || "");
                    if (v.includes(",") || v.includes(".")) return;
                    const newV = v.slice(0, start) + "," + v.slice(end);
                    el.value = newV;
                    try {
                      el.setSelectionRange(start + 1, start + 1);
                    } catch {}
                    try {
                      const evt = new Event("input", { bubbles: true });
                      el.dispatchEvent(evt);
                    } catch {}
                  }
                }}
                onChange={(e) => {
                  const raw = String(e.target.value || "");
                  if (raw === "") {
                    setIsManuallyEditing(true);
                    setProperties((prev) => ({ ...prev, thickness: "" }));
                    updateProperty("thickness", 0.5);
                    return;
                  }
                  if (/[,\.]$/.test(raw)) {
                    setIsManuallyEditing(true);
                    setProperties((prev) => ({ ...prev, thickness: raw }));
                    return;
                  }
                  const normalized = raw.replace(/,/g, ".");
                  const num = parseFloat(normalized);
                  if (isNaN(num)) {
                    setIsManuallyEditing(true);
                    setProperties((prev) => ({ ...prev, thickness: raw }));
                    return;
                  }
                  updateProperty("thickness", num);
                }}
                onFocus={() => setIsManuallyEditing(true)}
                onBlur={(e) => {
                  // При потере фокуса коммитим значение: пустое трактуем как 1
                  const raw = String(e.target.value || "");
                  const normalized = raw.replace(/,/g, ".");
                  const num = parseFloat(normalized);
                  const finalVal = raw.trim() === "" || isNaN(num) ? 0.5 : num;
                  updateProperty("thickness", finalVal);
                  setTimeout(() => setIsManuallyEditing(false), 100);
                }}
              />
              <div
                className={styles.arrows}
                style={{
                  pointerEvents:
                    properties.fill || properties.cut ? "none" : "auto",
                  opacity: properties.fill || properties.cut ? 0.6 : 1,
                }}
              >
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => incrementValue("thickness", 0.5)}
                ></i>
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => decrementValue("thickness", 0.5)}
                ></i>
              </div>
            </div>
          </label>
          <label className={styles.cutFillWrapper}>
            <div className={styles.cutFillWrapperEl}>
              Fill
              <input
                type="checkbox"
                checked={properties.fill}
                onChange={(e) => {
                  if (e.target.checked) {
                    updateProperty("cut", false);
                    updateProperty("fill", true);
                    // При активному Fill товщина має бути 0 та поле неактивне
                    updateProperty("thickness", 0);
                  } else {
                    updateProperty("fill", false);
                    // Після вимкнення Fill: повертаємо товщину до 0.5 і показуємо її в інпуті
                    setProperties((prev) => ({ ...prev, thickness: "0.5" }));
                    updateProperty("thickness", 0.5);
                  }
                }}
              />
            </div>
            <div className={styles.cutFillWrapperEl}>
              Cut
              <input
                type="checkbox"
                checked={properties.cut}
                onChange={(e) => {
                  if (e.target.checked) {
                    // Запам'ятати поточну товщину, щоб відновити після вимкнення Cut
                    const currentTh = (() => {
                      const t = properties.thickness;
                      if (typeof t === "number") return t;
                      const parsed = parseFloat(String(t).replace(/,/g, "."));
                      return isNaN(parsed) ? 0.5 : parsed;
                    })();
                    setPrevThicknessBeforeCut(currentTh);
                    updateProperty("fill", false);
                    updateProperty("cut", true);
                    // Під час Cut товщина завжди 0.5 мм
                    setProperties((prev) => ({ ...prev, thickness: "0.5" }));
                    updateProperty("thickness", 0.5);
                  } else {
                    updateProperty("cut", false);
                    // Відновлюємо попередню товщину, якщо Fill не активний
                    const thToRestore = prevThicknessBeforeCut;
                    if (!properties.fill) {
                      const restoreVal =
                        typeof thToRestore === "number" && !isNaN(thToRestore)
                          ? thToRestore
                          : 0.5;
                      updateProperty("thickness", restoreVal);
                    }
                    // Скидаємо запам'ятоване значення
                    setPrevThicknessBeforeCut(null);
                  }
                }}
              />
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default ShapeProperties;

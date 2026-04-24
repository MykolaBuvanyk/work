import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./InfoAboutProject.module.css";
import { useCurrentSignPrice } from "../../hooks/useCurrentSignPrice";
import { useSelector } from "react-redux";
import CartAuthModal from "../CartAuthModal/CartAuthModal";
import { useCanvasContext } from "../../contexts/CanvasContext";
import CartSaveProjectModal from "../CartSaveProjectModal/CartSaveProjectModal";
import SaveAsModal from "../SaveAsModal/SaveAsModal";
import { saveNewProject } from "../../utils/projectStorage";
import { saveCurrentProject } from "../../utils/projectStorage";
import { markProjectAsOrdered } from "../../utils/projectStorage";
import { addProjectToCart } from "../../http/cart";
import { jwtDecode } from "jwt-decode";
import Checkout from "../checkout/checkout";
import ThankYou from "../order-success/order-success";
import CartAccessoriesModal from "../CartAccessoriesModal/CartAccessoriesModal";
import OrderTestModal from "../OrderTestModal/OrderTestModal";
import { $authHost } from "../../http";
import PayModal from "../PayModal/PayModal";

const COLOR_THEME_BY_INDEX_CAPS = {
  0: "WHITE / BLACK",
  1: "WHITE / BLUE",
  2: "WHITE / RED",
  3: "BLACK / WHITE",
  4: "BLUE / WHITE",
  5: "RED / WHITE",
  6: "GREEN / WHITE",
  7: "YELLOW / BLACK",
  8: "GRAY / WHITE",
  9: "ORANGE / WHITE",
  10: "BROWN / WHITE",
  11: "SILVER / BLACK",
  12: "“WOOD” / BLACK",
  13: "CARBON / WHITE",
};

const normalizeThickness = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
};

const resolveColorThemeCaps = (toolbarState = {}, canvasSnap = {}) => {
  const idx = Number(toolbarState?.selectedColorIndex);
  if (Number.isFinite(idx) && COLOR_THEME_BY_INDEX_CAPS[idx]) {
    return COLOR_THEME_BY_INDEX_CAPS[idx];
  }

  // Minimal fallback for texture backgrounds.
  const bg =
    toolbarState?.globalColors?.backgroundColor ??
    toolbarState?.backgroundColor ??
    canvasSnap?.backgroundColor;
  const bgType =
    toolbarState?.globalColors?.backgroundType ??
    toolbarState?.backgroundType ??
    canvasSnap?.backgroundType;

  if (typeof bg === "string" && String(bgType).toLowerCase() === "texture") {
    const lower = bg.toLowerCase();
    if (lower.includes("wood")) return COLOR_THEME_BY_INDEX_CAPS[12];
    if (lower.includes("carbon")) return COLOR_THEME_BY_INDEX_CAPS[13];
  }

  return "UNKNOWN";
};

const formatDisplayNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
};

const formatCanvasSizeMm = (canvasSnap = {}) => {
  const mmWidth = Number(canvasSnap?.toolbarState?.sizeValues?.width);
  const mmHeight = Number(canvasSnap?.toolbarState?.sizeValues?.height);

  if (Number.isFinite(mmWidth) && Number.isFinite(mmHeight)) {
    return `${formatDisplayNumber(mmWidth)} x ${formatDisplayNumber(mmHeight)} mm`;
  }

  const width = Number(canvasSnap?.width);
  const height = Number(canvasSnap?.height);
  if (Number.isFinite(width) && Number.isFinite(height)) {
    const fallbackWidthMm = (width * 25.4) / 72;
    const fallbackHeightMm = (height * 25.4) / 72;
    return `${formatDisplayNumber(fallbackWidthMm)} x ${formatDisplayNumber(fallbackHeightMm)} mm`;
  }

  return "Unknown size";
};

const resolveTapeLabel = (canvasSnap = {}) => {
  if (typeof canvasSnap?.Tape === "string" && canvasSnap.Tape.trim()) {
    return canvasSnap.Tape.trim().toUpperCase();
  }
  return canvasSnap?.toolbarState?.isAdhesiveTape ? "TAPE" : "NO TAPE";
};

const hasContent = (value) => String(value ?? "").trim().length > 0;

const resolveCanvasObjects = (canvasSnap = {}) => {
  if (Array.isArray(canvasSnap?.json?.objects)) return canvasSnap.json.objects;
  if (Array.isArray(canvasSnap?.jsonTemplate?.objects)) return canvasSnap.jsonTemplate.objects;
  if (Array.isArray(canvasSnap?.objects)) return canvasSnap.objects;
  return [];
};

const hasObjectFlag = (obj, key) => obj?.[key] === true || obj?.data?.[key] === true;

const isQrObject = (obj) => hasObjectFlag(obj, "isQRCode");

const isBarcodeObject = (obj) => hasObjectFlag(obj, "isBarCode");

const isHoleObject = (obj) => {
  if (!obj || typeof obj !== "object") return false;
  if (obj.isCutElement === true && String(obj.cutType || "").toLowerCase() === "hole") return true;
  if (typeof obj.id === "string" && obj.id.startsWith("hole-")) return true;
  if (typeof obj.id === "string" && obj.id.startsWith("holes-")) return true;
  if (typeof obj.name === "string" && obj.name.toLowerCase().includes("hole")) return true;
  if (obj.isHole === true) return true;
  return false;
};

const isCutFigureObject = (obj) => {
  if (!obj || typeof obj !== "object") return false;
  if (isHoleObject(obj)) return false;
  if (obj.isCutElement === true) {
    const cutType = String(obj.cutType || "").toLowerCase();
    return cutType === "shape" || cutType === "manual";
  }
  return false;
};

const isTextObject = (obj) => {
  const type = String(obj?.type || "").toLowerCase();
  return ["text", "textbox", "i-text"].includes(type) || (typeof obj?.text === "string" && obj.text.trim());
};

const hasShapeMarker = (obj) =>
  hasContent(obj?.shapeType) ||
  hasContent(obj?.data?.shapeType) ||
  hasContent(obj?.shapeSvgId) ||
  hasContent(obj?.data?.shapeSvgId);

const isImageObject = (obj) => {
  const type = String(obj?.type || "").toLowerCase();
  return (
    type === "image" ||
    hasObjectFlag(obj, "isUploadedImage") ||
    hasObjectFlag(obj, "fromIconMenu") ||
    hasContent(obj?.imageSource) ||
    hasContent(obj?.data?.imageSource)
  );
};

const isHelperObject = (obj) => {
  if (!obj || typeof obj !== "object") return true;
  return Boolean(
    obj.isBorderShape ||
      obj.cardBorderMode ||
      obj.excludeFromExport ||
      obj.excludeFromSummary ||
      obj.isSafeZone ||
      obj.isBleedZone ||
      obj.isGuide ||
      obj.isGrid ||
      obj.isFrameHole ||
      obj.isHole
  );
};

const isShapeObject = (obj) => {
  if (!obj || typeof obj !== "object") return false;
  if (!hasShapeMarker(obj)) return false;
  if (isImageObject(obj) || isCutFigureObject(obj) || isHoleObject(obj)) return false;
  if (isQrObject(obj) || isBarcodeObject(obj) || isTextObject(obj)) return false;
  return true;
};

const analyzeCanvasContent = (canvasSnap = {}) => {
  const summary = {
    texts: [],
    shapes: 0,
    cutFigures: 0,
    holes: 0,
    qrCodes: 0,
    barcodes: 0,
    images: 0,
  };

  const walk = (obj) => {
    if (!obj || isHelperObject(obj)) return;

    if (isQrObject(obj)) {
      summary.qrCodes += 1;
      return;
    }

    if (isHoleObject(obj)) {
      summary.holes += 1;
      return;
    }

    if (isCutFigureObject(obj)) {
      summary.cutFigures += 1;
      return;
    }

    if (isBarcodeObject(obj)) {
      summary.barcodes += 1;
      return;
    }

    if (isTextObject(obj)) {
      const text = String(obj?.text || "").trim();
      if (text) {
        summary.texts.push(text);
      }
      return;
    }

    if (isImageObject(obj)) {
      summary.images += 1;
      return;
    }

    if (Array.isArray(obj?.objects) && obj.objects.length > 0) {
      obj.objects.forEach(walk);
      return;
    }

    if (isShapeObject(obj)) {
      summary.shapes += 1;
    }
  };

  resolveCanvasObjects(canvasSnap).forEach(walk);
  return summary;
};

const resolveCopiesCount = (canvasSnap = {}) => {
  const raw = canvasSnap?.copiesCount ?? canvasSnap?.toolbarState?.copiesCount ?? 1;
  const count = Math.floor(Number(raw));
  return Number.isFinite(count) && count > 0 ? count : 1;
};

const resolveTotalSignsFromCanvases = (canvases = []) => {
  try {
    if (typeof window !== "undefined" && typeof window.getToolbarFooterTotalSigns === "function") {
      const value = Number(window.getToolbarFooterTotalSigns());
      if (Number.isFinite(value) && value >= 0) return value;
    }
  } catch {
    // no-op
  }

  return canvases.reduce((sum, canvasSnap) => sum + resolveCopiesCount(canvasSnap), 0);
};

const expandParsedSigns = (signs = []) => {
  const expanded = [];
  let displayIndex = 1;

  signs.forEach((sign, signIndex) => {
    const copiesCount = Math.max(1, Math.floor(Number(sign?.copiesCount) || 1));
    for (let copyIndex = 0; copyIndex < copiesCount; copyIndex += 1) {
      expanded.push({
        ...sign,
        id: `${String(sign?.id || signIndex)}::copy-${copyIndex + 1}`,
        title: `Sign ${displayIndex}`,
        copiesCount: 1,
      });
      displayIndex += 1;
    }
  });

  return expanded;
};

const buildOrderTestSummary = ({ projectTitle, projectSnapshot, accessories }) => {
  const canvases = Array.isArray(projectSnapshot?.canvases) ? projectSnapshot.canvases : [];
  const normalizedAccessories = Array.isArray(accessories)
    ? accessories
        .filter((item) => item && item.checked)
        .map((item) => {
          const qty = Math.max(0, Math.floor(Number(item?.qty) || 0));
          return {
            id: item?.id ?? item?.name,
            name: String(item?.name || "Accessory"),
            qty,
          };
        })
        .filter((item) => item.qty > 0)
    : [];

  const parsedSigns = canvases.map((canvasSnap, index) => {
    const content = analyzeCanvasContent(canvasSnap);
    const thickness = formatDisplayNumber(canvasSnap?.Thickness ?? canvasSnap?.toolbarState?.thickness);
    const metaParts = [
      formatCanvasSizeMm(canvasSnap),
      resolveColorThemeCaps(canvasSnap?.toolbarState, canvasSnap),
      thickness ? `${thickness}` : null,
      resolveTapeLabel(canvasSnap),
    ].filter(Boolean);

    return {
      id: String(canvasSnap?.id || index),
      title: `Sign ${index + 1}`,
      metaLine: metaParts.join(", "),
      textLine: content.texts.length > 0 ? content.texts.join(", ") : "—",
      counts: {
        shapes: content.shapes,
        cutFigures: content.cutFigures,
        holes: content.holes,
        qrCodes: content.qrCodes,
        barcodes: content.barcodes,
        images: content.images,
      },
      copiesCount: resolveCopiesCount(canvasSnap),
    };
  });
  const signs = expandParsedSigns(parsedSigns);

  return {
    projectTitle,
    totalSigns: signs.length || resolveTotalSignsFromCanvases(canvases),
    accessories: normalizedAccessories,
    signs,
  };
};

const InfoAboutProject = () => {
  const { isAuth } = useSelector((state) => state.user);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSaveProjectModalOpen, setIsSaveProjectModalOpen] = useState(false);
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isPreparingOrderSummary, setIsPreparingOrderSummary] = useState(false);
  const [isOrderTestOpen, setIsOrderTestOpen] = useState(false);
  const [orderTestSummary, setOrderTestSummary] = useState(null);
  const [isCartAccessoriesOpen, setIsCartAccessoriesOpen] = useState(false);
  const [cartAccessories, setCartAccessories] = useState([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isOrderSuccessOpen, setIsOrderSuccessOpen] = useState(false);
  const [isPayOpen,setIsPayOpen]=useState(false);
  const [checkoutTotalsDraft, setCheckoutTotalsDraft] = useState(null);
  const { canvas } = useCanvasContext();
  const onCartClickRef = useRef(null);

  const user=useSelector((state)=>state.user);
  const normalizedUserType = String(user?.user?.type || "").trim().toLowerCase();
  const isAdminUser = normalizedUserType === "admin";

  const { price, netAfterDiscount, discountPercent, discountAmount, orderSubtotal, accessoriesPrice, totalPrice, isLoading } =
    useCurrentSignPrice();

  const formatted = `€ ${Number(price || 0).toFixed(2)}`;
  const formattedDiscount = `€ ${Number(discountAmount || 0).toFixed(2)}`;
  const formattedTotal = `€ ${Number(totalPrice || 0).toFixed(2)}`;

  const readProjectMetaFromStorage = () => {
    try {
      const id = String(localStorage.getItem("currentProjectId") || "").trim();
      const name = String(localStorage.getItem("currentProjectName") || "").trim();
      return { id, name };
    } catch {
      return { id: "", name: "" };
    }
  };

  const [projectMeta, setProjectMeta] = useState(() => readProjectMetaFromStorage());

  useEffect(() => {
    const sync = () => setProjectMeta(readProjectMetaFromStorage());

    // Initial sync + react to project open/save events.
    sync();
    window.addEventListener("project:opened", sync);
    window.addEventListener("project:switched", sync);
    window.addEventListener("project:reset", sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener("project:opened", sync);
      window.removeEventListener("project:switched", sync);
      window.removeEventListener("project:reset", sync);
      window.removeEventListener("storage", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const projectTitle = useMemo(() => {
    if (!projectMeta?.id) return "Not saved";
    if (projectMeta?.name) return projectMeta.name;
    return "Untitled";
  }, [projectMeta]);

  const getSelectedAccessoriesSnapshot = () => {
    try {
      const getter = typeof window !== "undefined" ? window.getSelectedAccessories : null;
      const list = typeof getter === "function" ? getter() : null;
      if (Array.isArray(list)) return list;
    } catch {
      // no-op
    }
    return [];
  };

  const parseQty = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  };

  const syncAccessoriesToProject = (nextAccessories) => {
    try {
      const setter = typeof window !== "undefined" ? window.setSelectedAccessories : null;
      if (typeof setter === "function") {
        setter(nextAccessories);
      }
    } catch {
      // no-op
    }
  };

  const updateCartAccessories = (updater) => {
    setCartAccessories((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const safeNext = Array.isArray(next) ? next : [];
      syncAccessoriesToProject(safeNext);
      return safeNext;
    });
  };

  const toggleCartAccessory = (id) => {
    updateCartAccessories((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const setCartAccessoryQty = (id, raw) => {
    updateCartAccessories((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: String(raw) } : item))
    );
  };

  const changeCartAccessoryQty = (id, delta) => {
    updateCartAccessories((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = Math.max(0, parseQty(item.qty) + delta);
        return { ...item, qty: String(next) };
      })
    );
  };

  const addCurrentProjectToCart = async (checkoutTotals = {}) => {
    let currentProjectId = null;
    try {
      currentProjectId = localStorage.getItem("currentProjectId");
    } catch {}

    if (!currentProjectId) {
      setIsSaveProjectModalOpen(true);
      return false;
    }

    if (!canvas || isAddingToCart) return false;

    setIsAddingToCart(true);
    try {
      const project = await saveCurrentProject(canvas);

      const projectWithCanvasMeta = (() => {
        const canvases = Array.isArray(project?.canvases) ? project.canvases : [];
        const mapped = canvases.map((c) => {
          const toolbarState = c?.toolbarState || {};
          const Thickness = normalizeThickness(toolbarState?.thickness);
          const ColorTheme = resolveColorThemeCaps(toolbarState, c);
          const Tape = toolbarState?.isAdhesiveTape ? "TAPE" : "NO TAPE";
          return {
            ...c,
            Thickness,
            ColorTheme,
            Tape,
          };
        });
        return { ...(project || {}), canvases: mapped };
      })();

      const accessoriesSelected = Array.isArray(cartAccessories)
        ? cartAccessories
            .filter((x) => x && x.checked)
            .map((x) => {
              const qtyRaw = Number(x.qty);
              const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.floor(qtyRaw) : 1;
              return {
                id: x.id,
                name: x.name,
                qty,
                price: x.price,
                desc: x.desc,
              };
            })
        : [];

      let lang = "de";
      if (location.pathname.length >= 3) {
        lang = location.pathname.slice(1, 3);
      }

      const fallbackSum = Number(netAfterDiscount || 0);
      const fallbackTotal = Number(totalPrice || 0);
      const normalizedSum = Number(checkoutTotals?.sum);
      const normalizedTotalSum = Number(checkoutTotals?.totalSum);
      const sum = Number.isFinite(normalizedSum) ? normalizedSum : fallbackSum;
      const totalSum = Number.isFinite(normalizedTotalSum)
        ? normalizedTotalSum
        : fallbackTotal;
      const persistedOrderTestSummary = buildOrderTestSummary({
        projectTitle: project?.name || projectTitle || "Untitled",
        projectSnapshot: projectWithCanvasMeta,
        accessories: accessoriesSelected.map((item) => ({
          ...item,
          checked: true,
          qty: String(item?.qty ?? 0),
        })),
      });

      const payload = {
        projectId: project?.id || currentProjectId,
        projectName: project?.name || "Untitled",
        price: Number(sum || 0),
        netAfterDiscount: Number(sum || 0),
        discountPercent: Number(discountPercent || 0),
        discountAmount: Number(discountAmount || 0),
        totalPrice: Number(totalSum || 0),
        project: projectWithCanvasMeta,
        accessories: accessoriesSelected,
        lang,
        checkout: {
          deliveryPrice: Number(checkoutTotals?.deliveryPrice || 0),
          deliveryLabel: String(checkoutTotals?.deliveryLabel || ""),
          phoneOk: Boolean(checkoutTotals?.phoneOk),
          vatPercent: Number(checkoutTotals?.vatPercent || 0),
          vatAmount: Number(checkoutTotals?.vatAmount || 0),
          vatNumber: String(checkoutTotals?.vatNumber || ""),
          deliveryAddress: checkoutTotals?.deliveryAddress || null,
          invoiceAddress: checkoutTotals?.invoiceAddress || null,
          invoiceEmail: String(checkoutTotals?.invoiceEmail || ""),
          invoiceAddressEmail: String(checkoutTotals?.invoiceAddressEmail || ""),
          deliveryComment: String(checkoutTotals?.deliveryComment || ""),
          orderTestSummary: persistedOrderTestSummary,
        },
        manufacturerNote:
          typeof window.getManufacturerNote === "function"
            ? String(window.getManufacturerNote() || "")
            : String(window._manufacturerNote || ""),
      };

      try {
        if (payload.manufacturerNote) {
          payload.project = {
            ...(payload.project || {}),
            manufacturerNote: payload.manufacturerNote,
          };
        }
      } catch {}

      const cartResult = await addProjectToCart(payload);

      try {
        const orderedAtTs = (() => {
          const fromOrder = Date.parse(cartResult?.order?.createdAt || "");
          if (Number.isFinite(fromOrder) && fromOrder > 0) return fromOrder;
          const fromCreated = Date.parse(cartResult?.createdAt || "");
          if (Number.isFinite(fromCreated) && fromCreated > 0) return fromCreated;
          return Date.now();
        })();

        const targetProjectId = String(project?.id || currentProjectId || "").trim();
        if (targetProjectId) {
          await markProjectAsOrdered(targetProjectId, orderedAtTs);
        }
      } catch {}

      return true;
    } catch (e) {
      console.error("Failed to add to cart", e);
      alert("Failed to add project to cart. Please try again.");
      return false;
    } finally {
      setIsAddingToCart(false);
    }
  };

  const onCartClick = async () => {
    if (!isAuth) {
      setIsAuthModalOpen(true);
      return;
    }

    // Require saved project before cart
    let currentProjectId = null;
    try {
      currentProjectId = localStorage.getItem("currentProjectId");
    } catch {}

    if (!currentProjectId) {
      setIsSaveProjectModalOpen(true);
      return;
    }

    if (!canvas || isPreparingOrderSummary) return;

    const snapshot = getSelectedAccessoriesSnapshot()
      .map((item) => ({
        ...item,
        qty: String(item?.qty ?? "1"),
        checked: !!item?.checked,
      }))
      .filter((item) => {
        // include if explicitly checked by user or if admin marked it available
        if (item && item.checked) return true;
        if (item && (item.available === true)) return true;
        return false;
      });

    setIsPreparingOrderSummary(true);
    syncAccessoriesToProject(snapshot);
    setCartAccessories(snapshot);

    //if (!isAdminUser) {
    setIsCartAccessoriesOpen(true);
    setIsPreparingOrderSummary(false);
    //return;
    //}

    try {
      const projectSnapshot = await saveCurrentProject(canvas);
      const reviewSummary = buildOrderTestSummary({
        projectTitle,
        projectSnapshot,
        accessories: snapshot,
      });
      setOrderTestSummary(reviewSummary);
      setIsOrderTestOpen(true);
    } catch (error) {
      console.error("Failed to prepare order summary", error);
      alert("Failed to prepare order summary. Please try again.");
    } finally {
      setIsPreparingOrderSummary(false);
    }
  };

  useEffect(() => {
    onCartClickRef.current = onCartClick;
  }, [onCartClick]);

  useEffect(() => {
    const handleOpenPreorderFromProjects = () => {
      const handler = onCartClickRef.current;
      if (typeof handler === 'function') {
        handler();
      }
    };

    window.addEventListener('projects:open-preorder', handleOpenPreorderFromProjects);

    return () => {
      window.removeEventListener('projects:open-preorder', handleOpenPreorderFromProjects);
    };
  }, []);

  const handleOrderTestClose = () => {
    setIsOrderTestOpen(false);
  };

  const handleProceedToAccessories = () => {
    setIsOrderTestOpen(false);
    setIsCartAccessoriesOpen(true);
  };

  const handleCartAccessoriesClose = () => {
    setIsCartAccessoriesOpen(false);
  };

  const handleProceedToCheckout = async () => {
    setIsCartAccessoriesOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleCheckoutClose = () => {
    setIsCheckoutOpen(false);
  };

  const PayClose=()=>{
    setIsPayOpen(false);
    setCheckoutTotalsDraft(null);
    setIsOrderSuccessOpen(true);
  }

  const backToPayment=()=>{
    setIsPayOpen(false)
    //setIs98
    setIsCheckoutOpen(true)
  }

  const handleBackToAccessories = () => {
    setIsCheckoutOpen(false);
    setIsCartAccessoriesOpen(true);
  };

  const handleCheckoutPlaceOrder = async (checkoutTotals) => {
    setCheckoutTotalsDraft(checkoutTotals || null);
    setIsCheckoutOpen(false);
    setIsPayOpen(true)
  };

  const handlePayModalPlaceOrder = async () => {
    const added = await addCurrentProjectToCart(checkoutTotalsDraft || {});
    if (!added) return false;
    return true;
  };

  const handleOrderSuccessClose = () => {
    setIsOrderSuccessOpen(false);

    $authHost.post('cart/sendOrderEmails', {
      id: localStorage.getItem('MySqlOrderId'),
    }).catch((err) => {
      console.log('Помилка надсилання email по замовленню ' + err);
    });
  };

  const handleOrderSuccessSend = ({ rating, comment }) => {
    setIsOrderSuccessOpen(false);

    $authHost.post('cart/sendReviewAndComent', {
      id: localStorage.getItem('MySqlOrderId'),
      rating,
      comment,
    }).catch((err) => {
      console.log('Помилка надсилання відгуку ' + err);
    });
  };

  const [reviews,setReviews]=useState({rating:0,comment:''});

  console.log(434,reviews);

  return (
    <div className={styles.infoAboutProject}>
      <div className={styles.infoAboutProjectEl}>
        <h3 className={styles.title}>Project: {projectTitle}</h3>
        <button
          className={styles.cartButton}
          onClick={onCartClick}
          type="button"
          disabled={isAddingToCart || isPreparingOrderSummary}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g clip-path="url(#clip0_122_647)">
              <path
                d="M1.86288 1.59688C1.73226 1.07448 1.2029 0.756878 0.680498 0.887491C0.158101 1.0181 -0.159503 1.54747 -0.0288913 2.06987L1.86288 1.59688ZM5.2855 15.3866L5.87156 14.6074L5.2855 15.3866ZM2.76984 9.39747L3.71799 9.17023L2.76984 9.39747ZM5.12058 15.2566L5.74173 14.505L5.12058 15.2566ZM20.1846 9.84737L21.1327 10.0746L20.1846 9.84737ZM18.2326 14.9944L17.5495 14.2986L18.2326 14.9944ZM17.454 15.6084L17.9714 16.4348L17.454 15.6084ZM20.1139 6.19302L20.7831 5.48392L20.1139 6.19302ZM20.4455 6.61347L21.291 6.12798L20.4455 6.61347ZM12.8338 9.10837C12.2953 9.10837 11.8588 9.5449 11.8588 10.0834C11.8588 10.6219 12.2953 11.0584 12.8338 11.0584V9.10837ZM15.5838 11.8584C15.0453 11.8584 14.6088 12.2949 14.6088 12.8334C14.6088 13.3719 15.0453 13.8084 15.5838 13.8084V11.8584ZM1.882 5.69302V6.66802H16.9082V5.69302V4.71802H1.882V5.69302ZM11.9938 16.3071V15.3321H11.5311V16.3071V17.2821H11.9938V16.3071ZM2.76984 9.39747L3.71799 9.17023L2.83015 5.46578L1.882 5.69302L0.93385 5.92026L1.82169 9.62472L2.76984 9.39747ZM1.882 5.69302L2.82788 5.45653L1.86288 1.59688L0.916992 1.83337L-0.0288913 2.06987L0.936115 5.92952L1.882 5.69302ZM11.5311 16.3071V15.3321C9.83414 15.3321 8.64499 15.3305 7.72431 15.2235C6.82829 15.1194 6.29369 14.9249 5.87156 14.6074L5.2855 15.3866L4.69943 16.1658C5.50105 16.7688 6.41531 17.0345 7.49919 17.1605C8.5584 17.2836 9.88019 17.2821 11.5311 17.2821V16.3071ZM2.76984 9.39747L1.82169 9.62472C2.20647 11.2302 2.51305 12.5159 2.87964 13.5173C3.25476 14.5419 3.72628 15.3691 4.49944 16.0081L5.12058 15.2566L5.74173 14.505C5.33459 14.1685 5.02089 13.694 4.71079 12.8469C4.39215 11.9765 4.11351 10.8205 3.71799 9.17023L2.76984 9.39747ZM5.2855 15.3866L5.87156 14.6074C5.82751 14.5743 5.78422 14.5402 5.74173 14.505L5.12058 15.2566L4.49944 16.0081C4.56489 16.0622 4.63157 16.1148 4.69943 16.1658L5.2855 15.3866ZM11.9938 16.3071V17.2821C13.4221 17.2821 14.5658 17.2832 15.4897 17.1898C16.4332 17.0944 17.2387 16.8936 17.9714 16.4348L17.454 15.6084L16.9366 14.7821C16.5535 15.0219 16.077 15.1704 15.2935 15.2497C14.4903 15.3309 13.4617 15.3321 11.9938 15.3321V16.3071ZM18.2326 14.9944L17.5495 14.2986C17.3633 14.4815 17.1578 14.6436 16.9366 14.7821L17.454 15.6084L17.9714 16.4348C18.3122 16.2215 18.6287 15.9718 18.9156 15.6902L18.2326 14.9944ZM16.9082 5.69302V6.66802C17.8255 6.66802 18.424 6.66974 18.8633 6.72334C19.2865 6.77498 19.3992 6.85912 19.4447 6.90211L20.1139 6.19302L20.7831 5.48392C20.2988 5.02692 19.7007 4.86106 19.0994 4.7877C18.5143 4.7163 17.7749 4.71802 16.9082 4.71802V5.69302ZM20.1846 9.84737L21.1327 10.0746C21.3347 9.23184 21.5087 8.51315 21.5757 7.92752C21.6444 7.32577 21.6226 6.70541 21.291 6.12798L20.4455 6.61347L19.6 7.09896C19.6311 7.15328 19.6867 7.28249 19.6383 7.70606C19.588 8.14575 19.4502 8.72813 19.2364 9.62013L20.1846 9.84737ZM20.1139 6.19302L19.4447 6.90211C19.5058 6.95978 19.5581 7.0261 19.6 7.09896L20.4455 6.61347L21.291 6.12798C21.1541 5.88959 20.983 5.67259 20.7831 5.48392L20.1139 6.19302ZM19.2504 12.8334V11.8584H15.5838V12.8334V13.8084H19.2504V12.8334ZM20.128 10.0834V9.10837L12.8338 9.10837V10.0834V11.0584L20.128 11.0584V10.0834ZM20.1846 9.84737L19.2364 9.62013C19.2173 9.69993 19.1985 9.7785 19.1799 9.85594L20.128 10.0834L21.0761 10.3108C21.0947 10.2331 21.1136 10.1544 21.1327 10.0746L20.1846 9.84737ZM20.128 10.0834L19.1799 9.85594C18.9064 10.996 18.6967 11.8535 18.4784 12.5366L19.4071 12.8334L20.3359 13.1301C20.5804 12.3649 20.807 11.4325 21.0761 10.3108L20.128 10.0834ZM19.4071 12.8334L18.4784 12.5366C18.1858 13.4522 17.91 13.9448 17.5495 14.2986L18.2326 14.9944L18.9156 15.6902C19.6046 15.0138 20.0027 14.1728 20.3359 13.1301L19.4071 12.8334ZM19.2504 12.8334V13.8084H19.4071V12.8334V11.8584H19.2504V12.8334Z"
                fill="#1EA600"
              />
            </g>
            <defs>
              <clipPath id="clip0_122_647">
                <rect width="22" height="22" fill="white" />
              </clipPath>
            </defs>
          </svg>
          Cart
        </button>
      </div>
      <div className={styles.infoAboutProjectEl}>
        <p className={styles.para}>Current sign</p>
        <span className={styles.price}>{isLoading ? "…" : formatted}</span>
      </div>
      <div className={styles.infoAboutProjectEl}>
        <p className={styles.para}>
          Discount <span>({Number(discountPercent || 0).toFixed(0)}%)</span>
        </p>
        <span className={styles.price}>{isLoading ? "…" : formattedDiscount}</span>
      </div>
      <div className={styles.infoAboutProjectEl}>
        <p className={styles.para}>Total Price</p>
        <span className={styles.price}>{isLoading ? "…" : formattedTotal}</span>
      </div>

      <CartAuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      <CartSaveProjectModal
        isOpen={isSaveProjectModalOpen}
        onCancel={() => setIsSaveProjectModalOpen(false)}
        onSave={() => {
          setIsSaveProjectModalOpen(false);
          setIsSaveAsModalOpen(true);
        }}
      />

      {isSaveAsModalOpen && (
        <SaveAsModal
          onClose={() => setIsSaveAsModalOpen(false)}
          onSaveAs={async (name) => {
            if (!canvas) return;
            if (!name || !name.trim()) {
              alert("Please enter a project name");
              return;
            }

            try {
              const savedProject = await saveNewProject(name, canvas);
              if (savedProject && savedProject.id) {
                try {
                  localStorage.setItem("currentProjectId", savedProject.id);
                } catch {}

                // Update header immediately even if no other state changes.
                setProjectMeta({ id: String(savedProject.id), name: String(name || "").trim() });
                window.dispatchEvent(
                  new CustomEvent("project:opened", {
                    detail: { projectId: savedProject.id },
                  })
                );
              }
              setIsSaveAsModalOpen(false);
            } catch (e) {
              console.error("Save as failed:", e);
              alert("Failed to save project. Please try again.");
            }
          }}
        />
      )}
      {isPayOpen&&(
        <PayModal
          onClose={PayClose}
          isPayOpen={isPayOpen}
          backToPayment={backToPayment}
          orderId={Number(localStorage.getItem('MySqlOrderId'))}
          onPlaceOrder={handlePayModalPlaceOrder}
        />
      )}

      {/*isAdminUser && (
        <OrderTestModal
          isOpen={isOrderTestOpen}
          onClose={handleOrderTestClose}
          onProceed={handleProceedToAccessories}
          proceedDisabled={isPreparingOrderSummary}
          projectTitle={orderTestSummary?.projectTitle || projectTitle}
          totalSigns={orderTestSummary?.totalSigns || 0}
          accessories={orderTestSummary?.accessories || []}
          signs={orderTestSummary?.signs || []}
        />
      )*/}

      <CartAccessoriesModal
        isOpen={isCartAccessoriesOpen}
        onClose={handleCartAccessoriesClose}
        onProceed={handleProceedToCheckout}
        proceedDisabled={isAddingToCart}
        title="The Accessories you selected:"
        items={cartAccessories}
        onToggle={toggleCartAccessory}
        onSetQty={setCartAccessoryQty}
        onInc={(id) => changeCartAccessoryQty(id, 1)}
        onDec={(id) => changeCartAccessoryQty(id, -1)}
      />

      {isCheckoutOpen && (
        <Checkout
          onClose={handleCheckoutClose}
          onPlaceOrder={handleCheckoutPlaceOrder}
          onBackToAccessories={handleBackToAccessories}
          projectTitle={projectTitle}
          discountPercent={Number(discountPercent || 0)}
          discountAmount={Number(discountAmount || 0)}
          netAfterDiscount={Number(netAfterDiscount || 0)}
          orderSubtotal={Number(orderSubtotal || 0)}
          accessoriesPrice={Number(accessoriesPrice || 0)}
          selectedAccessories={Array.isArray(cartAccessories) ? cartAccessories.filter(x => x?.checked) : []}
        />
      )}

      {isOrderSuccessOpen && (
        <ThankYou
          setData={setReviews}
          onClose={handleOrderSuccessClose}
          onSend={handleOrderSuccessSend}
        />
      )}
    </div>
  );
};

export default InfoAboutProject;

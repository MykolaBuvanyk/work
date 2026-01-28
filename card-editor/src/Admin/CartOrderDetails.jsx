import React, { useCallback, useMemo, useState } from "react";
import "./OrderContainer.scss";
import { useLocation, useNavigate } from "react-router-dom";
import { clearAllUnsavedSigns, putProject } from "../utils/projectStorage";

const getLangPrefix = (pathname) => {
  const m = String(pathname || "").match(/^\/([a-z]{2})(\/|$)/i);
  return m ? `/${m[1]}` : "";
};

const CartOrderDetails = ({ order, isLoading }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpening, setIsOpening] = useState(false);

  const accessoriesText = useMemo(() => {
    const list = order?.accessories;
    if (!Array.isArray(list) || list.length === 0) return "";

    return list
      .map((a) => {
        const name = a?.title || a?.name || a?.id || "Accessory";
        const qty = a?.qty ?? a?.count ?? 1;
        return `${qty} ${name}`;
      })
      .join("; ");
  }, [order]);

  const canvasesLines = useMemo(() => {
    const canvases = order?.project?.canvases;
    if (!Array.isArray(canvases) || canvases.length === 0) return [];

    const formatNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const formatSize = (c) => {
      const mmW = formatNumber(c?.toolbarState?.sizeValues?.width);
      const mmH = formatNumber(c?.toolbarState?.sizeValues?.height);
      if (mmW != null && mmH != null) return `${mmW}×${mmH} mm`;

      const pxW = formatNumber(c?.width);
      const pxH = formatNumber(c?.height);
      if (pxW != null && pxH != null) return `${Math.round(pxW)}×${Math.round(pxH)} px`;

      return "Unknown size";
    };

    const formatThickness = (c) => {
      const t = formatNumber(c?.Thickness ?? c?.toolbarState?.thickness ?? c?.thickness);
      return t == null ? "—" : String(t);
    };

    const formatTape = (c) => {
      const tape = c?.Tape;
      if (typeof tape === "string" && tape.trim()) return tape.trim().toUpperCase();
      return c?.toolbarState?.isAdhesiveTape === true ? "TAPE" : "NO TAPE";
    };

    const formatColorTheme = (c) => {
      const ct = c?.ColorTheme;
      if (typeof ct === "string" && ct.trim()) return ct.trim();
      return "UNKNOWN";
    };

    return canvases.map((c, idx) => {
      const name = c?.name || c?.title || `Canvas ${idx + 1}`;
      return `${idx + 1}. ${name} — ${formatSize(c)} — ${formatColorTheme(c)} — Thickness: ${formatThickness(c)} — ${formatTape(c)}`;
    });
  }, [order]);

  const openProject = useCallback(async () => {
    const project = order?.project;
    if (!project || typeof project !== "object") {
      alert("No project snapshot in this order");
      return;
    }
    if (!project.id) {
      alert("Project snapshot has no id");
      return;
    }

    setIsOpening(true);
    try {
      // Safety: mimic existing project switch behavior
      try {
        await clearAllUnsavedSigns();
      } catch {}
      try {
        localStorage.removeItem("currentUnsavedSignId");
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent("unsaved:signsUpdated"));
      } catch {}

      await putProject(project);

      try {
        localStorage.setItem("currentProjectId", project.id);
        localStorage.setItem("currentProjectName", project.name || order?.projectName || "");
      } catch {}

      const first = Array.isArray(project.canvases) ? project.canvases[0] : null;
      if (first?.id) {
        try {
          localStorage.setItem("currentCanvasId", first.id);
          localStorage.setItem("currentProjectCanvasId", first.id);
          localStorage.setItem("currentProjectCanvasIndex", "0");
        } catch {}
        try {
          if (typeof window !== "undefined") {
            window.__currentProjectCanvasId = first.id;
            window.__currentProjectCanvasIndex = 0;
          }
        } catch {}
      } else {
        try {
          localStorage.removeItem("currentCanvasId");
          localStorage.removeItem("currentProjectCanvasId");
          localStorage.removeItem("currentProjectCanvasIndex");
        } catch {}
        try {
          if (typeof window !== "undefined") {
            window.__currentProjectCanvasId = null;
            window.__currentProjectCanvasIndex = null;
          }
        } catch {}
      }

      try {
        window.dispatchEvent(
          new CustomEvent("project:opened", {
            detail: { projectId: project.id },
          })
        );
      } catch {}

      const prefix = getLangPrefix(location.pathname);
      navigate(prefix || "/");
    } catch (e) {
      console.error("Failed to open ordered project", e);
      alert(e?.message || "Failed to open ordered project");
    } finally {
      setIsOpening(false);
    }
  }, [location.pathname, navigate, order]);

  if (isLoading) {
    return (
      <div className="order-container">
        <div className="row">
          <p>Order</p>
          <span>Loading...</span>
          <div />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="order-container">
        <div className="row">
          <p>Order</p>
          <span>Select an order</span>
          <div />
        </div>
      </div>
    );
  }

  const canvasesCount = Array.isArray(order?.project?.canvases) ? order.project.canvases.length : 0;

  return (
    <div className="order-container">
      <div className="row">
        <p>Order ID</p>
        <span>{order.id}</span>
        <div />
      </div>
      <div className="row">
        <p>Project</p>
        <span>{order.projectName}</span>
        <div />
      </div>
      <div className="row">
        <p>Customer No</p>
        <span>{order.userId}</span>
        <div />
      </div>
      <div className="row">
        <p>Canvases</p>
        <span>{canvasesCount}</span>
        <div />
      </div>
      <div className="row">
        <p>Price</p>
        <span>{order.price}</span>
        <div />
      </div>
      <div className="row">
        <p>Discount</p>
        <span>
          {order.discountPercent}% ({order.discountAmount})
        </span>
        <div />
      </div>
      <div className="row">
        <p>Total</p>
        <span>{order.totalPrice}</span>
        <div />
      </div>
      <div className="row">
        <p>Status</p>
        <span>{order.status}</span>
        <div className="open" onClick={isOpening ? undefined : openProject} style={{ cursor: "pointer" }}>
          {isOpening ? "Opening..." : "Open Project"}
        </div>
      </div>

      {accessoriesText ? (
        <div className="row">
          <p>Accessories:</p>
          <span className="mol">{accessoriesText}</span>
          <div />
        </div>
      ) : null}

      {canvasesLines.length ? (
        <div className="row">
          <p>Canvas details</p>
          <span className="mol">
            {canvasesLines.map((line, idx) => (
              <span key={idx} style={{ display: "block", marginBottom: 4 }}>
                {line}
              </span>
            ))}
          </span>
          <div />
        </div>
      ) : null}

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
        Debug: this screen is read-only
      </div>
    </div>
  );
};

export default CartOrderDetails;

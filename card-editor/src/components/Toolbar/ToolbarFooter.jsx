import React, { useEffect, useMemo, useState } from "react";
import styles from "./Toolbar.module.css";
import { useCanvasContext } from "../../contexts/CanvasContext";

const ToolbarFooter = () => {
  const { designs, currentDesignId } = useCanvasContext();

  const [orderInfo, setOrderInfo] = useState({
    order: [],
    index: -1,
    total: 0,
  });
  const [manufacturerNote, setManufacturerNote] = useState('');

  // Compute current/total using context or window helper
  const currentIndex = useMemo(() => {
    if (orderInfo.index >= 0) return orderInfo.index;
    if (Array.isArray(designs) && designs.length) {
      const idx = designs.findIndex((d) => d?.id === currentDesignId);
      return idx;
    }
    return -1;
  }, [orderInfo.index, designs, currentDesignId]);

  const total = useMemo(() => {
    if (orderInfo.total > 0) return orderInfo.total;
    return Array.isArray(designs) ? designs.length : 0;
  }, [orderInfo.total, designs]);

  useEffect(() => {
    // Expose getter/setter for manufacturer note so other UI can read it
    try {
      window.getManufacturerNote = () => String(window._manufacturerNote || manufacturerNote || '').trim();
      window.setManufacturerNote = (v) => {
        window._manufacturerNote = String(v || '');
        try {
          setManufacturerNote(String(v || ''));
        } catch {}
      };
    } catch {}

    if (typeof window.getCanvasOrderInfo === "function") {
      try {
        setOrderInfo(
          window.getCanvasOrderInfo() || { order: [], index: -1, total: 0 }
        );
      } catch {}
    }
    const handler = () => {
      if (typeof window.getCanvasOrderInfo === "function") {
        try {
          setOrderInfo(
            window.getCanvasOrderInfo() || { order: [], index: -1, total: 0 }
          );
        } catch {}
      }
    };
    const readyHandler = () => {
      if (typeof window.getCanvasOrderInfo === "function") {
        try {
          setOrderInfo(
            window.getCanvasOrderInfo() || { order: [], index: -1, total: 0 }
          );
        } catch {}
      }
    };
    window.addEventListener("canvas:loaded", handler);
    window.addEventListener("unsaved:signsUpdated", handler);
    window.addEventListener("project:canvasesUpdated", handler);
    window.addEventListener("grid:navigationReady", readyHandler);
    return () => {
      try {
        delete window.getManufacturerNote;
      } catch {}
      try {
        delete window.setManufacturerNote;
      } catch {}

      window.removeEventListener("canvas:loaded", handler);
      window.removeEventListener("unsaved:signsUpdated", handler);
      window.removeEventListener("project:canvasesUpdated", handler);
      window.removeEventListener("grid:navigationReady", readyHandler);
    };
  }, []);

  // Keep global getter in sync when note changes
  useEffect(() => {
    try {
      window.getManufacturerNote = () => String(window._manufacturerNote || manufacturerNote || '').trim();
    } catch {}
  }, [manufacturerNote]);

  const goFirst = () => {
    if (orderInfo.order.length) {
      const id = orderInfo.order[0];
      if (typeof window.openCanvasById === "function")
        window.openCanvasById(id);
    }
  };
  const goPrev = () => {
    if (orderInfo.order.length && currentIndex > 0) {
      const id = orderInfo.order[currentIndex - 1];
      if (typeof window.openCanvasById === "function")
        window.openCanvasById(id);
    }
  };
  const goNext = () => {
    if (
      orderInfo.order.length &&
      currentIndex >= 0 &&
      currentIndex < orderInfo.order.length - 1
    ) {
      const id = orderInfo.order[currentIndex + 1];
      if (typeof window.openCanvasById === "function")
        window.openCanvasById(id);
    }
  };
  const goLast = () => {
    if (orderInfo.order.length) {
      const id = orderInfo.order[orderInfo.order.length - 1];
      if (typeof window.openCanvasById === "function")
        window.openCanvasById(id);
    }
  };

  const currentDisplay = currentIndex >= 0 ? currentIndex + 1 : 0;

  const atStart = currentIndex <= 0;
  const atEnd =
    currentIndex === orderInfo.order.length - 1 && orderInfo.order.length > 0;

  return (
    <div className={styles.toolbarFooter}>
      <div className={styles.footerTopRow}>
        <div className={styles.footerInfo}>
          <span>Your Signs:</span>
          <span className={styles.footerPageCount}>
            <span>{currentDisplay}</span>
            <span>/</span>
            <span>{total}</span>
          </span>
        </div>
        <div className={styles.footerButtons}>
          <svg
            onClick={atStart ? undefined : goFirst}
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              cursor: atStart ? "not-allowed" : "pointer",
              opacity: atStart ? 0.4 : 1,
            }}
          >
            <path
              d="M5.75 6C5.75 5.58579 5.41421 5.25 5 5.25C4.58579 5.25 4.25 5.58579 4.25 6V18C4.25 18.4142 4.58579 18.75 5 18.75C5.41421 18.75 5.75 18.4142 5.75 18L5.75 6Z"
              fill="#006CA4"
            />
            <path
              d="M15.4876 5.26403C14.8108 5.19165 14.1377 5.40679 13.4158 5.74553C12.6974 6.08265 11.8179 6.59929 10.7072 7.25181L10.6385 7.29216C9.52757 7.94478 8.64816 8.46139 8.00218 8.92578C7.3519 9.39325 6.83666 9.8763 6.56316 10.5013C6.14561 11.4556 6.14561 12.5444 6.56316 13.4987C6.83666 14.1237 7.3519 14.6067 8.00217 15.0742C8.64816 15.5386 9.52756 16.0552 10.6385 16.7078L10.7072 16.7482C11.818 17.4007 12.6974 17.9174 13.4158 18.2545C14.1377 18.5932 14.8108 18.8083 15.4876 18.736C16.5193 18.6256 17.4524 18.0755 18.0575 17.228C18.4528 16.6745 18.6054 15.9813 18.6779 15.1776C18.75 14.3774 18.75 13.3453 18.75 12.0389V11.961C18.75 10.6547 18.75 9.62257 18.6779 8.82239C18.6054 8.01875 18.4528 7.32545 18.0575 6.77195C17.4524 5.92453 16.5193 5.37436 15.4876 5.26403Z"
              fill="#006CA4"
            />
          </svg>
          <svg
            onClick={atStart ? undefined : goPrev}
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              cursor: atStart ? "not-allowed" : "pointer",
              opacity: atStart ? 0.4 : 1,
            }}
          >
            <path
              d="M8.92674 5.20654C10.6588 4.21896 12.0042 3.45183 13.0969 2.95418C14.1936 2.45466 15.1457 2.17257 16.0714 2.26865C17.5406 2.42116 18.8781 3.18242 19.7497 4.36721C20.3003 5.11557 20.5295 6.07608 20.64 7.26521C20.75 8.44959 20.75 9.98465 20.75 11.9588V12.0411C20.75 14.0153 20.75 15.5504 20.64 16.7347C20.5295 17.9239 20.3003 18.8844 19.7497 19.6327C18.8781 20.8175 17.5406 21.5788 16.0714 21.7313C15.1457 21.8274 14.1936 21.5453 13.0969 21.0458C12.0042 20.5481 10.6588 19.781 8.92677 18.7934L8.85646 18.7533C7.12452 17.7658 5.77908 16.9987 4.79622 16.3129C3.81056 15.6252 3.08401 14.9503 2.70304 14.1052C2.09899 12.7654 2.09899 11.2346 2.70304 9.89473C3.08401 9.04969 3.81056 8.37477 4.79622 7.68703C5.77908 7.00126 7.12453 6.23412 8.85647 5.24661L8.92674 5.20654Z"
              fill="#006CA4"
            />
          </svg>
          <svg
            onClick={atEnd ? undefined : goNext}
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              cursor: atEnd ? "not-allowed" : "pointer",
              opacity: atEnd ? 0.4 : 1,
            }}
          >
            <path
              d="M15.0733 5.20654C13.3412 4.21896 11.9958 3.45183 10.9031 2.95418C9.80638 2.45466 8.85435 2.17257 7.92862 2.26865C6.45941 2.42116 5.1219 3.18242 4.25027 4.36721C3.69972 5.11557 3.47048 6.07608 3.36002 7.26521C3.24999 8.44959 3.25 9.98465 3.25 11.9588V12.0411C3.24999 14.0153 3.24999 15.5504 3.36002 16.7347C3.47048 17.9239 3.69972 18.8844 4.25027 19.6327C5.1219 20.8175 6.45941 21.5788 7.92862 21.7313C8.85435 21.8274 9.80638 21.5453 10.9031 21.0458C11.9958 20.5481 13.3412 19.781 15.0732 18.7934L15.1435 18.7533C16.8755 17.7658 18.2209 16.9987 19.2038 16.3129C20.1894 15.6252 20.916 14.9503 21.297 14.1052C21.901 12.7654 21.901 11.2346 21.297 9.89473C20.916 9.04969 20.1894 8.37477 19.2038 7.68703C18.2209 7.00126 16.8755 6.23412 15.1435 5.24661L15.0733 5.20654Z"
              fill="#006CA4"
            />
          </svg>
          <svg
            onClick={atEnd ? undefined : goLast}
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              cursor: atEnd ? "not-allowed" : "pointer",
              opacity: atEnd ? 0.4 : 1,
            }}
          >
            <path
              d="M19.75 6C19.75 5.58579 19.4142 5.25 19 5.25C18.5858 5.25 18.25 5.58579 18.25 6V18C18.25 18.4142 18.5858 18.75 19 18.75C19.4142 18.75 19.75 18.4142 19.75 18V6Z"
              fill="#006CA4"
            />
            <path
              d="M13.2928 7.25183C12.1821 6.59931 11.3026 6.08265 10.5842 5.74553C9.86233 5.4068 9.18921 5.19165 8.5124 5.26403C7.48075 5.37436 6.54757 5.92453 5.94248 6.77195C5.54725 7.32545 5.3946 8.01875 5.32214 8.82239C5.24999 9.62258 5.24999 10.6547 5.25 11.9611V12.0389C5.24999 13.3453 5.24999 14.3774 5.32214 15.1776C5.3946 15.9813 5.54725 16.6745 5.94248 17.228C6.54757 18.0755 7.48074 18.6256 8.5124 18.736C9.18921 18.8083 9.86233 18.5932 10.5842 18.2545C11.3026 17.9174 12.1821 17.4007 13.2928 16.7482L13.3615 16.7078C14.4724 16.0552 15.3518 15.5386 15.9978 15.0742C16.6481 14.6067 17.1633 14.1237 17.4368 13.4987C17.8544 12.5444 17.8544 11.4556 17.4368 10.5013C17.1633 9.8763 16.6481 9.39325 15.9978 8.92578C15.3518 8.4614 14.4724 7.94479 13.3615 7.29217L13.2928 7.25183Z"
              fill="#006CA4"
            />
          </svg>
        </div>
      </div>

      <div className={styles.footerNoteSection}>
        <div className={styles.footerNoteTitle}>Note for the manufacturer</div>
        <input
          type="text"
          placeholder="Text"
          className={styles.footerNoteInput}
          value={manufacturerNote}
          onChange={(e) => {
            const v = e.target.value || '';
            setManufacturerNote(v);
            try {
              window._manufacturerNote = v;
            } catch {}
          }}
        />
      </div>
    </div>
  );
};

export default ToolbarFooter;

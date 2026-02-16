import React, { useState, useEffect } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import { useExcelImport } from "../../hooks/useExcelImport";
import {
  updateUnsavedSignFromCanvas,
  getAllUnsavedSigns,
  deleteUnsavedSign,
  addBlankUnsavedSign,
  deleteCanvasFromCurrentProject,
  getProject,
  updateCanvasInCurrentProject,
} from "../../utils/projectStorage";
import styles from "./Accessories.module.css";
import AccessoriesModal from "../AccessoriesModal/AccessoriesModal";
// Modal images (used only inside modal, but state lives here for two-way sync)
import imgCableTies from "/images/accessories/CableTies 1.png";
import imgPh95 from "/images/accessories/ph1 2.9 x 9.5 mm 1.png";
import imgPh13 from "/images/accessories/ph1 2.9 x 13 mm 1.png";
import imgSHook from "/images/accessories/S-Hook 1.png";
import imgKeyring from "/images/accessories/Keyring 1.png";
import imgBallchain from "/images/accessories/Ballchain 1.png";
import imgSHookSign from "/images/accessories/S-hook+sign 1.png";
import imgKeyringSign1 from "/images/accessories/Keyring+sign 1.png";
import imgKeyringSign2 from "/images/accessories/Keyring+sign 2.png";

const TopToolbar = ({ className, formData }) => {
  console.log(9432943294, formData);
  const { canvas } = useCanvasContext();
  const { importFromExcel } = useExcelImport();
  const [working, setWorking] = useState(false);
  const [isAccessoriesOpen, setAccessoriesOpen] = useState(false);
  const [hasCheckedCanvases, setHasCheckedCanvases] = useState(false);

  // Toolbar <-> Modal shared state
  const [accessories, setAccessories] = useState([
    {
      id: 1,
      name: "Cable ties",
      price: 0.05,
      desc: "Black plastic cable ties, size 3.6 × 140 mm",
      iconKey: "cable.svg",
      img: imgCableTies,
      hasExtra: false,
      checked: false,
      visible: false,
      qty: "1",
    },
    {
      id: 2,
      name: "Screws",
      price: 0.1,
      desc: "Size 2.9 × 9.5 mm",
      iconKey: "screws.svg",
      img: imgPh95,
      hasExtra: false,
      checked: false,
      visible: false,
      qty: "1",
    },
    {
      id: 3,
      name: "Screws 13 mm",
      price: 0.1,
      desc: "Size 2.9 × 13 mm",
      iconKey: "screws.svg",
      img: imgPh13,
      hasExtra: false,
      checked: false,
      visible: false,
      qty: "1",
    },
    {
      id: 4,
      name: "S-Hooks",
      price: 0.25,
      desc: "Nickel plated",
      iconKey: "s-hook.svg",
      img: imgSHook,
      extraImg: imgSHookSign,
      hasExtra: true,
      checked: false,
      visible: false,
      qty: "1",
    },
    {
      id: 5,
      name: "Keyrings",
      price: 0.7,
      desc: "30 mm",
      iconKey: "keyring.svg",
      img: imgKeyring,
      extraImg: imgKeyringSign1,
      hasExtra: true,
      checked: false,
      visible: false,
      qty: "1",
    },
    {
      id: 6,
      name: "Ball chains",
      price: 0.25,
      desc: "Nickel plated, length 10 cm",
      iconKey: "ballchain.svg",
      img: imgBallchain,
      extraImg: imgKeyringSign2,
      hasExtra: true,
      checked: false,
      visible: false,
      qty: "1",
    },
  ]);

  // Toolbar icons - using direct paths to public folder
  const svgIcons = React.useMemo(() => {
    const iconFiles = [
      "cable.svg",
      "screws.svg",
      "S-Hook.svg",
      "Keyring.svg",
      "Ballchain.svg"
    ];
    const map = {};
    iconFiles.forEach((file) => {
      map[file] = `/images/accessories/${file}`;
      map[file.toLowerCase()] = `/images/accessories/${file}`;
    });
    return map;
  }, []);

  const parseNumber = (raw) => {
    if (raw === "") return 0;
    const n = parseFloat(String(raw).replace(",", "."));
    return isNaN(n) || n < 0 ? 0 : Math.floor(n);
  };

  const toggleAccessory = (id) =>
    setAccessories((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, checked: !it.checked, visible: true } : it
      )
    );
  const setQty = (id, rawVal) =>
    setAccessories((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, qty: rawVal, visible: true } : it
      )
    );
  const changeQty = (id, delta) =>
    setAccessories((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next = Math.max(0, parseNumber(it.qty) + delta);
        return { ...it, qty: String(next), visible: true };
      })
    );

  const formatPrice = (val) => `€ ${val.toFixed(2)}`;
  const extractSize = (desc) => {
    if (!desc) return "";
    const m = desc.match(/(\d+(?:[.,]\d+)?)\s*[×x*]\s*(\d+(?:[.,]\d+)?)/i);
    if (!m) return "";
    return `${m[1].replace(",", ".")} × ${m[2].replace(",", ".")}`;
  };
  const displayName = (it) => {
    if (it.name.toLowerCase() === "screws") {
      const sz = extractSize(it.desc);
      return sz ? `${it.name} ${sz}` : it.name;
    }
    return it.name;
  };

  const openAccessories = () => setAccessoriesOpen(true);
  const closeAccessories = () => setAccessoriesOpen(false);

  const handleNewSign = async () => {
    if (working) return;
    setWorking(true);
    try {
      let currentUnsavedId = null;
      try {
        currentUnsavedId = localStorage.getItem("currentUnsavedSignId");
      } catch { }
      if (currentUnsavedId && canvas) {
        await updateUnsavedSignFromCanvas(currentUnsavedId, canvas).catch(
          () => { }
        );
      }

      // Розміри прямокутника за замовчуванням (120x80 мм при 96 DPI)
      const PX_PER_MM = 72 / 25.4;
      const DEFAULT_WIDTH = Math.round(120 * PX_PER_MM); // ~453 px
      const DEFAULT_HEIGHT = Math.round(80 * PX_PER_MM); // ~302 px

      const newSign = await addBlankUnsavedSign(DEFAULT_WIDTH, DEFAULT_HEIGHT);

      try {
        window.dispatchEvent(new CustomEvent("unsaved:signsUpdated"));
      } catch { }

      // НОВЕ: Автоматично відкриваємо новостворене полотно
      setTimeout(() => {
        try {
          window.dispatchEvent(
            new CustomEvent("canvas:autoOpen", {
              detail: { canvasId: newSign.id, isUnsaved: true }
            })
          );
          console.log("Auto-opening new canvas:", newSign.id);
        } catch (err) {
          console.error("Failed to auto-open new canvas:", err);
        }
      }, 300);
    } catch (e) {
      console.error("New Sign failed", e);
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteSign = async () => {
    if (working) return;
    setWorking(true);
    try {
      let currentUnsavedId = null;
      let currentProjectCanvasId = null;
      let currentProjectId = null;

      try {
        currentUnsavedId = localStorage.getItem("currentUnsavedSignId");
        currentProjectCanvasId =
          localStorage.getItem("currentProjectCanvasId") ||
          localStorage.getItem("currentCanvasId");
        currentProjectId = localStorage.getItem("currentProjectId");
      } catch { }

      // Визначаємо активний тип полотна (не видаляємо обидва одночасно)
      const activeMode = currentUnsavedId
        ? "unsaved"
        : currentProjectCanvasId && currentProjectId
          ? "project"
          : null;
      const isUnsavedSign = activeMode === "unsaved";
      const isProjectCanvas = activeMode === "project";

      if (!isUnsavedSign && !isProjectCanvas) {
        console.log("No canvas to delete");
        setWorking(false);
        return;
      }

      const sortUnsavedByCreated = (list) => {
        return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
          const timeA = Number(a?.createdAt) || 0;
          const timeB = Number(b?.createdAt) || 0;
          return timeA - timeB;
        });
      };

      let projectDeleteIndex = -1;
      let unsavedDeleteIndex = -1;

      if (isProjectCanvas) {
        const projectBefore = await getProject(currentProjectId);
        const projectCanvasesBefore = Array.isArray(projectBefore?.canvases)
          ? projectBefore.canvases
          : [];
        projectDeleteIndex = projectCanvasesBefore.findIndex(
          (entry) => entry?.id === currentProjectCanvasId
        );
      }

      if (isUnsavedSign) {
        const unsavedBefore = sortUnsavedByCreated(await getAllUnsavedSigns());
        unsavedDeleteIndex = unsavedBefore.findIndex(
          (entry) => entry?.id === currentUnsavedId
        );
      }

      // Видаляємо unsaved sign
      if (isUnsavedSign) {
        console.log("Deleting unsaved sign:", currentUnsavedId);

        // Persist final state before removal (optional safety)
        if (canvas) {
          await updateUnsavedSignFromCanvas(currentUnsavedId, canvas).catch(
            () => { }
          );
        }

        await deleteUnsavedSign(currentUnsavedId);

        try {
          localStorage.removeItem("currentUnsavedSignId");
        } catch { }

        // Тригеримо оновлення
        try {
          window.dispatchEvent(new CustomEvent("unsaved:signsUpdated"));
        } catch { }
      }

      // Видаляємо canvas з проекту
      if (isProjectCanvas) {
        console.log("Deleting project canvas:", currentProjectCanvasId);

        // Persist final state before removal (optional safety)
        if (canvas) {
          await updateCanvasInCurrentProject(currentProjectCanvasId, canvas).catch(
            () => { }
          );
        }

        await deleteCanvasFromCurrentProject(currentProjectCanvasId);

        try {
          localStorage.removeItem("currentCanvasId");
          localStorage.removeItem("currentProjectCanvasId");
          localStorage.removeItem("currentProjectCanvasIndex");
        } catch { }
        try {
          if (typeof window !== "undefined") {
            window.__currentProjectCanvasId = null;
            window.__currentProjectCanvasIndex = null;
          }
        } catch { }

        // Тригеримо оновлення проекту
        try {
          window.dispatchEvent(
            new CustomEvent("project:canvasesUpdated", {
              detail: { projectId: currentProjectId }
            })
          );
        } catch { }
      }

      // Активуємо попереднє полотно після видалення
      let nextCanvasToLoad = null;

      if (isProjectCanvas && currentProjectId) {
        const project = await getProject(currentProjectId);
        if (project && project.canvases && project.canvases.length > 0) {
          const targetIndex = Math.max(0, (projectDeleteIndex > 0 ? projectDeleteIndex - 1 : 0));
          const safeIndex = Math.min(targetIndex, project.canvases.length - 1);
          nextCanvasToLoad = project.canvases[safeIndex];

          try {
            localStorage.setItem("currentCanvasId", nextCanvasToLoad.id);
            localStorage.setItem("currentProjectCanvasId", nextCanvasToLoad.id);
            localStorage.setItem("currentProjectCanvasIndex", String(safeIndex));
            localStorage.removeItem("currentUnsavedSignId");
          } catch { }
          try {
            if (typeof window !== "undefined") {
              window.__currentProjectCanvasId = nextCanvasToLoad.id;
              window.__currentProjectCanvasIndex = safeIndex;
            }
          } catch { }

          try {
            window.dispatchEvent(
              new CustomEvent("canvas:autoOpen", {
                detail: { canvasId: nextCanvasToLoad.id, isUnsaved: false },
              })
            );
          } catch { }

          console.log("Loaded next project canvas:", nextCanvasToLoad.id);
          setWorking(false);
          return;
        }
      }

      // Якщо проектних полотен немає (або видаляли unsaved), перевіряємо unsaved signs
      const remaining = sortUnsavedByCreated(await getAllUnsavedSigns());
      if (remaining.length > 0) {
        const targetIndex = Math.max(0, (unsavedDeleteIndex > 0 ? unsavedDeleteIndex - 1 : 0));
        const safeIndex = Math.min(targetIndex, remaining.length - 1);
        nextCanvasToLoad = remaining[safeIndex];

        try {
          localStorage.setItem("currentCanvasId", nextCanvasToLoad.id);
          localStorage.setItem("currentUnsavedSignId", nextCanvasToLoad.id);
          localStorage.removeItem("currentProjectCanvasId");
          localStorage.removeItem("currentProjectCanvasIndex");
        } catch { }
        try {
          if (typeof window !== "undefined") {
            window.__currentProjectCanvasId = null;
            window.__currentProjectCanvasIndex = null;
          }
        } catch { }

        try {
          window.dispatchEvent(new CustomEvent("unsaved:signsUpdated"));
          window.dispatchEvent(
            new CustomEvent("canvas:autoOpen", {
              detail: { canvasId: nextCanvasToLoad.id, isUnsaved: true },
            })
          );
        } catch { }

        console.log("Loaded next unsaved sign:", nextCanvasToLoad.id);
      } else {
        // Немає жодних полотен - очищаємо canvas
        console.log("No more canvases available, clearing canvas");

        if (canvas) {
          canvas.__suspendUndoRedo = true;
          canvas.clear();
          canvas.renderAll();
          canvas.__suspendUndoRedo = false;
        }

        // Скидаємо флаг перевірки, щоб автоматично створити нове полотно
        setHasCheckedCanvases(false);
      }
    } catch (e) {
      console.error("Delete Sign failed", e);
    } finally {
      setWorking(false);
    }
  };

  // Автоматично створюємо дефолтне полотно якщо проект порожній
  useEffect(() => {
    if (!canvas || hasCheckedCanvases || working) return;

    const checkAndCreateCanvas = async () => {
      try {
        // ВИПРАВЛЕННЯ: Додаємо затримку щоб дати час іншим компонентам створити полотна


        // Отримуємо всі unsaved signs
        const unsavedSigns = await getAllUnsavedSigns();

        // Перевіряємо чи є полотна в проекті
        let projectCanvasCount = 0;
        try {
          const projectId = localStorage.getItem("currentProjectId");
          if (projectId) {
            const { getProject } = await import("../../utils/projectStorage");
            const project = await getProject(projectId);
            projectCanvasCount = project?.canvases?.length || 0;
          }
        } catch (err) {
          console.warn("Could not check project canvases:", err);
        }

        const totalCanvases = unsavedSigns.length + projectCanvasCount;

        console.log("Canvas check (delayed):", {
          unsavedSigns: unsavedSigns.length,
          projectCanvases: projectCanvasCount,
          total: totalCanvases
        });

        // Якщо немає жодного полотна - створюємо дефолтне
        if (totalCanvases < 1) {
          console.log("No canvases found after delay, creating default canvas");

          // Розміри прямокутника за замовчуванням (120x80 мм при 96 DPI)
          const PX_PER_MM = 72 / 25.4;
          const DEFAULT_WIDTH = Math.round(120 * PX_PER_MM); // ~453 px
          const DEFAULT_HEIGHT = Math.round(80 * PX_PER_MM); // ~302 px

          const newSign = await addBlankUnsavedSign(DEFAULT_WIDTH, DEFAULT_HEIGHT);

          // Оновлюємо localStorage
          try {
            localStorage.setItem("currentUnsavedSignId", newSign.id);
          } catch { }

          // Тригеримо подію оновлення
          try {
            window.dispatchEvent(new CustomEvent("unsaved:signsUpdated"));
          } catch { }

          console.log("Default canvas created:", newSign.id);

          // НОВЕ: Автоматично відкриваємо створене полотно
          // Чекаємо трохи щоб ProjectCanvasesGrid встиг оновитись
          setTimeout(() => {
            try {
              window.dispatchEvent(
                new CustomEvent("canvas:autoOpen", {
                  detail: { canvasId: newSign.id, isUnsaved: true }
                })
              );
              console.log("Auto-opening created canvas:", newSign.id);
            } catch (err) {
              console.error("Failed to auto-open canvas:", err);
            }
          }, 300);
        } else {
          console.log("Canvases already exist, skipping auto-creation");
        }

        setHasCheckedCanvases(true);
      } catch (error) {
        console.error("Failed to check/create default canvas:", error);
        setHasCheckedCanvases(true); // Встановлюємо флаг навіть при помилці
      }
    };

    checkAndCreateCanvas();

    // Слухаємо подію створення полотна з інших компонентів
    const handleCanvasCreated = () => {
      console.log("Canvas created event received, marking as checked");
      setHasCheckedCanvases(true);
    };

    window.addEventListener("canvas:created", handleCanvasCreated);
    window.addEventListener("unsaved:signsUpdated", handleCanvasCreated);

    return () => {
      window.removeEventListener("canvas:created", handleCanvasCreated);
      window.removeEventListener("unsaved:signsUpdated", handleCanvasCreated);
    };
  }, [canvas, hasCheckedCanvases, working]);

  useEffect(() => {
    const hydrateAccessories = async () => {
      let filterAccessories = accessories.filter(
        (x) => formData.listAccessories.find((y) => y.text == x.name).isAvaible
      );
      filterAccessories = filterAccessories.map((x) => ({
        ...x,
        price: formData.listAccessories.find((y) => x.name == y.text).number,
      }));

      let pending = [];
      try {
        const rawLocal = localStorage.getItem("pendingOpenedProjectAccessories");
        const rawSession = sessionStorage.getItem("pendingOpenedProjectAccessories");
        const parsedLocal = rawLocal ? JSON.parse(rawLocal) : [];
        const parsedSession = rawSession ? JSON.parse(rawSession) : [];
        pending = Array.isArray(parsedLocal) && parsedLocal.length > 0
          ? parsedLocal
          : Array.isArray(parsedSession) && parsedSession.length > 0
            ? parsedSession
            : [];
      } catch {
        pending = [];
      }

      if (!Array.isArray(pending) || pending.length === 0) {
        try {
          const currentProjectId = localStorage.getItem("currentProjectId");
          if (currentProjectId) {
            const currentProject = await getProject(currentProjectId);
            const fromProject = Array.isArray(currentProject?.accessories)
              ? currentProject.accessories
              : [];
            if (fromProject.length > 0) {
              pending = fromProject;
            }
          }
        } catch {
          // no-op
        }
      }

      if (Array.isArray(pending) && pending.length > 0) {
        const byId = new Map();
        const byName = new Map();
        pending.forEach((item) => {
          if (!item || typeof item !== "object") return;
          if (item.id != null) byId.set(String(item.id), item);
          if (item.name != null) byName.set(String(item.name).trim().toLowerCase(), item);
        });

        filterAccessories = filterAccessories.map((item) => {
          const matchById = item?.id != null ? byId.get(String(item.id)) : null;
          const matchByName = item?.name != null ? byName.get(String(item.name).trim().toLowerCase()) : null;
          const incoming = matchById || matchByName;
          if (!incoming) {
            return {
              ...item,
              checked: false,
              visible: false,
              qty: "1",
            };
          }

          const qtyRaw = Number(incoming.qty);
          const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.floor(qtyRaw) : 1;

          return {
            ...item,
            checked: true,
            visible: true,
            qty: String(qty),
          };
        });

        try {
          localStorage.removeItem("pendingOpenedProjectAccessories");
          sessionStorage.removeItem("pendingOpenedProjectAccessories");
        } catch {
          // no-op
        }
      }

      setAccessories(filterAccessories);
    };

    hydrateAccessories();
  }, [formData]);

  useEffect(() => {
    const resetAccessories = () => {
      setAccessories((prev) =>
        (Array.isArray(prev) ? prev : []).map((item) => ({
          ...item,
          checked: false,
          visible: false,
          qty: "1",
        }))
      );
      try {
        localStorage.removeItem("pendingOpenedProjectAccessories");
        sessionStorage.removeItem("pendingOpenedProjectAccessories");
      } catch {
        // no-op
      }
    };

    window.addEventListener("accessories:reset", resetAccessories);
    return () => {
      window.removeEventListener("accessories:reset", resetAccessories);
    };
  }, []);

  console.log(3434, accessories);
  useEffect(() => {
    try {
      window.getSelectedAccessories = () => accessories;
      window.setSelectedAccessories = (nextAccessories) => {
        if (!Array.isArray(nextAccessories)) return;
        setAccessories((prev) => {
          const byId = new Map(nextAccessories.map((item) => [item?.id, item]));
          return (Array.isArray(prev) ? prev : []).map((item) => {
            const incoming = byId.get(item?.id);
            if (!incoming) return item;
            return {
              ...item,
              checked: !!incoming.checked,
              qty: String(incoming.qty ?? item.qty ?? "1"),
              visible:
                incoming.visible !== undefined
                  ? !!incoming.visible
                  : item.visible || !!incoming.checked,
            };
          });
        });
      };
      window.dispatchEvent(
        new CustomEvent("accessories:changed", {
          detail: { accessories },
        })
      );
    } catch {
      // no-op
    }

    return () => {
      try {
        if (window.getSelectedAccessories && window.getSelectedAccessories() === accessories) {
          delete window.getSelectedAccessories;
        }
        if (window.setSelectedAccessories) {
          delete window.setSelectedAccessories;
        }
      } catch {
        // no-op
      }
    };
  }, [accessories]);

  return (
    <div className={`${styles.accessories} ${className}`}>
      <div className={styles.firstPart}>
        <ul className={styles.toolbarList}>
          <li
            className={styles.toolbarItem}
            onClick={handleNewSign}
            title="Create new canvas (sign)"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g clip-path="url(#clip0_82_556)">
                <path
                  d="M5 -0.5H13.043L13.543 0H5C4.46957 0 3.96101 0.210865 3.58594 0.585938C3.21086 0.96101 3 1.46957 3 2V20C3 20.5304 3.21087 21.039 3.58594 21.4141C3.96101 21.7891 4.46957 22 5 22H17C17.5304 22 18.039 21.7891 18.4141 21.4141C18.7891 21.039 19 20.5304 19 20V5.45703L19.5 5.95703V20C19.5 20.663 19.2364 21.2987 18.7676 21.7676C18.2987 22.2364 17.663 22.5 17 22.5H5C4.33696 22.5 3.70126 22.2364 3.23242 21.7676C2.76358 21.2987 2.5 20.663 2.5 20V2C2.5 1.33696 2.76358 0.701263 3.23242 0.232422C3.70126 -0.236419 4.33696 -0.5 5 -0.5ZM11 9.25C11.0663 9.25 11.1299 9.27636 11.1768 9.32324C11.2236 9.37013 11.25 9.43369 11.25 9.5V12.25H14C14.0663 12.25 14.1299 12.2764 14.1768 12.3232C14.2236 12.3701 14.25 12.4337 14.25 12.5C14.25 12.5663 14.2236 12.6299 14.1768 12.6768C14.1299 12.7236 14.0663 12.75 14 12.75H11.25V15.5C11.25 15.5663 11.2236 15.6299 11.1768 15.6768C11.1299 15.7236 11.0663 15.75 11 15.75C10.9337 15.75 10.8701 15.7236 10.8232 15.6768C10.7764 15.6299 10.75 15.5663 10.75 15.5V12.75H8C7.93369 12.75 7.87013 12.7236 7.82324 12.6768C7.77636 12.6299 7.75 12.5663 7.75 12.5C7.75 12.4337 7.77636 12.3701 7.82324 12.3232C7.87013 12.2764 7.93369 12.25 8 12.25H10.75V9.5C10.75 9.4337 10.7764 9.37013 10.8232 9.32324C10.8701 9.27636 10.9337 9.25 11 9.25ZM18.793 5.25H15.5C15.0359 5.25 14.5909 5.06549 14.2627 4.7373C13.9345 4.40912 13.75 3.96413 13.75 3.5V0.207031L18.793 5.25Z"
                  fill="#34C759"
                  stroke="#017F01"
                />
              </g>
              <defs>
                <clipPath id="clip0_82_556">
                  <rect width="24" height="24" fill="white" />
                </clipPath>
              </defs>
            </svg>
            New Sign
          </li>
          <li
            className={styles.toolbarItem}
            onClick={handleDeleteSign}
            title="Delete current canvas (sign)"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18.5172 12.7795L19.26 12.8829L18.5172 12.7795ZM18.2549 14.6645L18.9977 14.7679L18.2549 14.6645ZM5.74514 14.6645L6.48798 14.5611L5.74514 14.6645ZM5.4828 12.7795L4.73996 12.8829L5.4828 12.7795ZM9.18365 21.7368L8.89206 22.4278L9.18365 21.7368ZM6.47508 18.5603L7.17907 18.3017L6.47508 18.5603ZM17.5249 18.5603L18.2289 18.819V18.819L17.5249 18.5603ZM14.8164 21.7368L14.5248 21.0458H14.5248L14.8164 21.7368ZM5.74664 8.92906C5.70746 8.5167 5.34142 8.21418 4.92906 8.25336C4.5167 8.29254 4.21418 8.65858 4.25336 9.07094L5.74664 8.92906ZM19.7466 9.07094C19.7858 8.65858 19.4833 8.29254 19.0709 8.25336C18.6586 8.21418 18.2925 8.5167 18.2534 8.92906L19.7466 9.07094ZM20 7.75C20.4142 7.75 20.75 7.41421 20.75 7C20.75 6.58579 20.4142 6.25 20 6.25V7.75ZM4 6.25C3.58579 6.25 3.25 6.58579 3.25 7C3.25 7.41421 3.58579 7.75 4 7.75V6.25ZM9.25 18C9.25 18.4142 9.58579 18.75 10 18.75C10.4142 18.75 10.75 18.4142 10.75 18H9.25ZM10.75 10C10.75 9.58579 10.4142 9.25 10 9.25C9.58579 9.25 9.25 9.58579 9.25 10H10.75ZM13.25 18C13.25 18.4142 13.5858 18.75 14 18.75C14.4142 18.75 14.75 18.4142 14.75 18H13.25ZM14.75 10C14.75 9.58579 14.4142 9.25 14 9.25C13.5858 9.25 13.25 9.58579 13.25 10H14.75ZM16 7V7.75H16.75V7H16ZM8 7H7.25V7.75H8V7ZM18.5172 12.7795L17.7744 12.6761L17.512 14.5611L18.2549 14.6645L18.9977 14.7679L19.26 12.8829L18.5172 12.7795ZM5.74514 14.6645L6.48798 14.5611L6.22564 12.6761L5.4828 12.7795L4.73996 12.8829L5.0023 14.7679L5.74514 14.6645ZM12 22V21.25C10.4708 21.25 9.92544 21.2358 9.47524 21.0458L9.18365 21.7368L8.89206 22.4278C9.68914 22.7642 10.6056 22.75 12 22.75V22ZM5.74514 14.6645L5.0023 14.7679C5.282 16.7777 5.43406 17.9017 5.77109 18.819L6.47508 18.5603L7.17907 18.3017C6.91156 17.5736 6.77851 16.6488 6.48798 14.5611L5.74514 14.6645ZM9.18365 21.7368L9.47524 21.0458C8.55279 20.6566 7.69496 19.7058 7.17907 18.3017L6.47508 18.5603L5.77109 18.819C6.3857 20.4918 7.48205 21.8328 8.89206 22.4278L9.18365 21.7368ZM18.2549 14.6645L17.512 14.5611C17.2215 16.6488 17.0884 17.5736 16.8209 18.3017L17.5249 18.5603L18.2289 18.819C18.5659 17.9017 18.718 16.7777 18.9977 14.7679L18.2549 14.6645ZM12 22V22.75C13.3944 22.75 14.3109 22.7642 15.1079 22.4278L14.8164 21.7368L14.5248 21.0458C14.0746 21.2358 13.5292 21.25 12 21.25V22ZM17.5249 18.5603L16.8209 18.3017C16.305 19.7058 15.4472 20.6566 14.5248 21.0458L14.8164 21.7368L15.1079 22.4278C16.5179 21.8328 17.6143 20.4918 18.2289 18.819L17.5249 18.5603ZM5.4828 12.7795L6.22564 12.6761C6.00352 11.08 5.83766 9.88703 5.74664 8.92906L5 9L4.25336 9.07094C4.34819 10.069 4.51961 11.2995 4.73996 12.8829L5.4828 12.7795ZM18.5172 12.7795L19.26 12.8829C19.4804 11.2995 19.6518 10.069 19.7466 9.07094L19 9L18.2534 8.92906C18.1623 9.88702 17.9965 11.08 17.7744 12.6761L18.5172 12.7795ZM20 7V6.25H4V7V7.75H20V7ZM10 18H10.75V10H10H9.25V18H10ZM14 18H14.75V10H14H13.25V18H14ZM16 6H15.25V7H16H16.75V6H16ZM16 7V6.25H8V7V7.75H16V7ZM8 7H8.75V6H8H7.25V7H8ZM12 2V2.75C13.7949 2.75 15.25 4.20507 15.25 6H16H16.75C16.75 3.37665 14.6234 1.25 12 1.25V2ZM12 2V1.25C9.37665 1.25 7.25 3.37665 7.25 6H8H8.75C8.75 4.20507 10.2051 2.75 12 2.75V2Z"
                fill="#FF3B30"
              />
            </svg>
            Delete sign
          </li>
          <li className={styles.toolbarItem} onClick={importFromExcel}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g clip-path="url(#clip0_82_562)">
                <path
                  d="M21 21V6.75L14.25 0H6C5.20435 0 4.44129 0.316071 3.87868 0.87868C3.31607 1.44129 3 2.20435 3 3V21C3 21.7956 3.31607 22.5587 3.87868 23.1213C4.44129 23.6839 5.20435 24 6 24H18C18.7956 24 19.5587 23.6839 20.1213 23.1213C20.6839 22.5587 21 21.7956 21 21ZM14.25 4.5C14.25 5.09674 14.4871 5.66903 14.909 6.09099C15.331 6.51295 15.9033 6.75 16.5 6.75H19.5V13.5H4.5V3C4.5 2.60218 4.65804 2.22064 4.93934 1.93934C5.22064 1.65804 5.60218 1.5 6 1.5H14.25V4.5ZM4.5 18V15H7.5V18H4.5ZM4.5 19.5H7.5V22.5H6C5.60218 22.5 5.22064 22.342 4.93934 22.0607C4.65804 21.7794 4.5 21.3978 4.5 21V19.5ZM9 22.5V19.5H13.5V22.5H9ZM15 22.5V19.5H19.5V21C19.5 21.3978 19.342 21.7794 19.0607 22.0607C18.7794 22.342 18.3978 22.5 18 22.5H15ZM19.5 18H15V15H19.5V18ZM9 18V15H13.5V18H9Z"
                  fill="#009951"
                />
              </g>
              <defs>
                <clipPath id="clip0_82_562">
                  <rect width="24" height="24" fill="white" />
                </clipPath>
              </defs>
            </svg>
            Import via Excel
          </li>
          <li className={styles.toolbarItem}>
            <svg
              width="21"
              height="24"
              viewBox="0 0 21 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M17.118 21.8578V15.4348H19.26V23.9998H0V15.4348H2.142V21.8578H17.118Z"
                fill="#007AFF"
              />
              <path
                d="M4.28613 19.7173H14.9916V17.5753H4.28613V19.7173ZM13.8816 -0.000244141L12.1626 1.27776L18.5526 9.86827L20.2716 8.59027L13.8816 -0.000244141ZM8.57163 5.06526L16.7976 11.9158L18.1671 10.2703L9.94113 3.41976L8.57013 5.06526H8.57163ZM5.88363 9.82477L15.5886 14.3443L16.4931 12.4033L6.78813 7.88377L5.88363 9.82477ZM4.49613 14.8408L14.9736 17.0443L15.4146 14.9473L4.93713 12.7453L4.49613 14.8408Z"
                fill="#007AFF"
              />
            </svg>
            Templates
          </li>
        </ul>
      </div>
      <div className={styles.secondPart}>
        <h3 className={styles.title}>Accessories:</h3>
        {/* Selected accessories list (synced with modal) */}
        <ul className={styles.accessoriesList}>
          {accessories.sort((a, b) => b.checked - a.checked).slice(0, 3)
            .map((it) => {
              const qtyNum = parseNumber(it.qty);
              const total = it.price * qtyNum;
              const iconUrl =
                svgIcons[it.iconKey] || svgIcons[it.iconKey?.toLowerCase?.()];
              return (
                <li key={it.id} className={styles.accessoriesEl}>
                  <input
                    type="checkbox"
                    checked={it.checked}
                    onChange={() => toggleAccessory(it.id)}
                    title="Toggle accessory"
                  />
                  {iconUrl ? (
                    <img
                      src={iconUrl}
                      alt={`${it.name} icon`}
                      className={styles.accessoryIcon}
                    />
                  ) : (
                    <div className={styles.accessoryIconPlaceholder} />
                  )}
                  <span>{displayName(it)}</span>
                  <div className={styles.inputGroup}>
                    <input
                      type="number"
                      min={0}
                      value={it.qty}
                      onChange={(e) => setQty(it.id, e.target.value)}
                    />
                    <div className={styles.arrows}>
                      <i
                        className="fa-solid fa-chevron-up"
                        onClick={() => changeQty(it.id, 1)}
                      />
                      <i
                        className="fa-solid fa-chevron-down"
                        onClick={() => changeQty(it.id, -1)}
                      />
                    </div>
                  </div>
                  <span className={styles.price}>{formatPrice(total)}</span>
                </li>
              );
            })}
        </ul>
        <div
          className={styles.moreAccessories}
          onClick={openAccessories}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openAccessories();
            }
          }}
        >
          {accessories.length > 3 && <>
            <svg
              width="34"
              height="34"
              viewBox="0 0 34 34"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g clip-path="url(#clip0_82_640)">
                <path
                  d="M16.6244 16.6238L20.5427 16.7054M16.706 20.5421L16.6244 16.6238L16.706 20.5421ZM16.5428 12.7054L16.6244 16.6238L16.5428 12.7054ZM16.6244 16.6238L12.7061 16.5421L16.6244 16.6238Z"
                  stroke="#017F01"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M23.6951 23.6952C27.4409 19.9494 27.3117 13.7469 23.4065 9.84172C19.5012 5.93647 13.2988 5.80729 9.55296 9.5531C5.80711 13.299 5.93633 19.5014 9.84158 23.4066C13.7468 27.3118 19.9492 27.4411 23.6951 23.6952Z"
                  stroke="#009951"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </g>
              <defs>
                <clipPath id="clip0_82_640">
                  <rect
                    width="23.0204"
                    height="24"
                    fill="white"
                    transform="translate(0 16.2778) rotate(-45)"
                  />
                </clipPath>
              </defs>
            </svg>
            More Accessories</>}
        </div>
        <AccessoriesModal
          isOpen={isAccessoriesOpen}
          onClose={closeAccessories}
          title="Accessories"
          items={accessories}
          onToggle={toggleAccessory}
          onSetQty={setQty}
          onInc={(id) => changeQty(id, 1)}
          onDec={(id) => changeQty(id, -1)}
        />
      </div>
    </div>
  );
};

export default TopToolbar;

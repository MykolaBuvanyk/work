import { useEffect } from "react";

export default function GlobalInputFormat() {
  useEffect(() => {
    const roundToOne = (raw) => {
      if (raw == null) return raw;
      const s = String(raw).replace(",", ".");
      if (s.trim() === "") return s;
      const n = Number(s);
      if (Number.isNaN(n)) return raw;
      const rounded = Math.round(n * 10) / 10;
      // отображаем максимум 1 цифру после точки: без принудительного хвоста .0
      return String(rounded);
    };

    const handleBlur = (e) => {
      const el = e.target;
      if (!el || el.tagName !== "INPUT") return;
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type !== "number") return;
      const before = el.value;
      const after = roundToOne(before);
      if (after !== before) {
        el.value = after;
        // сообщаем React о изменении
        const ev = new Event("input", { bubbles: true });
        el.dispatchEvent(ev);
      }
    };

    // Используем capture, чтобы поймать событие до React-обработчиков ниже по дереву
    document.addEventListener("blur", handleBlur, true);
    return () => {
      document.removeEventListener("blur", handleBlur, true);
    };
  }, []);

  return null;
}

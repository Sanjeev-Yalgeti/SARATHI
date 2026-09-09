import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

/**
 * Dropdown — a styled select dropdown.
 * Props:
 *   c       — theme palette
 *   label   — button label (shown when nothing selected)
 *   options — array of strings to show as options (optional)
 *   value   — currently selected value (optional, controlled)
 *   onChange — (value) => void  (optional)
 */
export default function Dropdown({ c, label, options = [], value, onChange }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value ?? null);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (opt) => {
    const next = opt === selected ? null : opt; // toggle off if re-clicked
    setSelected(next);
    onChange?.(next);
    setOpen(false);
  };

  const displayLabel = selected ?? label;

  // If no options provided, render as a plain decorative button (original behaviour)
  if (!options.length) {
    return (
      <button
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium"
        style={{ background: c.cardBg, color: c.text, border: `1px solid ${c.cardBorder}` }}
      >
        {label} <ChevronDown size={14} />
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all"
        style={{
          background: selected ? c.sidebarActiveBg : c.cardBg,
          color: selected ? "#fff" : c.text,
          border: `1px solid ${selected ? c.sidebarActiveBg : c.cardBorder}`,
        }}
      >
        {displayLabel}
        <ChevronDown
          size={14}
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        />
      </button>

      {/* Menu */}
      {open && (
        <div
          className="absolute right-0 mt-2 rounded-xl shadow-xl z-50 overflow-hidden"
          style={{
            background: c.cardBg,
            border: `1px solid ${c.cardBorder}`,
            minWidth: "160px",
            maxHeight: "260px",
            overflowY: "auto",
          }}
        >
          {/* "All" / reset option */}
          <button
            onClick={() => handleSelect(null)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:opacity-80 transition-opacity"
            style={{
              color: !selected ? c.green : c.text,
              background: "transparent",
            }}
          >
            All
            {!selected && <Check size={13} />}
          </button>

          <div style={{ borderTop: `1px solid ${c.cardBorder}` }} />

          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:opacity-80 transition-opacity"
              style={{
                color: selected === opt ? c.green : c.text,
                fontWeight: selected === opt ? 600 : 400,
                background: "transparent",
              }}
            >
              {opt}
              {selected === opt && <Check size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

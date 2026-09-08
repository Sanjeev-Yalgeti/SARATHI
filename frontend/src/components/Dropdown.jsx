import { ChevronDown } from "lucide-react";

export default function Dropdown({ c, label }) {
  return (
    <button
      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium"
      style={{ background: c.cardBg, color: c.text, border: `1px solid ${c.cardBorder}` }}
    >
      {label} <ChevronDown size={14} />
    </button>
  );
}

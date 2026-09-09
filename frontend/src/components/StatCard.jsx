export default function StatCard({ c, value, label, valueColor, note, noteColor }) {
  return (
    <div
      className="rounded-xl p-5 text-center"
      style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}
    >
      <div className="text-3xl font-extrabold" style={{ color: valueColor || c.text }}>
        {value}
      </div>
      <div className="text-sm mt-1" style={{ color: c.textMuted }}>
        {label}
      </div>
      {note && (
        <div className="text-sm font-semibold mt-1" style={{ color: noteColor || c.textMuted }}>
          {note}
        </div>
      )}
    </div>
  );
}

export default function PillButton({ c, children, variant = "outline", ...props }) {
  const isSolid = variant === "solid";
  return (
    <button
      {...props}
      className="px-4 py-1.5 rounded-full text-sm font-semibold"
      style={{
        background: isSolid ? c.green : "#ffffff",
        color: isSolid ? "#fff" : c.green,
        border: `1.5px solid ${c.green}`,
      }}
    >
      {children}
    </button>
  );
}

export default function Sidebar({ c, title, items, active, setActive }) {
  return (
    <div
      className="w-64 shrink-0 rounded-2xl p-5 mr-6"
      style={{ background: c.sidebarBg }}
    >
      <h2 className="text-white text-2xl font-extrabold mb-4">{title}</h2>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <button
            key={item}
            onClick={() => setActive(item)}
            className="text-left px-4 py-2.5 rounded-lg text-[15px] transition-colors"
            style={{
              background: active === item ? c.sidebarActiveBg : "transparent",
              color: active === item ? "#fff" : c.sidebarText,
              fontWeight: active === item ? 700 : 500,
            }}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

import { AlertTriangle, ShieldAlert, Route as RouteIcon, X } from "lucide-react";

const KIND_STYLE = {
  blockage: {
    Icon: ShieldAlert,
    bar: "#dc2626",
    badge: "TRUCK BLOCKED",
    badgeBg: "#dc2626",
  },
  risk: {
    Icon: AlertTriangle,
    bar: "#d97706",
    badge: "RISK ALERT",
    badgeBg: "#d97706",
  },
  detour: {
    Icon: RouteIcon,
    bar: "#1a73e8",
    badge: "DETOUR",
    badgeBg: "#1a73e8",
  },
};

function toastText(t) {
  if (t.kind === "blockage") {
    return {
      title: t.vehicleId ?? "Truck",
      body: t.reason ?? "Stopped near a RED incident.",
    };
  }
  if (t.kind === "detour") {
    return {
      title: t.vehicleId ?? "Truck",
      body: t.reason ?? "Diverted onto the alternate road.",
    };
  }
  return {
    title: `${t.band ?? "RISK"} — ${t.district ?? ""}`.trim(),
    body: `${t.vehicleId ?? ""} · confidence ${t.confidence != null ? Math.round(t.confidence * 100) : "?"}% (${t.source ?? "ml"})`,
  };
}

/** Real-time alert popups (Socket.io). Mounted once in App for every role. */
export default function AlertToasts({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;
  return (
    <div className="fixed top-20 right-4 z-[500] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map((t) => {
        const style = KIND_STYLE[t.kind] ?? KIND_STYLE.risk;
        const { Icon } = style;
        const { title, body } = toastText(t);
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-gray-200 dark:border-slate-700 animate-fadeIn"
            style={{ borderLeft: `4px solid ${style.bar}` }}
          >
            <div
              className="p-1.5 rounded-lg text-white shrink-0"
              style={{ background: style.bar }}
            >
              <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white"
                  style={{ background: style.badgeBg }}
                >
                  {style.badge}
                </span>
                <span className="font-bold text-gray-900 dark:text-gray-100 truncate">
                  {title}
                </span>
              </div>
              <p className="mt-1 text-gray-600 dark:text-gray-300 leading-snug">{body}</p>
              <p className="mt-1 text-[10px] text-gray-400 font-mono">
                {t.scenarioDate ?? ""} · {t.at instanceof Date ? t.at.toLocaleTimeString() : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer shrink-0"
              aria-label="Dismiss alert"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

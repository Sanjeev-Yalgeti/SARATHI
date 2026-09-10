import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_BASE } from "../api/client";
import { getStoredToken } from "../api/auth";

/**
 * Live alert feed (alert:blockage / alert:risk / alert:detour) over Socket.io
 * with the same JWT handshake as REST. Server scopes rooms driver-side
 * (driver:<vehicleId>) so drivers only get their own truck's alerts.
 * Returns toast list + dismiss. Skipped for dev-bypass (offline) sessions.
 */
export default function useAlertsSocket(isLoggedIn, userId) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const push = useCallback((kind, payload) => {
    const id = `${Date.now()}-${idRef.current++}`;
    const toast = { id, kind, at: new Date(), ...(payload ?? {}) };
    setToasts((prev) => [toast, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 9000);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const token = getStoredToken();
    if (!token || token.startsWith("dev_bypass_token_")) return;
    const socket = io(API_BASE, {
      auth: { token },
      reconnectionAttempts: 5,
      timeout: 8000,
    });
    socket.emit("client:subscribe");
    const onBlockage = (d) => push("blockage", d);
    const onRisk = (d) => push("risk", d);
    const onDetour = (d) => push("detour", d);
    socket.on("alert:blockage", onBlockage);
    socket.on("alert:risk", onRisk);
    socket.on("alert:detour", onDetour);
    return () => {
      socket.off("alert:blockage", onBlockage);
      socket.off("alert:risk", onRisk);
      socket.off("alert:detour", onDetour);
      socket.disconnect();
    };
  }, [isLoggedIn, userId, push]);

  return { toasts, dismiss };
}

import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/useAuth";

/** 15 minutos en milisegundos */
const IDLE_TIMEOUT = 15 * 60 * 1000;

/** Clave usada para pasar el mensaje de expiración al login */
export const SESSION_EXPIRED_KEY = "tecnocell_session_expired";

/** Eventos que se consideran actividad del usuario */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

/**
 * Hook que cierra la sesión automáticamente después de IDLE_TIMEOUT
 * de inactividad. Solo se activa cuando el usuario está autenticado.
 */
export function useIdleLogout() {
  const logout = useAuth((state) => state.logout);
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleIdleLogout = useCallback(() => {
    // Marcar que la sesión expiró para mostrar el mensaje en el login
    localStorage.setItem(SESSION_EXPIRED_KEY, "1");
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(handleIdleLogout, IDLE_TIMEOUT);
  }, [handleIdleLogout]);

  useEffect(() => {
    // Iniciar temporizador al montar
    resetTimer();

    // Reiniciar en cada evento de actividad
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, resetTimer, { passive: true })
    );

    return () => {
      // Limpiar al desmontar — sin memory leaks
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, resetTimer)
      );
    };
  }, [resetTimer]);
}

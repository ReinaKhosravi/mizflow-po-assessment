"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export function useOperationalPoll<T>(initial: T, url: string) {
  const [data, setData] = useState(initial);
  const [state, setState] = useState<
    "connecting" | "online" | "error" | "unauthorized"
  >("connecting");
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    try {
      const r = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(10000),
        ]),
      });
      if (!r.ok) {
        if (mounted.current && !controller.signal.aborted)
          setState(
            r.status === 401 || r.status === 403 ? "unauthorized" : "error",
          );
        return;
      }
      const payload = await r.json();
      if (mounted.current && !controller.signal.aborted) {
        setData(payload.data as T);
        setState("online");
      }
    } catch {
      if (mounted.current && !controller.signal.aborted) setState("error");
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, [url]);
  useEffect(() => {
    mounted.current = true;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (document.visibilityState !== "hidden" && !active.current)
        await refresh();
      if (alive) timer = setTimeout(tick, 4000);
    };
    void tick();
    const visible = () => {
      if (document.visibilityState === "visible" && !active.current) {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      mounted.current = false;
      if (timer) clearTimeout(timer);
      active.current?.abort();
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  return { data, state, refresh };
}

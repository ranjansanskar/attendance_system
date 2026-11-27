"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

type Feed = {
  url: string;
  expiresAt: number;
  serverNow: number;
  openNow: { name: string; start_time: string; end_time: string }[];
  recent: { id: string; name: string; roll_no: string; status: string; checked_in_at: string; batch: string }[];
};

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

function hhmm(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/**
 * Full-screen rotating QR. Fetches a new code exactly when the current one expires (every 15 s),
 * so the kiosk makes ~4 requests a minute.
 */
export function KioskQr() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [qrSvg, setQrSvg] = useState("");
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const offset = useRef(0); // server clock − local clock
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const load = useCallback(async () => {
    clearTimeout(timer.current);
    try {
      const res = await fetch("/api/kiosk/qr", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        setError("Logged out. Log in again as staff to show the QR code.");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Feed;
      offset.current = data.serverNow - Date.now();
      setFeed(data);
      setQrSvg(await QRCode.toString(data.url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }));
      setError("");
      const wait = Math.max(500, data.expiresAt - (Date.now() + offset.current) + 300);
      timer.current = setTimeout(load, wait);
    } catch {
      setError("No internet connection. Retrying…");
      timer.current = setTimeout(load, 3000);
    }
  }, []);

  useEffect(() => {
    load();
    return () => clearTimeout(timer.current);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      if (feed) setSecondsLeft(Math.max(0, Math.ceil((feed.expiresAt - (Date.now() + offset.current)) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [feed]);

  // Keep the screen awake where supported.
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    const request = () =>
      navigator.wakeLock
        ?.request("screen")
        .then((l) => (lock = l))
        .catch(() => {});
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  return (
    <main className="flex min-h-dvh flex-col bg-white text-zinc-900 lg:flex-row">
      <section className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-center text-2xl font-semibold sm:text-3xl">Ranjan Tutorials · Scan to check in</h1>
        {feed?.openNow.length ? (
          <p className="text-center text-lg text-zinc-600">
            {feed.openNow.map((b) => `${b.name} (${hhmm(b.start_time)})`).join(" · ")}
          </p>
        ) : (
          <p className="text-center text-lg text-zinc-500">No batch is open for check-in right now</p>
        )}
        <div className="relative aspect-square w-full max-w-[min(70vh,520px)] rounded-2xl border-4 border-blue-600 p-3">
          {qrSvg ? (
            <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-400">Loading…</div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/90 p-6 text-center text-lg font-medium text-red-700">
              {error}
            </div>
          )}
        </div>
        <p className="text-zinc-500">
          New code in <span className="font-semibold tabular-nums text-zinc-900">{secondsLeft}s</span> · open the
          Attendance app and tap “Scan QR”
        </p>
        <button
          onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
          className="text-sm text-zinc-400 underline"
        >
          Full screen
        </button>
      </section>

      <aside className="border-t border-zinc-200 p-6 lg:w-96 lg:border-l lg:border-t-0">
        <h2 className="mb-3 text-lg font-semibold">Just checked in</h2>
        {feed?.recent.length ? (
          <ul className="space-y-2">
            {feed.recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
                <span>
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-2 text-sm text-zinc-500">#{r.roll_no}</span>
                </span>
                <span className={`text-sm ${r.status === "late" ? "text-amber-600" : "text-green-700"}`}>
                  {r.status === "late" ? "Late" : "✓"} {clock(r.checked_in_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-zinc-500">No check-ins yet today.</p>
        )}
      </aside>
    </main>
  );
}

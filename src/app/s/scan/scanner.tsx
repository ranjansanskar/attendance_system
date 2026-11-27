"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { ui } from "@/components/ui";

type Phase =
  | { kind: "scanning" }
  | { kind: "locating" }
  | { kind: "submitting" }
  | { kind: "done"; status: "present" | "late"; batchName: string; time: string; alreadyMarked: boolean }
  | { kind: "error"; message: string };

/** Pulls the token out of a scanned QR: either our check-in URL (…/s/scan?t=…) or a bare token. */
function tokenFrom(text: string): string | null {
  try {
    const url = new URL(text);
    return url.pathname === "/s/scan" ? url.searchParams.get("t") : null;
  } catch {
    return /^[0-9a-z]+\.[\w-]{22}$/.test(text) ? text : null;
  }
}

function getLocation(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

export function Scanner({ initialToken }: { initialToken: string | null }) {
  const [phase, setPhase] = useState<Phase>({ kind: initialToken ? "locating" : "scanning" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busy = useRef(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const submit = useCallback(
    async (token: string) => {
      if (busy.current) return;
      busy.current = true;
      stopCamera();
      setPhase({ kind: "locating" });
      const pos = await getLocation();
      setPhase({ kind: "submitting" });
      try {
        const res = await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            lat: pos?.coords.latitude ?? null,
            lng: pos?.coords.longitude ?? null,
            accuracy: pos?.coords.accuracy ?? null,
          }),
        });
        if (res.status === 401) {
          window.location.href = "/s/login";
          return;
        }
        const data = await res.json();
        if (data.ok) {
          setPhase({
            kind: "done",
            status: data.status,
            batchName: data.batchName,
            time: new Date(data.checkedInAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }),
            alreadyMarked: data.alreadyMarked,
          });
          navigator.vibrate?.(200);
        } else {
          setPhase({ kind: "error", message: data.error ?? "Check-in failed." });
        }
      } catch {
        setPhase({ kind: "error", message: "No internet connection. Try again." });
      }
    },
    [stopCamera],
  );

  // Opened from a QR link (phone camera app): submit straight away.
  useEffect(() => {
    if (initialToken) submit(initialToken);
  }, [initialToken, submit]);

  // Camera + QR decoding loop.
  useEffect(() => {
    if (phase.kind !== "scanning") return;
    let raf = 0;
    let last = 0;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        const tick = (ts: number) => {
          if (cancelled) return;
          raf = requestAnimationFrame(tick);
          if (ts - last < 150 || video.readyState < 2) return;
          last = ts;
          const canvas = canvasRef.current!;
          const w = 480;
          const h = Math.round((video.videoHeight / video.videoWidth) * w) || 360;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
          ctx.drawImage(video, 0, 0, w, h);
          const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
          const token = code && tokenFrom(code.data);
          if (token) {
            cancelAnimationFrame(raf);
            submit(token);
          }
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setPhase({
          kind: "error",
          message: "Camera access is needed to scan. Allow camera for this site in your browser settings, then try again.",
        });
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stopCamera();
    };
  }, [phase.kind, stopCamera, submit]);

  const retry = () => {
    busy.current = false;
    // Drop a stale ?t= so a retry scans a fresh code.
    window.history.replaceState(null, "", "/s/scan");
    setPhase({ kind: "scanning" });
  };

  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/s" className={ui.muted}>← Back</Link>
        <h1 className={ui.h2}>Check in</h1>
        <span className="w-10" />
      </div>

      {phase.kind === "scanning" && (
        <>
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
            <div className="pointer-events-none absolute inset-[15%] rounded-xl border-4 border-white/80" />
          </div>
          <p className={`${ui.muted} text-center`}>Point your camera at the QR code on the entrance screen.</p>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />

      {(phase.kind === "locating" || phase.kind === "submitting") && (
        <div className={`${ui.card} py-12 text-center`}>
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-zinc-700 dark:text-zinc-300">
            {phase.kind === "locating" ? "Checking your location…" : "Marking attendance…"}
          </p>
          {phase.kind === "locating" && <p className={`${ui.muted} mt-2`}>Allow location access if asked.</p>}
        </div>
      )}

      {phase.kind === "done" && (
        <div className={`${ui.card} py-10 text-center`}>
          <div
            className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full text-4xl text-white ${
              phase.status === "late" ? "bg-amber-500" : "bg-green-600"
            }`}
          >
            ✓
          </div>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {phase.alreadyMarked ? "Already marked" : phase.status === "late" ? "Marked late" : "You're checked in"}
          </p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {phase.batchName} · {phase.time}
          </p>
          <Link href="/s" className={`${ui.buttonSecondary} mt-6`}>Done</Link>
        </div>
      )}

      {phase.kind === "error" && (
        <div className={`${ui.card} space-y-4 py-8 text-center`}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600 dark:bg-red-950">
            !
          </div>
          <p className="text-zinc-800 dark:text-zinc-200">{phase.message}</p>
          <button onClick={retry} className={ui.button}>Scan again</button>
        </div>
      )}
    </main>
  );
}

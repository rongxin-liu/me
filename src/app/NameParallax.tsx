"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./NameParallax.module.css";

const TEXT = "Hi, I'm Rongxin";

// Restraint: keep the motion small. Max translation in px for the base layer,
// and the max chromatic-split offset in px at the extremes of the input.
const MAX_SHIFT = 6;
const MAX_SPLIT = 3;
// Lerp factor per frame — lower is smoother/laggier, higher snaps faster.
const SMOOTHING = 0.12;

type Vec = { x: number; y: number };

type MotionSupport = "pointer" | "gyro-ready" | "gyro-needs-permission" | "none";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function isCoarsePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(pointer: coarse)").matches
  );
}

// iOS 13+ gates DeviceOrientationEvent behind an explicit permission request
// that must be triggered by a user gesture.
type PermissionedOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

function needsOrientationPermission(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { DeviceOrientationEvent?: unknown })
      .DeviceOrientationEvent !== "undefined" &&
    typeof (DeviceOrientationEvent as PermissionedOrientation)
      .requestPermission === "function"
  );
}

function detectMotion(): MotionSupport {
  if (typeof window === "undefined") return "none";
  if (prefersReducedMotion()) return "none";

  if (isCoarsePointer()) {
    // Touch device: rely on the gyroscope.
    if (!("DeviceOrientationEvent" in window)) return "none";
    if (needsOrientationPermission()) return "gyro-needs-permission";
    return "gyro-ready";
  }

  return "pointer";
}

// SSR-safe modality detection via useSyncExternalStore: the server snapshot is
// always "none" (deterministic hydration), the client snapshot reads real
// capabilities after hydration. No setState-in-effect needed.
const emptySubscribe = () => () => {};

function useMotionSupport(): MotionSupport {
  return useSyncExternalStore(
    emptySubscribe,
    detectMotion,
    () => "none" as MotionSupport,
  );
}

export default function NameParallax() {
  // Target (raw input) and rendered (smoothed) offsets, both normalized -1..1.
  const target = useRef<Vec>({ x: 0, y: 0 });
  const rendered = useRef<Vec>({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);
  const rootRef = useRef<HTMLHeadingElement>(null);

  const detected = useMotionSupport();
  // After an iOS permission grant we override the detected value.
  const [granted, setGranted] = useState(false);
  const support: MotionSupport = granted ? "gyro-ready" : detected;
  const enabled = support === "pointer" || support === "gyro-ready";

  // Write the smoothed offsets to CSS custom properties each frame.
  const applyStyles = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const { x, y } = rendered.current;
    el.style.setProperty("--shift-x", `${(x * MAX_SHIFT).toFixed(2)}px`);
    el.style.setProperty("--shift-y", `${(y * MAX_SHIFT).toFixed(2)}px`);
    el.style.setProperty("--split-x", `${(x * MAX_SPLIT).toFixed(2)}px`);
    el.style.setProperty("--split-y", `${(y * MAX_SPLIT).toFixed(2)}px`);
  }, []);

  // Animation loop: ease rendered offsets toward the target.
  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      rendered.current.x += (target.current.x - rendered.current.x) * SMOOTHING;
      rendered.current.y += (target.current.y - rendered.current.y) * SMOOTHING;
      applyStyles();
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [enabled, applyStyles]);

  // Pointer input (desktop).
  useEffect(() => {
    if (!enabled || support !== "pointer") return;

    const onMove = (e: PointerEvent) => {
      // Offset from viewport center, normalized to -1..1.
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled, support]);

  // Gyroscope input (mobile). Runs once permission is granted (support becomes
  // "gyro-ready" either at detection on Android or after the iOS tap).
  useEffect(() => {
    if (!enabled || support !== "gyro-ready") return;

    const onOrient = (e: DeviceOrientationEvent) => {
      // gamma: left/right tilt (-90..90), beta: front/back tilt (-180..180).
      // Clamp to a comfortable ~30deg range so small tilts do the work.
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? 0;
      target.current.x = Math.max(-1, Math.min(1, gamma / 30));
      target.current.y = Math.max(-1, Math.min(1, (beta - 45) / 30));
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [enabled, support]);

  const requestGyro = useCallback(async () => {
    try {
      const result = await (
        DeviceOrientationEvent as PermissionedOrientation
      ).requestPermission?.();
      if (result === "granted") setGranted(true);
    } catch {
      // Permission failed or unavailable — leave the name static.
    }
  }, []);

  return (
    <div className={styles.wrapper}>
      <h1 ref={rootRef} className={styles.name}>
        {/* Chromatic layers sit behind the crisp base text and only show at the fringes. */}
        <span className={`${styles.layer} ${styles.red}`} aria-hidden="true">
          {TEXT}
        </span>
        <span className={`${styles.layer} ${styles.cyan}`} aria-hidden="true">
          {TEXT}
        </span>
        <span className={styles.base}>{TEXT}</span>
      </h1>

      {support === "gyro-needs-permission" && (
        <button type="button" className={styles.enable} onClick={requestGyro}>
          Tap to enable motion
        </button>
      )}
    </div>
  );
}

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
// Per-frame decay of the pointer-driven target toward rest. Each frame the
// target is multiplied by this, so when the cursor stops moving the effect
// gently winds back to zero (~0.92 ≈ half-life of ~8 frames / ~130ms at 60fps).
const VELOCITY_DECAY = 0.92;
// Converts raw pointer movement (px/frame) into normalized intensity. Kept low
// so there's real dynamic range: gentle moves stay subtle and only fast/volatile
// movement approaches the -1..1 clamp (the effect's max).
const VELOCITY_GAIN = 0.006;

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
  // Last pointer position, to derive movement velocity between events.
  const lastPointer = useRef<Vec | null>(null);
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

  // Animation loop: decay the pointer-driven target toward rest, then ease the
  // rendered offsets toward the (possibly decaying) target.
  useEffect(() => {
    if (!enabled) return;

    const decays = support === "pointer";

    const tick = () => {
      if (decays) {
        // When the cursor stops, no new velocity arrives and the target winds
        // down to zero, gently restoring the name to its neutral state.
        target.current.x *= VELOCITY_DECAY;
        target.current.y *= VELOCITY_DECAY;
      }
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
  }, [enabled, support, applyStyles]);

  // Pointer input (desktop): drive the effect by movement velocity/volatility.
  useEffect(() => {
    if (!enabled || support !== "pointer") return;

    const onMove = (e: PointerEvent) => {
      const prev = lastPointer.current;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      if (!prev) return;

      // Instantaneous velocity (px since last event) scaled into intensity.
      // Faster / more volatile movement accumulates a larger offset; the rAF
      // decay drains it, so sustained motion is needed to hold the effect.
      const vx = (e.clientX - prev.x) * VELOCITY_GAIN;
      const vy = (e.clientY - prev.y) * VELOCITY_GAIN;
      target.current.x = Math.max(-1, Math.min(1, target.current.x + vx));
      target.current.y = Math.max(-1, Math.min(1, target.current.y + vy));
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      lastPointer.current = null;
    };
  }, [enabled, support]);

  // Gyroscope input (mobile). Runs once permission is granted (support becomes
  // "gyro-ready" either at detection on Android or after the iOS tap).
  useEffect(() => {
    if (!enabled || support !== "gyro-ready") return;

    const onOrient = (e: DeviceOrientationEvent) => {
      // gamma: left/right tilt (-90..90), beta: front/back tilt (-180..180).
      // Clamp to a comfortable ~30deg range so small tilts do the work. Null
      // readings fall back to the neutral rest values (gamma 0, beta 45) so a
      // device that emits events without data stays centered, not pinned.
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? 45;
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
      <h1 ref={rootRef} className={styles.name} data-active={enabled}>
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

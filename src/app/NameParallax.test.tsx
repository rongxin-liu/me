import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import NameParallax from "./NameParallax";

type MediaState = {
  reducedMotion?: boolean;
  coarsePointer?: boolean;
};

function mockMatchMedia({ reducedMotion = false, coarsePointer = false }: MediaState) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches:
      (query.includes("prefers-reduced-motion") && reducedMotion) ||
      (query.includes("pointer: coarse") && coarsePointer),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

const originalDOE = (globalThis as Record<string, unknown>).DeviceOrientationEvent;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalDOE === undefined) {
    delete (globalThis as Record<string, unknown>).DeviceOrientationEvent;
  } else {
    (globalThis as Record<string, unknown>).DeviceOrientationEvent = originalDOE;
  }
});

describe("NameParallax", () => {
  beforeEach(() => {
    // rAF is used by the animation loop; give it a no-op impl in jsdom.
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("always renders the name (works with no JS effect)", () => {
    mockMatchMedia({});
    render(<NameParallax />);
    expect(screen.getByRole("heading", { name: "Hi, I'm Rongxin" })).toBeInTheDocument();
  });

  it("shows no motion prompt on desktop (fine pointer)", () => {
    mockMatchMedia({ coarsePointer: false });
    render(<NameParallax />);
    expect(screen.queryByRole("button", { name: /enable motion/i })).toBeNull();
  });

  it("disables the effect under prefers-reduced-motion (no prompt)", () => {
    mockMatchMedia({ reducedMotion: true, coarsePointer: true });
    render(<NameParallax />);
    expect(screen.queryByRole("button", { name: /enable motion/i })).toBeNull();
  });

  it("falls back silently on a touch device with no gyroscope support", () => {
    mockMatchMedia({ coarsePointer: true });
    delete (globalThis as Record<string, unknown>).DeviceOrientationEvent;
    render(<NameParallax />);
    // Name still shows; no permission prompt because there's nothing to enable.
    expect(screen.getByRole("heading", { name: "Hi, I'm Rongxin" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enable motion/i })).toBeNull();
  });

  it("prompts to enable motion on iOS-style permissioned gyroscope", () => {
    mockMatchMedia({ coarsePointer: true });
    (globalThis as Record<string, unknown>).DeviceOrientationEvent = Object.assign(
      function () {},
      { requestPermission: vi.fn().mockResolvedValue("granted") },
    );
    render(<NameParallax />);
    expect(
      screen.getByRole("button", { name: /enable motion/i }),
    ).toBeInTheDocument();
  });
});

describe("NameParallax — pointer velocity & decay (desktop)", () => {
  // Controllable rAF: each stubbed call queues one callback that we flush by
  // hand, so we can step the animation loop deterministically.
  let rafQueue: FrameRequestCallback[];

  function flushFrame() {
    const cbs = rafQueue;
    rafQueue = [];
    cbs.forEach((cb) => cb(performance.now()));
  }

  function movePointer(x: number, y: number) {
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: x, clientY: y }));
  }

  function splitX(): number {
    const heading = screen.getByRole("heading", { name: "Hi, I'm Rongxin" });
    return parseFloat(heading.style.getPropertyValue("--split-x")) || 0;
  }

  beforeEach(() => {
    rafQueue = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    mockMatchMedia({ coarsePointer: false }); // fine pointer => desktop path
  });

  it("produces a non-zero parallax split as the cursor moves", () => {
    render(<NameParallax />);
    // Prime the last-position ref, then make a fast horizontal move.
    movePointer(100, 100);
    movePointer(300, 100); // 200px jump => strong velocity
    // Step the loop a few frames so the rendered offset eases toward target.
    for (let i = 0; i < 5; i++) flushFrame();
    expect(Math.abs(splitX())).toBeGreaterThan(0);
  });

  it("decays back toward rest when the cursor stops moving", () => {
    render(<NameParallax />);
    movePointer(100, 100);
    movePointer(340, 100); // strong move
    for (let i = 0; i < 3; i++) flushFrame();
    const peak = Math.abs(splitX());
    expect(peak).toBeGreaterThan(0);

    // No further pointer events: the target decays each frame, so the rendered
    // offset winds back down close to zero.
    for (let i = 0; i < 80; i++) flushFrame();
    const settled = Math.abs(splitX());
    expect(settled).toBeLessThan(peak);
    expect(settled).toBeLessThan(0.05); // effectively back to neutral (px)
  });

  it("stronger cursor movement yields a larger effect (volatility correlation)", () => {
    const { unmount } = render(<NameParallax />);
    movePointer(100, 100);
    movePointer(140, 100); // gentle: 40px
    for (let i = 0; i < 3; i++) flushFrame();
    const gentle = Math.abs(splitX());
    unmount();

    rafQueue = [];
    render(<NameParallax />);
    movePointer(100, 100);
    movePointer(220, 100); // volatile: 120px
    for (let i = 0; i < 3; i++) flushFrame();
    const volatile = Math.abs(splitX());

    expect(gentle).toBeGreaterThan(0);
    expect(volatile).toBeGreaterThan(gentle);
  });
});

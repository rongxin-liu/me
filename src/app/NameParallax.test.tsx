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

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home landing page", () => {
  it("renders the exact greeting text (R1)", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Hi, I'm Rongxin" })).toBeInTheDocument();
  });

  it("centers content vertically and horizontally across the viewport (R2)", () => {
    render(<Home />);
    const main = screen.getByRole("main");
    // Full-viewport height + flexbox centering on both axes.
    expect(main).toHaveClass("min-h-screen", "flex", "items-center", "justify-center");
  });

  it("has the greeting as the sole content element (R2 — nothing to break centering)", () => {
    render(<Home />);
    const main = screen.getByRole("main");
    expect(main.children).toHaveLength(1);
  });
});

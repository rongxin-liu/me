import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home landing page", () => {
  it("renders the greeting as a heading with the exact accessible name (R1)", () => {
    render(<Home />);
    // Colored chromatic layers are aria-hidden, so the accessible name stays clean.
    expect(
      screen.getByRole("heading", { name: "Hi, I'm Rongxin" }),
    ).toBeInTheDocument();
  });

  it("centers content vertically and horizontally across the viewport (R2)", () => {
    render(<Home />);
    const main = screen.getByRole("main");
    expect(main).toHaveClass("min-h-screen", "flex", "items-center", "justify-center");
  });
});

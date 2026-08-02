import type { NextConfig } from "next";

// GitHub Pages serves this project site under /<repo> (e.g. /me), so the build
// needs a basePath. Locally (BASE_PATH unset) the app runs at the root.
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Emit a fully static site into out/ for GitHub Pages (no Node server).
  output: "export",
  // The default image optimizer needs a server; disable it for static export.
  images: { unoptimized: true },
  // Serve assets/routes under the project-page subpath in production.
  basePath,
  assetPrefix: basePath || undefined,
};

export default nextConfig;

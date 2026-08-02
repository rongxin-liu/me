import type { NextConfig } from "next";

// The site is served at the root of the custom domain (rongxinliu.io), so no
// basePath is needed. BASE_PATH can still be set to serve under a subpath.
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

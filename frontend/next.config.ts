import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build static HTML/JS into out/, which the FastAPI backend serves.
  output: "export",
  // Emit /nda/index.html rather than /nda.html, so the backend's static file server
  // finds each page as a folder with an index.html.
  trailingSlash: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

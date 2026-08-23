import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The cockpit is served by the ERP app, while chat lives in the separate UI.
  // This value is safe to expose: it is only a local port.
  env: {
    UI_PORT: process.env.UI_PORT ?? "3000",
  },
}

export default nextConfig

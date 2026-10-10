import type { NextConfig } from "next";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Fix warning about inferred workspace root
  // (turbopack must be at the root of the config, not in experimental)
  turbopack: {
    root: '..',
  },
  // Allow external device access for HMR
  allowedDevOrigins: ['192.168.1.164', 'localhost'],
  // Hide development indicator badge (the black 'N' circle in the corner)
  devIndicators: false,

  // Proxy all /api/* requests to the Express backend.
  // This means frontend fetch('/api/tasks') → backend http://localhost:5000/api/tasks
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: "/charts/:path*",
        destination: `${BACKEND_URL}/charts/:path*`,
      },
    ];
  },

  async redirects() {
    return [
      {
        source: "/finance",
        destination: "/finance/payments-in",
        permanent: false,
      },
      {
        source: "/payments-in",
        destination: "/finance/payments-in",
        permanent: false,
      },
      {
        source: "/payments-out",
        destination: "/finance/payments-out",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

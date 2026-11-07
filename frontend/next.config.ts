import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Legacy routes → the five primary environments (bookmarks survive).
      { source: "/app/forum", destination: "/app/research", permanent: false },
      { source: "/app/forum/threads/:id", destination: "/app/research/threads/:id", permanent: false },
      { source: "/app/chat", destination: "/app/frequency", permanent: false },
      { source: "/app/chat/:id", destination: "/app/frequency/:id", permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${process.env.BACKEND_URL ?? "http://localhost:5070"}/api/:path*` },
      { source: "/uploads/:path*", destination: `${process.env.BACKEND_URL ?? "http://localhost:5070"}/uploads/:path*` },
    ];
  },
};

export default nextConfig;

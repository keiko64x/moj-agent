import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pozwala urządzeniom z LAN korzystać z hot-reload / zasobów dev
  allowedDevOrigins: ['192.168.0.157', '127.0.0.1', 'localhost'],
  // app/react koliduje z pakietem npm "react" (Turbopack HMR panic → nieskończone odświeżanie).
  // Strona żyje w /react-agent; /react zostaje jako alias w URL.
  async rewrites() {
    return [{ source: '/react', destination: '/react-agent' }];
  },
};

export default nextConfig;

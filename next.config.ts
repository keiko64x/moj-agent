import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Rodzic C:\Users\MSI ma przypadkowe .git — bez tego Turbopack źle bierze root.
  turbopack: {
    root: path.join(__dirname),
  },
  // Pozwala urządzeniom z LAN korzystać z hot-reload / zasobów dev
  allowedDevOrigins: ['192.168.0.157', '127.0.0.1', 'localhost'],
  // app/react koliduje z pakietem npm "react" (Turbopack HMR panic → nieskończone odświeżanie).
  // Strona żyje w /react-agent; /react zostaje jako alias w URL.
  async rewrites() {
    return [{ source: '/react', destination: '/react-agent' }];
  },
};

export default nextConfig;

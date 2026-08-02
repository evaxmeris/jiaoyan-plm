import type { NextConfig } from "next";

// @ts-ignore
const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  // 开发模式下允许 cpolar 隧道访问
  allowedDevOrigins: ['jiaoyan.cpolar.cn', 'localhost'],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;

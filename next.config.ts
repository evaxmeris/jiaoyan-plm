import type { NextConfig } from "next";

// @ts-ignore
const nextConfig: NextConfig = {
  output: "standalone",
  // 显式指定 Turbopack 工作区根目录，避免多 lockfile 时 root 推断错误
  // （否则 dev 模式下文件监听/编译范围异常，页面可能一直 rendering）
  turbopack: {
    root: process.cwd(),
  },
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

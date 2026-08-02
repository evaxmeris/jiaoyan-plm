import type { Metadata } from "next";
import "./globals.css";
import RootLayoutContent from "@/components/RootLayoutContent";

const systemFont = `
  -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial,
  "Noto Sans SC", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"
`;

export const metadata: Metadata = {
  title: "交研生物 PLM",
  description: "中山交研生物科技有限公司 - 产品研发管理系统",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body style={{ fontFamily: systemFont }} className="antialiased">
        <RootLayoutContent>{children}</RootLayoutContent>
      </body>
    </html>
  );
}

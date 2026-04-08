import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VideoStyle - 视频调色工具",
  description: "浏览器内的视频调色工具，主打 LUT 预设滤镜 + 抽卡随机生成",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body className="antialiased">{children}</body>
    </html>
  );
}

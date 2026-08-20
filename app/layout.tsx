import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shopee AI Doctor | REAIM",
  description: "Shopee Philippines product performance diagnosis and optimization workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth-panel";
import "./globals.css";
import "./persistence.css";
import "./optimization.css";
import "./auth-system.css";

export const metadata: Metadata = {
  title: "Shopee AI Doctor | REAIM",
  description: "Shopee Philippines product performance diagnosis and optimization workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <AuthPanel />
      </body>
    </html>
  );
}

import "./globals.css";
import Link from "next/link";

export const metadata = { title: "Shopee AI Doctor", description: "Shopee Philippines listing diagnosis" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="shell">
          <nav className="nav">
            <Link className="brand" href="/">Shopee <span>AI Doctor</span></Link>
            <div className="links">
              <Link href="/">Dashboard</Link>
              <Link href="/import">Import Data</Link>
            </div>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}

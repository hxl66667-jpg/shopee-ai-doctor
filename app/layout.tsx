import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Shopee AI Listing Doctor",
  description: "Shopee Philippines listing funnel diagnosis for REAIM operations"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let signedIn = false;
  if (hasSupabaseConfig()) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      signedIn = Boolean(user);
    } catch {
      signedIn = false;
    }
  }
  return (
    <html lang="zh-CN">
      <body>
        <nav className="nav">
          <div className="navInner">
            <Link href="/" className="brand">Shopee AI Listing Doctor</Link>
            {signedIn && <Link href="/" className="navLink">Dashboard</Link>}
            {signedIn && <Link href="/import" className="navLink">Import</Link>}
            {signedIn ? (
              <form action="/auth/signout" method="post"><button className="secondary" type="submit">Sign out</button></form>
            ) : (
              <Link href="/login" className="navLink">Sign in</Link>
            )}
          </div>
        </nav>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}

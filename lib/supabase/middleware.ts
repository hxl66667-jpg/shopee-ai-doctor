import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseConfig, requireSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  if (!hasSupabaseConfig()) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const { url, key } = requireSupabaseConfig();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/login") || path.startsWith("/auth") || path.startsWith("/error");
  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }
  if (user && path === "/login") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }
  return response;
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function login(formData: FormData) {
  const email = value(formData, "email");
  const password = value(formData, "password");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/");
}

export async function signup(formData: FormData) {
  const email = value(formData, "email");
  const password = value(formData, "password");
  const origin = (await headers()).get("origin") || "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: origin ? { emailRedirectTo: `${origin}/auth/callback` } : undefined
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  if (data.session) redirect("/");
  redirect("/login?message=Check%20your%20email%20to%20confirm%20the%20account.");
}

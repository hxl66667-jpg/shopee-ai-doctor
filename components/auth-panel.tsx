"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

type NoticeKind = "info" | "success" | "warning" | "error";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function friendlyAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "");
  const message = raw.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "登录失败：邮箱或密码不正确，或者邮箱尚未完成验证。若你刚注册，请先点击“重新发送验证邮件”；若不确定密码，请点击“忘记密码”。";
  }
  if (message.includes("email not confirmed")) {
    return "这个邮箱已经注册，但还没有完成验证。请点击“重新发送验证邮件”，到邮箱确认后再登录。";
  }
  if (message.includes("user already registered") || message.includes("already been registered")) {
    return "这个邮箱已经注册过了，不需要再次注册。请直接登录；若尚未验证邮箱，请重新发送验证邮件。";
  }
  if (message.includes("rate limit") || message.includes("too many requests") || message.includes("over_email_send_rate_limit")) {
    return "邮件发送过于频繁，请稍等几分钟后再试。";
  }
  if (message.includes("password") && (message.includes("weak") || message.includes("short") || message.includes("length"))) {
    return "密码强度不足。请使用至少 8 位，并混合字母、数字或符号。";
  }
  if (message.includes("email") && message.includes("invalid")) {
    return "邮箱格式不正确，请检查后重新输入。";
  }
  if (message.includes("signup") && message.includes("disabled")) {
    return "当前项目已关闭公开注册，请联系管理员创建账号。";
  }

  return raw ? `认证失败：${raw}` : "认证失败，请稍后重试。";
}

export function AuthPanel() {
  const [target, setTarget] = useState<Element | null>(null);
  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<NoticeKind>("info");

  const configured = hasSupabaseBrowserConfig();
  const canSubmit = useMemo(() => normalizeEmail(email).includes("@") && password.length >= 6, [email, password]);

  useEffect(() => {
    const accountStrip = document.querySelector(".account-strip");
    setTarget(accountStrip);

    try {
      const remembered = window.localStorage.getItem("shopee-doctor-auth-email");
      if (remembered) setEmail(remembered);
    } catch {
      // localStorage may be blocked by browser privacy settings.
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setReady(true);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUserEmail(data.session?.user.email ?? null);
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setUserEmail(session?.user.email ?? null);
      setReady(true);
      if (event === "SIGNED_IN" && session?.user.email) {
        setNotice("登录成功。之后的真实诊断会自动保存到你的账号。 ");
        setNoticeKind("success");
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  function rememberEmail() {
    try {
      window.localStorage.setItem("shopee-doctor-auth-email", normalizeEmail(email));
    } catch {
      // Not critical to authentication.
    }
  }

  function requireEmail(): string | null {
    const normalized = normalizeEmail(email);
    if (!normalized || !normalized.includes("@")) {
      setNotice("请先输入正确的邮箱地址。 ");
      setNoticeKind("warning");
      return null;
    }
    return normalized;
  }

  async function login() {
    const supabase = getSupabaseBrowserClient();
    const normalized = requireEmail();
    if (!supabase || !normalized) return;
    if (password.length < 6) {
      setNotice("请输入密码（至少 6 位）。 ");
      setNoticeKind("warning");
      return;
    }

    setWorking("login");
    setNotice("");
    rememberEmail();
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: normalized, password });
      if (error) throw error;
      setNotice("登录成功。之后的真实诊断会自动保存到 Supabase。 ");
      setNoticeKind("success");
      setPassword("");
    } catch (error) {
      setNotice(friendlyAuthError(error));
      setNoticeKind("error");
    } finally {
      setWorking(null);
    }
  }

  async function signup() {
    const supabase = getSupabaseBrowserClient();
    const normalized = requireEmail();
    if (!supabase || !normalized) return;
    if (password.length < 8) {
      setNotice("注册密码建议至少 8 位。请输入更长的密码后再注册。 ");
      setNoticeKind("warning");
      return;
    }

    setWorking("signup");
    setNotice("");
    rememberEmail();
    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalized,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      if (data.session) {
        setNotice("注册并登录成功。 ");
        setNoticeKind("success");
        setPassword("");
      } else {
        setNotice("注册请求已提交。请到邮箱点击验证链接；验证完成后回到这里登录。如果没有收到邮件，可点击“重新发送验证邮件”。 ");
        setNoticeKind("success");
      }
    } catch (error) {
      setNotice(friendlyAuthError(error));
      setNoticeKind("error");
    } finally {
      setWorking(null);
    }
  }

  async function resendConfirmation() {
    const supabase = getSupabaseBrowserClient();
    const normalized = requireEmail();
    if (!supabase || !normalized) return;

    setWorking("resend");
    setNotice("");
    rememberEmail();
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalized,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setNotice("验证邮件已经重新发送。请检查收件箱和垃圾邮件；点击邮件中的确认链接后，再回到这里登录。 ");
      setNoticeKind("success");
    } catch (error) {
      setNotice(friendlyAuthError(error));
      setNoticeKind("error");
    } finally {
      setWorking(null);
    }
  }

  async function resetPassword() {
    const supabase = getSupabaseBrowserClient();
    const normalized = requireEmail();
    if (!supabase || !normalized) return;

    setWorking("reset");
    setNotice("");
    rememberEmail();
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(normalized, { redirectTo });
      if (error) throw error;
      setNotice("密码重置邮件已发送。请打开邮件中的重置链接，在新页面设置新密码。 ");
      setNoticeKind("success");
    } catch (error) {
      setNotice(friendlyAuthError(error));
      setNoticeKind("error");
    } finally {
      setWorking(null);
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setWorking("logout");
    try {
      await supabase.auth.signOut();
      setNotice("已退出登录。新的诊断在再次登录前只保留在当前页面。 ");
      setNoticeKind("info");
      setUserEmail(null);
    } finally {
      setWorking(null);
    }
  }

  if (!target) return null;

  return createPortal(
    <div className="auth-v23">
      <div className="auth-v23-copy">
        <div className="auth-v23-title-row">
          <strong>诊断记录与数据安全</strong>
          <span className="auth-v23-version">AUTH V2.3</span>
        </div>
        <span>报表仍在浏览器内解析；登录后只保存结构化指标与诊断结果，不上传原始报表文件。</span>
      </div>

      {!configured ? (
        <div className="auth-v23-state auth-v23-warning">Supabase 未配置 · 当前仅本地分析</div>
      ) : !ready ? (
        <div className="auth-v23-state">正在检查登录状态…</div>
      ) : userEmail ? (
        <div className="auth-v23-user">
          <div><small>已登录</small><b>{userEmail}</b></div>
          <button type="button" onClick={signOut} disabled={working === "logout"}>{working === "logout" ? "退出中…" : "退出"}</button>
        </div>
      ) : (
        <form className="auth-v23-form" onSubmit={(event) => { event.preventDefault(); void login(); }}>
          <div className="auth-v23-inputs">
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="邮箱" autoComplete="email" />
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="密码" autoComplete="current-password" />
          </div>
          <div className="auth-v23-primary-actions">
            <button type="submit" disabled={Boolean(working) || !canSubmit}>{working === "login" ? "登录中…" : "登录"}</button>
            <button type="button" className="auth-v23-secondary" onClick={signup} disabled={Boolean(working)}>{working === "signup" ? "注册中…" : "注册"}</button>
          </div>
          <div className="auth-v23-help-actions">
            <button type="button" onClick={resendConfirmation} disabled={Boolean(working)}>{working === "resend" ? "发送中…" : "重新发送验证邮件"}</button>
            <button type="button" onClick={resetPassword} disabled={Boolean(working)}>{working === "reset" ? "发送中…" : "忘记密码"}</button>
          </div>
        </form>
      )}

      {notice && <div className={`auth-v23-notice auth-v23-${noticeKind}`} role="status">{notice}</div>}
    </div>,
    target,
  );
}

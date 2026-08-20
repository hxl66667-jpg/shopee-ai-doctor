"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setReady(true);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(Boolean(data.session));
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(Boolean(session));
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function updatePassword() {
    if (password.length < 8) {
      setMessage("新密码至少需要 8 位。 ");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("两次输入的密码不一致。 ");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase 尚未配置。 ");
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setMessage("密码已更新成功。为了安全，系统会退出当前恢复会话，然后返回首页重新登录。 ");
      setPassword("");
      setConfirmPassword("");
      await supabase.auth.signOut();
      window.setTimeout(() => window.location.assign("/"), 1800);
    } catch (error) {
      setMessage(error instanceof Error ? `密码更新失败：${error.message}` : "密码更新失败，请重新发送重置邮件。 ");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="recovery-page">
      <section className="recovery-card">
        <div className="recovery-brand"><span>R</span><div><strong>REAIM</strong><small>Shopee AI Doctor</small></div></div>
        <div className="recovery-kicker">ACCOUNT RECOVERY</div>
        <h1>设置新密码</h1>
        <p>从 Shopee AI Doctor 发出的密码重置邮件进入此页面后，可以为账号设置新的登录密码。</p>

        {!hasSupabaseBrowserConfig() ? (
          <div className="recovery-status recovery-error">Supabase 尚未配置，暂时无法修改密码。</div>
        ) : !ready ? (
          <div className="recovery-status">正在验证重置链接…</div>
        ) : !hasSession ? (
          <div className="recovery-status recovery-error">重置链接无效、已经过期，或没有建立恢复会话。请返回首页，点击“忘记密码”重新发送一封邮件。</div>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); void updatePassword(); }}>
            <label>新密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="至少 8 位" /></label>
            <label>再次输入新密码<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="再次输入" /></label>
            <button type="submit" disabled={working || success}>{working ? "正在更新…" : success ? "已更新" : "确认修改密码"}</button>
          </form>
        )}

        {message && <div className={`recovery-status ${success ? "recovery-success" : "recovery-error"}`}>{message}</div>}
        <a className="recovery-back" href="/">← 返回 Shopee AI Doctor</a>
      </section>
    </main>
  );
}

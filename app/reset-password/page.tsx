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

    const initRecovery = async () => {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");

      if (accessToken && refreshToken && type === "recovery") {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }

      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session));
      setReady(true);
    };

    void initRecovery();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(Boolean(session));
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function updatePassword() {
    if (password.length < 8) {
      setMessage("新密码至少需要 8 位。");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("两次输入的密码不一致。");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setWorking(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(`密码更新失败：${error.message}`);
    } else {
      setSuccess(true);
      setMessage("密码修改成功，请重新登录。");
      await supabase.auth.signOut();
      setTimeout(() => window.location.assign("/"), 1500);
    }
    setWorking(false);
  }

  return (
    <main className="recovery-page">
      <section className="recovery-card">
        <h1>设置新密码</h1>
        {!hasSupabaseBrowserConfig() ? (
          <div className="recovery-status recovery-error">Supabase 未配置。</div>
        ) : !ready ? (
          <div className="recovery-status">正在验证重置链接…</div>
        ) : !hasSession ? (
          <div className="recovery-status recovery-error">重置链接无效或已过期，请重新发送密码邮件。</div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void updatePassword(); }}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="新密码" />
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="确认密码" />
            <button disabled={working || success}>{working ? "更新中…" : "修改密码"}</button>
          </form>
        )}
        {message && <div className="recovery-status">{message}</div>}
      </section>
    </main>
  );
}

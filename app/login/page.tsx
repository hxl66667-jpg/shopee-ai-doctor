import { login, signup } from "./actions";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const configured = hasSupabaseConfig();
  return (
    <div className="loginWrap">
      <div className="card">
        <h1>登录 Shopee AI Doctor</h1>
        <p className="muted">上传的店铺经营数据会通过 Supabase RLS 与账号隔离。</p>
        {!configured && <div className="notice warning">Vercel 还没有配置 Supabase 环境变量。先完成部署配置后再登录。</div>}
        {params.error && <div className="notice error">{params.error}</div>}
        {params.message && <div className="notice info">{params.message}</div>}
        <form>
          <div style={{ marginTop: 16 }}><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
          <div style={{ marginTop: 14 }}><label htmlFor="password">Password</label><input id="password" name="password" type="password" required minLength={8} autoComplete="current-password" /></div>
          <div className="loginActions">
            <button formAction={login} disabled={!configured}>Log in</button>
            <button className="secondary" formAction={signup} disabled={!configured}>Create account</button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { analyzeReports } from "@/lib/shopee/diagnosis";
import { demoAds, demoAffiliate, demoProducts } from "@/lib/shopee/demo";
import { parseAds, parseAffiliate, parseProductPerformance } from "@/lib/shopee/parser";
import type { AnalysisResult, Diagnosis, Severity } from "@/lib/shopee/types";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";
import { loadRecentRuns, saveAnalysis, type RecentRun } from "@/lib/supabase/persistence";

const severityLabel: Record<Severity, string> = {
  P0: "立即处理",
  P1: "高优先级",
  P2: "可优化",
  SCALE: "可放量",
  WATCH: "观察",
  DATA: "数据问题",
};

const severityOrder: Severity[] = ["P0", "P1", "SCALE", "P2", "WATCH", "DATA"];

type SaveState = "idle" | "local" | "saving" | "saved" | "error";

interface AiAction {
  priority?: string;
  action?: string;
  why?: string;
  expectedImpact?: string;
}

interface AiAnalysis {
  summary?: string;
  rootCauses?: string[];
  actions?: AiAction[];
  creativeBrief?: { mainImage?: string; title?: string; detailPage?: string };
  abTest?: { variable?: string; control?: string; variant?: string; successMetric?: string; minimumWindow?: string };
  risks?: string[];
  meta?: { model?: string; generatedAt?: string; source?: string };
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value || 0);
}

function FileCard({ title, description, required, file, accept, onChange }: { title: string; description: string; required?: boolean; file: File | null; accept: string; onChange: (file: File | null) => void }) {
  return (
    <label className={`file-card ${file ? "has-file" : ""}`}>
      <input type="file" accept={accept} onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
      <div className="file-icon">{file ? "✓" : "+"}</div>
      <div>
        <div className="file-title">{title} {required && <span>必需</span>}</div>
        <div className="file-description">{file ? file.name : description}</div>
      </div>
    </label>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div className="metric-card"><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-hint">{hint}</div></div>;
}

function DiagnosisDrawer({ item, onClose, runId, canUseAi }: { item: Diagnosis; onClose: () => void; runId: string | null; canUseAi: boolean }) {
  const cr = item.row.confirmedBuyerCr || item.row.placedBuyerCr;
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [aiWorking, setAiWorking] = useState(false);
  const [aiError, setAiError] = useState("");

  async function runAiDiagnosis() {
    if (!runId) {
      setAiError("请先完成并保存一次真实诊断，再使用 AI 深度诊断。 ");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setAiError("登录已失效，请重新登录。 ");
      return;
    }

    setAiWorking(true);
    setAiError("");
    try {
      const response = await fetch("/api/ai-diagnose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ importRunId: runId, itemId: item.itemId }),
      });
      const payload = await response.json().catch(() => ({})) as { analysis?: AiAnalysis; error?: string };
      if (!response.ok || !payload.analysis) throw new Error(payload.error || "AI 深度诊断失败。 ");
      setAiAnalysis(payload.analysis);
    } catch (caught) {
      setAiError(caught instanceof Error ? caught.message : "AI 深度诊断失败。 ");
    } finally {
      setAiWorking(false);
    }
  }

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="商品诊断详情" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="drawer-close" aria-label="关闭诊断详情" onClick={onClose}>×</button>
        <div className={`severity-badge severity-${item.severity.toLowerCase()}`}>{item.severity} · {severityLabel[item.severity]}</div>
        <h2>{item.productName}</h2>
        <div className="drawer-id">Item ID: {item.itemId}</div>
        <div className="drawer-score"><span>机会分</span><strong>{item.opportunityScore}</strong><small>/100</small></div>
        <div className="mini-grid">
          <div><span>CTR</span><strong>{pct(item.row.ctr)}</strong></div>
          <div><span>加购率</span><strong>{pct(item.row.addToCartRate)}</strong></div>
          <div><span>成交率</span><strong>{pct(cr)}</strong></div>
          <div><span>ROAS</span><strong>{item.row.ad ? item.row.ad.roas.toFixed(2) : "—"}</strong></div>
        </div>
        <section className="drawer-section"><h3>核心判断</h3><p className="problem-text">{item.primaryProblem}</p></section>
        <section className="drawer-section"><h3>证据</h3><ul>{item.evidence.map((line) => <li key={line}>{line}</li>)}</ul></section>
        <section className="drawer-section"><h3>规则建议动作</h3><ol>{item.actions.map((line) => <li key={line}>{line}</li>)}</ol></section>

        <section className="drawer-section ai-section">
          <div className="ai-heading">
            <div><span className="ai-kicker">GPT-5.6 LUNA</span><h3>AI 深度诊断</h3></div>
            {!aiAnalysis && <button type="button" className="ai-button" onClick={runAiDiagnosis} disabled={aiWorking || !canUseAi}>{aiWorking ? "正在分析…" : "生成深度方案"}</button>}
          </div>
          {!canUseAi && <p className="ai-note">登录并完成一次真实诊断后可使用。AI 只接收已保存的结构化指标，不接收原始报表文件。</p>}
          {aiError && <div className="ai-error">{aiError}</div>}
          {aiAnalysis && (
            <div className="ai-result">
              <p className="ai-summary">{aiAnalysis.summary || "已生成深度诊断。"}</p>
              {(aiAnalysis.rootCauses?.length ?? 0) > 0 && <div className="ai-block"><h4>可能根因</h4><ul>{aiAnalysis.rootCauses?.map((cause) => <li key={cause}>{cause}</li>)}</ul></div>}
              {(aiAnalysis.actions?.length ?? 0) > 0 && <div className="ai-block"><h4>执行优先级</h4><div className="ai-actions">{aiAnalysis.actions?.map((action, index) => <article key={`${action.action}-${index}`}><b>{action.priority || `#${index + 1}`}</b><strong>{action.action}</strong><p>{action.why}</p><small>观察：{action.expectedImpact}</small></article>)}</div></div>}
              {aiAnalysis.creativeBrief && <div className="ai-block"><h4>素材与页面 Brief</h4><dl><div><dt>主图</dt><dd>{aiAnalysis.creativeBrief.mainImage}</dd></div><div><dt>标题</dt><dd>{aiAnalysis.creativeBrief.title}</dd></div><div><dt>详情页</dt><dd>{aiAnalysis.creativeBrief.detailPage}</dd></div></dl></div>}
              {aiAnalysis.abTest && <div className="ai-block"><h4>A/B 测试</h4><p><b>{aiAnalysis.abTest.variable}</b></p><p>对照：{aiAnalysis.abTest.control}</p><p>实验：{aiAnalysis.abTest.variant}</p><p>成功指标：{aiAnalysis.abTest.successMetric} · {aiAnalysis.abTest.minimumWindow}</p></div>}
              {(aiAnalysis.risks?.length ?? 0) > 0 && <div className="ai-block ai-risks"><h4>需要进一步验证</h4><ul>{aiAnalysis.risks?.map((risk) => <li key={risk}>{risk}</li>)}</ul></div>}
              {aiAnalysis.meta?.model && <div className="ai-meta">已缓存 · {aiAnalysis.meta.model}</div>}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

export function DoctorApp() {
  const [shopUrl, setShopUrl] = useState("https://shopee.ph/boltnutmall#product_list");
  const [productFile, setProductFile] = useState<File | null>(null);
  const [adsFile, setAdsFile] = useState<File | null>(null);
  const [affiliateFile, setAffiliateFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selected, setSelected] = useState<Diagnosis | null>(null);
  const [severity, setSeverity] = useState<Severity | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [savedRunId, setSavedRunId] = useState<string | null>(null);

  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authWorking, setAuthWorking] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [history, setHistory] = useState<RecentRun[]>([]);

  const supabaseConfigured = hasSupabaseBrowserConfig();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUserEmail(data.session?.user.email ?? null);
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUserEmail(session?.user.email ?? null);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userEmail || !shopUrl) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    loadRecentRuns(shopUrl)
      .then((rows) => { if (!cancelled) setHistory(rows); })
      .catch(() => { if (!cancelled) setHistory([]); });
    return () => { cancelled = true; };
  }, [shopUrl, userEmail]);

  const filtered = useMemo(() => {
    if (!result) return [];
    const normalized = query.trim().toLowerCase();
    return result.diagnoses.filter((item) => (severity === "ALL" || item.severity === severity) && (!normalized || item.productName.toLowerCase().includes(normalized) || item.itemId.includes(normalized)));
  }, [query, result, severity]);

  const summary = useMemo(() => {
    if (!result) return null;
    const totalGmv = result.products.reduce((sum, row) => sum + row.confirmedSales, 0);
    const p0 = result.diagnoses.filter((item) => item.severity === "P0").length;
    const scale = result.diagnoses.filter((item) => item.severity === "SCALE").length;
    const avgCtr = result.products.length ? result.products.reduce((sum, row) => sum + row.ctr, 0) / result.products.length : 0;
    return { totalGmv, p0, scale, avgCtr };
  }, [result]);

  async function refreshHistory() {
    if (!userEmail || !shopUrl) return;
    try {
      setHistory(await loadRecentRuns(shopUrl));
    } catch {
      // History is secondary; a failed refresh should not hide a completed diagnosis.
    }
  }

  async function handleAuth(mode: "login" | "signup") {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthMessage("Supabase 环境变量未配置。 ");
      return;
    }
    if (!authEmail.trim() || authPassword.length < 6) {
      setAuthMessage("请输入有效邮箱，密码至少 6 位。 ");
      return;
    }

    setAuthWorking(true);
    setAuthMessage("");
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword });
        if (authError) throw authError;
        setAuthMessage(data.session ? "注册并登录成功。" : "注册成功。若邮箱确认已开启，请先到邮箱完成确认，再回来登录。 ");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
        if (authError) throw authError;
        setAuthMessage("登录成功，之后的真实诊断会自动保存。 ");
      }
    } catch (caught) {
      setAuthMessage(caught instanceof Error ? caught.message : "登录失败，请检查邮箱和密码。 ");
    } finally {
      setAuthWorking(false);
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setHistory([]);
    setSavedRunId(null);
    setSaveState("local");
    setSaveMessage("已退出登录；新诊断将只保留在当前页面。 ");
  }

  async function runAnalysis() {
    if (!productFile) {
      setError("请先上传 Product Performance / 商品表现报表。也可以先点击“查看演示结果”。");
      return;
    }
    setWorking(true);
    setError("");
    setSaveMessage("");
    setSavedRunId(null);
    try {
      const [products, ads, affiliate] = await Promise.all([
        parseProductPerformance(productFile),
        adsFile ? parseAds(adsFile) : Promise.resolve([]),
        affiliateFile ? parseAffiliate(affiliateFile) : Promise.resolve([]),
      ]);
      if (!products.length) throw new Error("没有识别到商品汇总数据。请确认报表格式与 Shopee Product Performance 一致。 ");

      const analysis = analyzeReports(products, ads, affiliate);
      setResult(analysis);

      if (!userEmail) {
        setSaveState("local");
        setSaveMessage(supabaseConfigured ? "诊断已完成；登录后可自动保存到 Supabase。" : "诊断已完成；当前未配置 Supabase，因此只保留在本页面。 ");
        return;
      }

      setSaveState("saving");
      setSaveMessage("正在把本次诊断安全保存到 Supabase…");
      try {
        const saved = await saveAnalysis({
          shopUrl,
          products,
          ads,
          affiliate,
          analysis,
          sourceFiles: {
            product: productFile.name,
            ads: adsFile?.name,
            affiliate: affiliateFile?.name,
          },
        });
        setSavedRunId(saved.importRunId);
        setSaveState("saved");
        setSaveMessage(`已保存诊断记录 · Run ${saved.importRunId.slice(0, 8)} · 可打开任一商品生成 AI 深度方案`);
        await refreshHistory();
      } catch (saveError) {
        setSaveState("error");
        setSaveMessage(saveError instanceof Error ? `诊断已完成，但保存失败：${saveError.message}` : "诊断已完成，但保存失败。 ");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "解析失败，请检查文件格式。 ");
    } finally {
      setWorking(false);
    }
  }

  function loadDemo() {
    setError("");
    setResult(analyzeReports(demoProducts, demoAds, demoAffiliate));
    setSavedRunId(null);
    setSaveState("local");
    setSaveMessage("当前是演示数据，不写入数据库，也不消耗 AI API。 ");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">R</div><div><strong>REAIM</strong><span>Shopee AI Doctor</span></div></div>
        <div className="topbar-status"><i /> V2.2 · AI Diagnosis</div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">SHOPEE PHILIPPINES · PRODUCT DIAGNOSTICS</div>
          <h1>把店铺报表变成<br /><em>可执行的链接诊断。</em></h1>
          <p>输入店铺链接并上传 Shopee 后台报表，系统会按 Item ID 合并商品、广告和联盟数据，用店内动态 P25 / Median / P75 判断问题，再把结构化证据交给 AI 生成可执行方案。</p>
          <div className="hero-pills"><span>CTR 点击诊断</span><span>加购率</span><span>转化率</span><span>广告 ROAS</span><span>AI 深度方案</span></div>
        </div>
        <div className="hero-panel">
          <div className="hero-panel-label">本次诊断店铺</div>
          <input value={shopUrl} onChange={(event) => setShopUrl(event.target.value)} placeholder="https://shopee.ph/yourshop#product_list" />
          <div className="hero-panel-note">店铺链接用于标识诊断对象；核心判断来自你上传的后台真实数据，避免只凭前台页面猜测。</div>
        </div>
      </section>

      <section className="account-strip">
        <div className="account-copy">
          <strong>诊断记录与数据安全</strong>
          <span>报表仍在浏览器内解析；登录后只保存结构化指标与诊断结果，不上传原始报表文件。</span>
        </div>
        {!supabaseConfigured ? (
          <div className="account-state account-warning">Supabase 未配置 · 当前仅本地分析</div>
        ) : !authReady ? (
          <div className="account-state">正在检查登录状态…</div>
        ) : userEmail ? (
          <div className="account-user"><div><small>已登录</small><b>{userEmail}</b></div><button type="button" onClick={signOut}>退出</button></div>
        ) : (
          <div className="auth-form">
            <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="邮箱" autoComplete="email" />
            <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="密码（至少 6 位）" autoComplete="current-password" />
            <button type="button" onClick={() => handleAuth("login")} disabled={authWorking}>{authWorking ? "处理中…" : "登录"}</button>
            <button type="button" className="auth-secondary" onClick={() => handleAuth("signup")} disabled={authWorking}>注册</button>
          </div>
        )}
        {authMessage && <div className="auth-message">{authMessage}</div>}
      </section>

      <section className="workspace">
        <div className="section-heading"><div><span>01</span><h2>上传数据</h2></div><p>Product Performance 必需；广告与联盟报表可选，但上传后诊断更完整。</p></div>
        <div className="file-grid">
          <FileCard title="Product Performance" description="XLSX / XLS / CSV · 商品级表现" required file={productFile} accept=".xlsx,.xls,.csv" onChange={setProductFile} />
          <FileCard title="Shopee Ads" description="CSV / XLSX · GMV Max / 搜索广告" file={adsFile} accept=".csv,.xlsx,.xls" onChange={setAdsFile} />
          <FileCard title="Affiliate" description="CSV / XLSX · 联盟伙伴贡献" file={affiliateFile} accept=".csv,.xlsx,.xls" onChange={setAffiliateFile} />
        </div>
        {error && <div className="error-box">{error}</div>}
        <div className="action-row">
          <button type="button" className="primary-button" onClick={runAnalysis} disabled={working}>{working ? "正在解析与诊断…" : "开始诊断"}</button>
          <button type="button" className="secondary-button" onClick={loadDemo}>查看演示结果</button>
          <span>真实报表在浏览器内解析；数据库仅保存结构化指标与结果。</span>
        </div>
        {saveMessage && <div className={`save-state save-${saveState}`}>{saveMessage}</div>}
      </section>

      {result && summary && (
        <section className="results">
          <div className="section-heading"><div><span>02</span><h2>诊断总览</h2></div><p>{shopUrl || "当前店铺"} · 共识别 {result.products.length} 个商品链接</p></div>
          <div className="metric-grid">
            <MetricCard label="确认销售额" value={money(summary.totalGmv)} hint="本次 Product Performance 数据" />
            <MetricCard label="平均 CTR" value={pct(summary.avgCtr)} hint={`店内中位数 ${pct(result.benchmarks.ctr.median)}`} />
            <MetricCard label="P0 链接" value={String(summary.p0)} hint="优先处理高流量损失" />
            <MetricCard label="可放量链接" value={String(summary.scale)} hint="CTR + CR 达到店内高位" />
          </div>

          {result.warnings.length > 0 && <div className="warning-strip">{result.warnings.map((warning) => <span key={warning}>• {warning}</span>)}</div>}

          <div className="result-card">
            <div className="result-toolbar">
              <div className="severity-tabs"><button type="button" className={severity === "ALL" ? "active" : ""} onClick={() => setSeverity("ALL")}>全部 {result.diagnoses.length}</button>{severityOrder.map((level) => <button type="button" key={level} className={severity === level ? "active" : ""} onClick={() => setSeverity(level)}>{level} {result.diagnoses.filter((item) => item.severity === level).length}</button>)}</div>
              <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索商品名 / Item ID" />
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>优先级</th><th>商品</th><th>曝光</th><th>CTR</th><th>加购率</th><th>成交率</th><th>ROAS</th><th>机会分</th><th>核心判断</th></tr></thead>
                <tbody>{filtered.map((item) => { const cr = item.row.confirmedBuyerCr || item.row.placedBuyerCr; return <tr key={item.itemId} onClick={() => setSelected(item)}><td><span className={`severity-badge severity-${item.severity.toLowerCase()}`}>{item.severity}</span></td><td><strong>{item.productName}</strong><small>{item.itemId}</small></td><td>{Math.round(item.row.impressions).toLocaleString()}</td><td>{pct(item.row.ctr)}</td><td>{pct(item.row.addToCartRate)}</td><td>{pct(cr)}</td><td>{item.row.ad ? item.row.ad.roas.toFixed(2) : "—"}</td><td><div className="score-cell"><b>{item.opportunityScore}</b><span><i style={{ width: `${item.opportunityScore}%` }} /></span></div></td><td className="problem-cell">{item.primaryProblem}<span>查看详情 →</span></td></tr>; })}</tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {userEmail && history.length > 0 && (
        <section className="history-section">
          <div className="section-heading"><div><span>03</span><h2>最近诊断记录</h2></div><p>同一店铺最近保存的 8 次诊断，用于后续复盘优化前后变化。</p></div>
          <div className="history-grid">
            {history.map((run) => (
              <article className="history-card" key={run.id}>
                <div><span className={`history-status history-${run.status}`}>{run.status === "completed" ? "已完成" : run.status === "failed" ? "失败" : "处理中"}</span><small>{new Date(run.createdAt).toLocaleString("zh-CN")}</small></div>
                <strong>{run.productCount} 个商品</strong>
                <p>P0 {run.p0} · P1 {run.p1} · SCALE {run.scale}</p>
                <code>{run.id.slice(0, 8)}</code>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="logic-section">
        <div className="section-heading"><div><span>04</span><h2>诊断逻辑</h2></div><p>先看样本量，再看流量漏斗；优先修“高曝光 × 大缺口”的链接。</p></div>
        <div className="logic-grid">
          <div><b>1</b><h3>曝光 → 点击</h3><p>CTR 低于店内 P25 且曝光足够，优先检查主图、标题、价格与搜索相关性。</p></div>
          <div><b>2</b><h3>点击 → 加购</h3><p>加购率偏低，说明首屏承诺与详情页承接、规格说明或价格梯度需要调整。</p></div>
          <div><b>3</b><h3>访客 → 成交</h3><p>有流量但成交弱，重点排查 SKU、信任、评价、优惠、售后和购买决策成本。</p></div>
          <div><b>4</b><h3>广告 → GMV</h3><p>广告数据按 Item ID 合并，区分“素材点击问题”和“商品本身转化问题”。</p></div>
        </div>
      </section>

      <footer><strong>Shopee AI Doctor</strong><span>REAIM Operations Intelligence · V2.2</span></footer>
      {selected && <DiagnosisDrawer item={selected} onClose={() => setSelected(null)} runId={savedRunId} canUseAi={Boolean(userEmail && savedRunId)} />}
    </main>
  );
}

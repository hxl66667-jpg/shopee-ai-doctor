"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createWorkspaceOptimizationTest,
  loadOptimizationWorkspace,
  type LatestDiagnosisOption,
  type OptimizationWorkspaceData,
} from "@/lib/supabase/optimization-workspace";
import type { OptimizationMetric, OptimizationResult } from "@/lib/supabase/optimization";

const emptyData: OptimizationWorkspaceData = {
  latestRunId: null,
  latestRunCreatedAt: null,
  shopUrl: null,
  options: [],
  tests: [],
};

const metricLabels: Record<OptimizationMetric, string> = {
  ctr: "CTR 点击率",
  add_to_cart_rate: "加购率",
  conversion_rate: "成交转化率",
  roas: "广告 ROAS",
};

const resultLabels: Record<OptimizationResult, string> = {
  pending: "待复盘",
  improved: "已改善",
  flat: "基本持平",
  worse: "变差",
};

function inferMetric(option: LatestDiagnosisOption | null): OptimizationMetric {
  const text = `${option?.primaryProblem ?? ""}`;
  if (/加购/.test(text)) return "add_to_cart_rate";
  if (/成交|转化/.test(text)) return "conversion_rate";
  if (/ROAS|广告/.test(text)) return "roas";
  return "ctr";
}

function valueOf(option: LatestDiagnosisOption | null, metric: OptimizationMetric): number | null {
  if (!option) return null;
  if (metric === "ctr") return option.ctr;
  if (metric === "add_to_cart_rate") return option.addToCartRate;
  if (metric === "conversion_rate") return option.conversionRate;
  return option.roas;
}

function metricValue(metric: OptimizationMetric, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (metric === "roas") return value.toFixed(2);
  return `${(value * 100).toFixed(2)}%`;
}

export function OptimizationWorkspace() {
  const [open, setOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<OptimizationWorkspaceData>(emptyData);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [changeType, setChangeType] = useState("main_image");
  const [changeSummary, setChangeSummary] = useState("");
  const [metric, setMetric] = useState<OptimizationMetric>("ctr");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!mounted) return;
      setUserEmail(sessionData.session?.user.email ?? null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUserEmail(session?.user.email ?? null);
      if (!session) setData(emptyData);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function refresh() {
    if (!userEmail) return;
    setLoading(true);
    setMessage("");
    try {
      const next = await loadOptimizationWorkspace();
      setData(next);
      const first = next.options[0] ?? null;
      setSelectedItemId((current) => current && next.options.some((row) => row.itemId === current) ? current : first?.itemId ?? "");
      if (first) setMetric(inferMetric(first));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取优化记录失败。 ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && userEmail) void refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userEmail]);

  const selected = useMemo(() => data.options.find((row) => row.itemId === selectedItemId) ?? null, [data.options, selectedItemId]);
  const baseline = valueOf(selected, metric);

  function changeSelected(itemId: string) {
    setSelectedItemId(itemId);
    const option = data.options.find((row) => row.itemId === itemId) ?? null;
    setMetric(inferMetric(option));
  }

  async function createTest() {
    if (!selected) {
      setMessage("还没有可登记的已保存诊断。 ");
      return;
    }
    if (changeSummary.trim().length < 4) {
      setMessage("请写清楚本次具体改了什么，方便下次复盘。 ");
      return;
    }
    if (baseline === null) {
      setMessage("当前周期没有这个指标，请换一个观察指标。 ");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await createWorkspaceOptimizationTest({
        option: selected,
        changeType,
        changeSummary: changeSummary.trim(),
        metricToWatch: metric,
      });
      setChangeSummary("");
      setMessage("优化动作已登记。下次上传新周期报表后，系统会自动判定改善 / 持平 / 变差。 ");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登记失败。 ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" className="optimization-fab" onClick={() => setOpen(true)}>
        <span>↗</span><b>优化复盘</b>
      </button>

      {open && (
        <div className="optimization-backdrop" onMouseDown={() => setOpen(false)}>
          <section className="optimization-modal" role="dialog" aria-modal="true" aria-label="优化复盘工作台" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="optimization-close" aria-label="关闭" onClick={() => setOpen(false)}>×</button>
            <header>
              <span>OPTIMIZATION LOOP</span>
              <h2>优化动作 → 新周期数据 → 自动复盘</h2>
              <p>一次只改一个主要变量，并提前指定观察指标，避免“改了很多东西但不知道什么有效”。</p>
            </header>

            {!authReady ? <div className="optimization-empty">正在检查登录状态…</div> : !userEmail ? (
              <div className="optimization-empty"><strong>请先在主页面登录</strong><p>登录后才能把优化动作与你自己的诊断记录关联。</p></div>
            ) : loading ? <div className="optimization-empty">正在读取最近诊断与复盘记录…</div> : !data.latestRunId ? (
              <div className="optimization-empty"><strong>还没有已保存的真实诊断</strong><p>先在主页面上传 Product Performance 并完成一次诊断。</p></div>
            ) : (
              <>
                <div className="optimization-run"><div><small>最新基线 Run</small><code>{data.latestRunId.slice(0, 8)}</code></div><div><small>店铺</small><span>{data.shopUrl || "—"}</span></div><div><small>时间</small><span>{data.latestRunCreatedAt ? new Date(data.latestRunCreatedAt).toLocaleString("zh-CN") : "—"}</span></div></div>

                <div className="optimization-form">
                  <label><span>要优化的商品</span><select value={selectedItemId} onChange={(event) => changeSelected(event.target.value)}>{data.options.map((option) => <option key={option.itemId} value={option.itemId}>{option.severity} · {option.itemId} · {option.productName.slice(0, 52)}</option>)}</select></label>
                  {selected && <div className="optimization-problem"><b>{selected.severity}</b><span>{selected.primaryProblem}</span></div>}
                  <div className="optimization-form-row">
                    <label><span>本次改动</span><select value={changeType} onChange={(event) => setChangeType(event.target.value)}><option value="main_image">主图 / 素材</option><option value="title">标题 / 关键词</option><option value="detail_page">详情页</option><option value="price_sku">价格 / SKU</option><option value="ads">广告策略</option><option value="promotion">优惠 / 活动</option><option value="other">其它</option></select></label>
                    <label><span>观察指标</span><select value={metric} onChange={(event) => setMetric(event.target.value as OptimizationMetric)}><option value="ctr">CTR 点击率</option><option value="add_to_cart_rate">加购率</option><option value="conversion_rate">成交转化率</option><option value="roas" disabled={selected?.roas === null}>广告 ROAS</option></select></label>
                  </div>
                  <div className="optimization-baseline"><span>当前基线</span><strong>{metricLabels[metric]} {metricValue(metric, baseline)}</strong><small>后续 ±5% 以内视为基本持平，并设置最小绝对容差。</small></div>
                  <label><span>具体做了什么</span><textarea value={changeSummary} onChange={(event) => setChangeSummary(event.target.value)} placeholder="例如：主图改为真实抽水场景，删除小字参数，放大 50M Hose 与 2HP 卖点；其他不变。" rows={3} /></label>
                  <button type="button" className="optimization-save" onClick={createTest} disabled={saving}>{saving ? "正在登记…" : "登记本次优化动作"}</button>
                  {message && <div className="optimization-message">{message}</div>}
                </div>

                <div className="optimization-history">
                  <h3>最近优化实验</h3>
                  {!data.tests.length ? <p className="optimization-no-tests">还没有登记过优化动作。</p> : data.tests.map((test) => (
                    <article key={test.id}>
                      <div className="optimization-history-top"><span className={`optimization-result result-${test.result}`}>{resultLabels[test.result]}</span><small>{new Date(test.createdAt).toLocaleDateString("zh-CN")}</small></div>
                      <strong>{test.productName}</strong>
                      <p>{test.changeSummary}</p>
                      <div className="optimization-delta"><span>{metricLabels[test.metricToWatch]}</span><b>{metricValue(test.metricToWatch, test.baselineValue)}</b><i>→</i><b>{metricValue(test.metricToWatch, test.followupValue)}</b></div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

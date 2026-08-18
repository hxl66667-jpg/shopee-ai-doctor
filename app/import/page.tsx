"use client";

import Link from "next/link";
import { useState } from "react";

type ImportResult = {
  ok: boolean;
  importRunId: string;
  summary: {
    products: number; skuRows: number; adsMatched: number; storeAdRows: number; affiliatePartners: number;
    businessInsightsLoaded: boolean;
    counts: Record<string, number>;
    warnings: Array<{ code: string; level: "info" | "warning" | "error"; message: string }>;
  };
  periods: Record<string, { start: string; end: string } | null>;
  preview: Array<{ itemId: string; productName: string; diagnosis: { severity: string; primaryProblem: string } }>;
};

export default function ImportPage() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(""); setResult(null);
    try {
      const form = new FormData(e.currentTarget);
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Import failed");
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown import error");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="hero">
      <h1>Import Shopee Data</h1>
      <p>直接上传 Seller Centre 原始导出，不改列名、不手工合并。Product Performance 是单品诊断主数据源，BI/Ads/Affiliate 用于补充店铺与渠道证据。</p>
    </div>
    <form onSubmit={submit} className="card">
      <div><label>Shopee Store URL</label><input name="shopUrl" type="url" defaultValue="https://shopee.ph/boltnutmall#product_list" required /></div>
      <div className="formGrid" style={{marginTop:16}}>
        <div className="upload"><label>Product Performance (.xlsx) *</label><p className="muted small">商品级 + SKU级，系统自动用 规格编号 = “-” 识别商品级。</p><input name="productPerformance" type="file" accept=".xlsx,.xls" required /></div>
        <div className="upload"><label>Business Insights (.xlsx)</label><p className="muted small">店铺漏斗、流量来源、来源商品分布。</p><input name="businessInsights" type="file" accept=".xlsx,.xls" /></div>
        <div className="upload"><label>Shopee Ads (.csv)</label><p className="muted small">自动定位 Sequence 表头；Product ID “-” 保留为店铺级。</p><input name="ads" type="file" accept=".csv" /></div>
        <div className="upload"><label>Affiliate (.csv)</label><p className="muted small">当前导出无 Item ID，因此按达人/店铺级保存。</p><input name="affiliate" type="file" accept=".csv" /></div>
      </div>
      <div style={{marginTop:18}}><button disabled={busy}>{busy ? "PARSING + SAVING..." : "ANALYZE & SAVE"}</button></div>
    </form>
    {error && <div className="notice error"><b>Import failed:</b> {error}</div>}
    {result && <div style={{marginTop:18}}>
      <div className="grid">
        <div className="card"><div className="muted">Products</div><div className="metric">{result.summary.products}</div></div>
        <div className="card"><div className="muted">SKU Rows</div><div className="metric">{result.summary.skuRows}</div></div>
        <div className="card"><div className="muted">Ads Matched</div><div className="metric">{result.summary.adsMatched}</div></div>
        <div className="card"><div className="muted">Affiliate Partners</div><div className="metric">{result.summary.affiliatePartners}</div></div>
      </div>
      <div className="sectionTitle">Diagnosis mix</div>
      <div className="pillRow">{Object.entries(result.summary.counts).map(([key,value]) => <span className={`badge ${key}`} key={key}>{key}: {value}</span>)}</div>
      {result.summary.warnings.map((w) => <div className={`notice ${w.level}`} key={w.code}><b>{w.code}</b> — {w.message}</div>)}
      <div className="card" style={{marginTop:14}}>
        <b>Import saved successfully.</b> <span className="muted">Run ID: {result.importRunId}</span>
        <div style={{marginTop:12}}><Link href="/"><button>OPEN DASHBOARD</button></Link></div>
      </div>
    </div>}
  </>;
}

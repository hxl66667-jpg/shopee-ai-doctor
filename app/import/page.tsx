"use client";
import { useState } from "react";

export default function ImportPage() {
  const [result, setResult] = useState<string>("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setResult("");
    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/analyze", { method: "POST", body: data });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Analyze failed");
      setResult(`已识别 ${json.products} 个商品；匹配 ${json.adsMatched} 个广告商品。`);
    } catch (err) { setResult(err instanceof Error ? err.message : "Unknown error"); }
    finally { setBusy(false); }
  }
  return <>
    <h1>Import Shopee Data</h1>
    <p className="muted">原始报表直接上传，不需要修改列名或人工合并。</p>
    <form onSubmit={submit} className="card">
      <div style={{marginBottom:16}}><label>Shopee Store URL</label><input name="shopUrl" type="url" defaultValue="https://shopee.ph/boltnutmall#product_list" required /></div>
      <div className="formGrid">
        <div className="upload"><label>Product Performance (.xlsx) *</label><input name="productPerformance" type="file" accept=".xlsx,.xls" required /></div>
        <div className="upload"><label>Business Insights (.xlsx)</label><input name="businessInsights" type="file" accept=".xlsx,.xls" /></div>
        <div className="upload"><label>Shopee Ads (.csv) *</label><input name="ads" type="file" accept=".csv" required /></div>
        <div className="upload"><label>Affiliate (.csv) Optional</label><input name="affiliate" type="file" accept=".csv" /></div>
      </div>
      <div style={{marginTop:18}}><button disabled={busy}>{busy ? "ANALYZING..." : "ANALYZE STORE"}</button></div>
      {result && <p style={{marginTop:16}}><b>{result}</b></p>}
    </form>
  </>;
}

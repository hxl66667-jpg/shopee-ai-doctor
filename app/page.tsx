import Link from "next/link";
import { redirect } from "next/navigation";
import { money, pct } from "@/lib/shopee/number";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type RelatedProduct = { item_id: string; product_name: string; product_url?: string | null };

export default async function Dashboard() {
  if (!hasSupabaseConfig()) return <div className="empty card" style={{marginTop:30}}><h1>V1.1 code is ready</h1><p className="muted">Add the two Supabase environment variables in Vercel, then redeploy.</p><p><span className="code">NEXT_PUBLIC_SUPABASE_URL</span> + <span className="code">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</span></p></div>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shop } = await supabase.from("shops").select("id,name,shop_url,shopee_shop_id").order("created_at", { ascending:false }).limit(1).maybeSingle();
  if (!shop) return <div className="empty card" style={{marginTop:30}}><h1>No store data yet</h1><p className="muted">Upload your four Shopee reports to create the first diagnosis batch.</p><Link href="/import"><button>IMPORT SHOPEE DATA</button></Link></div>;

  const { data: run } = await supabase.from("import_runs").select("*").eq("shop_id", shop.id).eq("status","completed").order("created_at",{ascending:false}).limit(1).maybeSingle();
  if (!run) return <div className="empty card" style={{marginTop:30}}><h1>{shop.name}</h1><p className="muted">Store exists, but there is no completed import yet.</p><Link href="/import"><button>IMPORT DATA</button></Link></div>;

  const [{ data: diagnoses }, { data: metrics }, { data: ads }, { data: benchmark }, { data: bi }] = await Promise.all([
    supabase.from("diagnoses").select("*,products(item_id,product_name,product_url)").eq("import_run_id", run.id),
    supabase.from("product_metrics").select("*").eq("import_run_id", run.id),
    supabase.from("ad_metrics").select("*").eq("import_run_id", run.id),
    supabase.from("benchmarks").select("*").eq("import_run_id", run.id).maybeSingle(),
    supabase.from("business_insights_store").select("*").eq("import_run_id", run.id).maybeSingle()
  ]);
  const metricMap = new Map((metrics || []).map((m: any) => [String(m.product_id), m]));
  const adMap = new Map((ads || []).map((a: any) => [String(a.product_id), a]));
  const counts: Record<string,number> = {P0:0,P1:0,P2:0,SCALE:0,WATCH:0,DATA:0};
  (diagnoses || []).forEach((d: any) => counts[d.severity] = (counts[d.severity]||0)+1);
  const productBench = (benchmark?.product_benchmarks || {}) as Record<string, any>;
  const warnings = Array.isArray(run.warnings) ? run.warnings : [];
  const priority = [...(diagnoses || [])].sort((a,b) => {
    const rank: Record<string,number> = {P0:0,P1:1,DATA:2,SCALE:3,P2:4,WATCH:5};
    return (rank[a.severity]??9)-(rank[b.severity]??9) || Number(b.opportunity_score||0)-Number(a.opportunity_score||0);
  });

  return <>
    <div className="hero"><h1>{shop.name || "Shopee AI Listing Doctor"}</h1><p>{run.period_start || "?"} → {run.period_end || "?"} · Item-level funnel is driven by Product Performance; BI/Ads/Affiliate add channel context.</p></div>
    <div className="grid">
      <div className="card"><div className="muted">Listings</div><div className="metric">{run.product_count}</div></div>
      <div className="card"><div className="muted">P0 Problems</div><div className="metric">{counts.P0}</div></div>
      <div className="card"><div className="muted">Scale Candidates</div><div className="metric">{counts.SCALE}</div></div>
      <div className="card"><div className="muted">Store CTR Median</div><div className="metric">{pct(Number(productBench?.ctr?.median || 0))}</div></div>
    </div>
    {bi && <><div className="sectionTitle">Store funnel</div><div className="grid3">
      <div className="card"><div className="muted">Placed GMV</div><div className="metric">{money(Number(bi.placed_sales||0))}</div><div className="small muted">{bi.placed_orders} orders · CR {pct(Number(bi.placed_conversion||0))}</div></div>
      <div className="card"><div className="muted">Paid GMV</div><div className="metric">{money(Number(bi.paid_sales||0))}</div><div className="small muted">{bi.paid_orders} paid orders · CR {pct(Number(bi.paid_conversion||0))}</div></div>
      <div className="card"><div className="muted">Visitors</div><div className="metric">{Number(bi.visitors||0).toLocaleString()}</div><div className="small muted">Product clicks {Number(bi.product_clicks||0).toLocaleString()}</div></div>
    </div></>}
    {warnings.length > 0 && <><div className="sectionTitle">Data quality</div>{warnings.map((w:any) => <div className={`notice ${w.level}`} key={w.code}><b>{w.code}</b> — {w.message}</div>)}</>}
    <div className="sectionTitle">Priority listings</div>
    <div className="card tableWrap"><table><thead><tr><th>Product</th><th>CTR</th><th>ATC</th><th>Confirmed CR</th><th>Ads ROAS</th><th>Diagnosis</th><th>Opportunity</th></tr></thead><tbody>
      {priority.map((d:any) => {
        const p = d.products as RelatedProduct | null; const m:any = metricMap.get(String(d.product_id)); const a:any = adMap.get(String(d.product_id));
        if (!p) return null;
        return <tr key={d.id}><td><Link href={`/products/${p.item_id}`}><b>{p.product_name}</b><div className="muted small">{p.item_id}</div></Link></td><td>{pct(Number(m?.ctr||0))}</td><td>{pct(Number(m?.add_to_cart_rate||0))}</td><td>{pct(Number(m?.confirmed_buyer_cr||0))}</td><td>{a ? Number(a.roas||0).toFixed(2) : "—"}</td><td><span className={`badge ${d.severity}`}>{d.severity}</span><div className="small" style={{marginTop:5}}>{d.primary_problem}</div></td><td>{money(Number(d.opportunity_score||0))}</td></tr>;
      })}
    </tbody></table></div>
  </>;
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { money, pct } from "@/lib/shopee/number";
import { createClient } from "@/lib/supabase/server";

export default async function ProductDoctor({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: product } = await supabase.from("products").select("*").eq("item_id", itemId).limit(1).maybeSingle();
  if (!product) notFound();
  const { data: diagnosis } = await supabase.from("diagnoses").select("*").eq("product_id", product.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if (!diagnosis) return <div className="empty card" style={{marginTop:30}}><h1>{product.product_name}</h1><p>No diagnosis yet.</p></div>;
  const [{data:metric},{data:ad},{data:run},{data:history}] = await Promise.all([
    supabase.from("product_metrics").select("*").eq("product_id",product.id).eq("import_run_id",diagnosis.import_run_id).maybeSingle(),
    supabase.from("ad_metrics").select("*").eq("product_id",product.id).eq("import_run_id",diagnosis.import_run_id).limit(1).maybeSingle(),
    supabase.from("import_runs").select("period_start,period_end,warnings").eq("id",diagnosis.import_run_id).maybeSingle(),
    supabase.from("diagnoses").select("severity,primary_problem,confidence,opportunity_score,created_at").eq("product_id",product.id).order("created_at",{ascending:false}).limit(6)
  ]);
  const ai = (diagnosis.ai_analysis || {}) as any;
  const evidence = Array.isArray(diagnosis.evidence) ? diagnosis.evidence : [];
  const actions = Array.isArray(diagnosis.actions) ? diagnosis.actions : [];
  const rootCauses = Array.isArray(diagnosis.root_causes) ? diagnosis.root_causes : [];
  return <>
    <div className="hero"><div className="pillRow"><span className={`badge ${diagnosis.severity}`}>{diagnosis.severity}</span><span className={`badge ${ai.confidenceBand||"LOW"}`}>{ai.confidenceBand||"LOW"} CONFIDENCE</span></div><h1 style={{marginTop:12}}>{product.product_name}</h1><p>Item ID {itemId} · {run?.period_start || "?"} → {run?.period_end || "?"}</p></div>
    <div className="grid">
      <div className="card"><div className="muted">CTR</div><div className="metric">{pct(Number(metric?.ctr||0))}</div></div>
      <div className="card"><div className="muted">Add to Cart</div><div className="metric">{pct(Number(metric?.add_to_cart_rate||0))}</div></div>
      <div className="card"><div className="muted">Confirmed Buyer CR</div><div className="metric">{pct(Number(metric?.confirmed_buyer_cr||0))}</div></div>
      <div className="card"><div className="muted">Ads ROAS</div><div className="metric">{ad ? Number(ad.roas||0).toFixed(2) : "—"}</div></div>
    </div>
    <div className="twoCol" style={{marginTop:16}}>
      <div>
        <div className="card"><div className="muted">Primary diagnosis</div><h2>{diagnosis.primary_problem}</h2><p>{ai.summary || "Evidence-based deterministic diagnosis."}</p><div className="muted small">Estimated opportunity: {money(Number(diagnosis.opportunity_score||0))}</div></div>
        <div className="sectionTitle">Recommended actions</div><div className="card">{actions.map((a:any,idx:number)=><div className="action" key={idx}><div className="actionTitle">{a.priority}. {a.action}</div><div className="muted small">Why: {a.reason}</div><div className="small">Watch: <b>{a.metricToWatch}</b></div></div>)}</div>
      </div>
      <div>
        <div className="card"><div className="muted">Evidence</div><ul className="list">{evidence.map((e:string,i:number)=><li key={i}>{e}</li>)}</ul><hr/><div className="muted">Root causes</div>{rootCauses.map((r:any,i:number)=><div key={i} style={{marginTop:9}}><b>{r.code}</b><div className="small muted">{r.evidence}</div></div>)}</div>
        {Array.isArray(ai.doNotChange) && ai.doNotChange.length>0 && <div className="card" style={{marginTop:14}}><div className="muted">Do not change yet</div><ul className="list">{ai.doNotChange.map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></div>}
      </div>
    </div>
    <div className="sectionTitle">Recent diagnosis history</div><div className="card tableWrap"><table><thead><tr><th>Date</th><th>Status</th><th>Problem</th><th>Confidence</th><th>Opportunity</th></tr></thead><tbody>{(history||[]).map((h:any)=><tr key={h.created_at}><td>{new Date(h.created_at).toLocaleString()}</td><td><span className={`badge ${h.severity}`}>{h.severity}</span></td><td>{h.primary_problem}</td><td>{Math.round(Number(h.confidence||0)*100)}%</td><td>{money(Number(h.opportunity_score||0))}</td></tr>)}</tbody></table></div>
    <div style={{marginTop:18}}><Link href="/">← Back to dashboard</Link>{product.product_url && <a href={product.product_url} target="_blank" rel="noreferrer" style={{marginLeft:20}}>Open Shopee listing ↗</a>}</div>
  </>;
}

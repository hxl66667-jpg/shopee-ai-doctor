import Link from "next/link";

const sample = [
  { id: "26551150855", name: "REAIM Grass Cutter 4 Stroke...", ctr: "3.66%", atc: "20.82%", cr: "3.17%", roas: "13.47", status: "SCALE", problem: "Healthy / Scale" },
  { id: "27235224100", name: "REAIM 62CC Chainsaw...", ctr: "3.72%", atc: "—", cr: "1.12%", roas: "—", status: "P0", problem: "Order Completion" },
  { id: "41433263235", name: "REAIM Jetmatic Booster Pump...", ctr: "—", atc: "—", cr: "—", roas: "0.00", status: "P0", problem: "Ads Performance" }
];

export default function Dashboard() {
  return <>
    <div className="hero">
      <h1>REAIM Shopee AI Listing Doctor</h1>
      <div style={{opacity:.75}}>菲律宾 Shopee 全店链接诊断：流量 → 点击 → 加购 → 成交 → 广告 → 改善动作</div>
    </div>
    <div className="sectionTitle">Store Health</div>
    <div className="grid">
      <div className="card"><div className="muted">Listings</div><div className="metric">167</div></div>
      <div className="card"><div className="muted">P0 Problems</div><div className="metric">—</div></div>
      <div className="card"><div className="muted">Scale Candidates</div><div className="metric">—</div></div>
      <div className="card"><div className="muted">Store CTR Median</div><div className="metric">2.91%</div></div>
    </div>
    <div className="sectionTitle">Priority Listings</div>
    <div className="card">
      <table>
        <thead><tr><th>Product</th><th>CTR</th><th>ATC</th><th>Confirmed CR</th><th>Ads ROAS</th><th>Diagnosis</th><th>Priority</th></tr></thead>
        <tbody>{sample.map(p => <tr key={p.id}>
          <td><Link href={`/products/${p.id}`}><b>{p.name}</b><div className="muted">{p.id}</div></Link></td>
          <td>{p.ctr}</td><td>{p.atc}</td><td>{p.cr}</td><td>{p.roas}</td><td>{p.problem}</td><td><span className={`badge ${p.status}`}>{p.status}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}

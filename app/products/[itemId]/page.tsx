export default async function ProductDoctor({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  return <>
    <div className="muted">Item ID {itemId}</div>
    <h1>Product Doctor</h1>
    <div className="grid">
      <div className="card"><div className="muted">CTR</div><div className="metric">—</div></div>
      <div className="card"><div className="muted">Add to Cart</div><div className="metric">—</div></div>
      <div className="card"><div className="muted">Confirmed CR</div><div className="metric">—</div></div>
      <div className="card"><div className="muted">Ads ROAS</div><div className="metric">—</div></div>
    </div>
    <div className="sectionTitle">AI / Rule Diagnosis</div>
    <div className="card">
      <span className="badge WATCH">WAITING FOR IMPORT</span>
      <h2>诊断结果将在数据导入后显示</h2>
      <p className="muted">V1会固定输出：主要问题、严重程度、置信度、证据、优先改善动作。</p>
    </div>
  </>;
}

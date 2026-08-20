# Shopee AI Doctor — Clean Rebuild V2

REAIM / Shopee Philippines 商品链接诊断工具。此分支为从零重构版本，目标是先保证“报表解析 → Item ID 合并 → 动态 Benchmark → 诊断优先级 → 可执行建议”整条链路稳定，再接入持久化与 AI 文案层。

## 当前可用能力

- 输入 Shopee 店铺前台链接作为诊断对象标识
- Product Performance XLSX/XLS/CSV 解析
- 自动排除 Product Performance 的 SKU 明细重复行，优先使用商品汇总行
- Shopee Ads CSV 识别前置元数据并从真实表头开始解析
- Affiliate CSV/XLSX 基础解析
- 按 Item ID 合并商品与广告数据
- 店内动态 Benchmark：P25 / Median / P75
- 六类诊断标签：P0 / P1 / P2 / SCALE / WATCH / DATA
- 基于“流量规模 × 指标缺口”的机会分排序
- 每个商品提供诊断证据与优化动作
- 内置演示数据，无真实报表时也能检查 UI 和诊断流程
- `/api/health` 检查部署与环境变量状态

## 技术栈

- Next.js 16.3.0
- React 19.2.8
- TypeScript
- SheetJS xlsx 0.18.5
- Vercel（部署）
- Supabase（现有数据库后续复用；V2 初版不要求浏览器直接写库）

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 环境变量

复制 `.env.example` 到 `.env.local`：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `OPENAI_API_KEY`（可选，后续 AI 诊断层）

不要把 Supabase `service_role` / secret key 放入 `NEXT_PUBLIC_*`。

## V2 设计原则

1. **真实报表优先**：不凭一个固定 CTR 阈值判断所有类目。
2. **店内 Benchmark**：用当前店铺自身 P25 / Median / P75 做第一层对照。
3. **先看样本量**：小样本进入 WATCH，避免误诊。
4. **按漏斗定位**：曝光→点击→加购→成交→订单确认→广告回报。
5. **先修高损失链接**：高曝光且指标缺口大的链接排在最前。
6. **文件原文默认留在浏览器**：解析先在客户端完成，减少不必要的数据外发。

## 下一阶段

- 将分析结果写入现有 Supabase `import_runs / products / product_metrics / diagnoses` 等表
- 登录与用户级 RLS
- Business Insights / 流量来源报表解析
- 同行链接采集与类目 Benchmark
- OpenAI 结构化“为什么 + 怎么改”增强层
- 优化实验记录与 7–14 天复盘

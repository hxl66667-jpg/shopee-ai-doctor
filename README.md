# Shopee AI Doctor

REAIM / Shopee Philippines 店铺链接诊断工具 V1。

## V1目标

上传 Shopee 原始报表后，自动完成：

1. Product Performance 商品级数据解析（SKU行与商品汇总行分离）
2. Shopee Ads CSV 前言行识别与 Product ID 匹配
3. Affiliate 伙伴级数据解析
4. Item ID 主键合并
5. 店铺内部动态 Benchmark（P25 / Median / P75）
6. 规则诊断：P0 / P1 / P2 / SCALE / WATCH / DATA
7. 后续接入 OpenAI，生成“为什么 + 怎么改”的结构化建议

## 技术栈

- Next.js + TypeScript
- SheetJS (`xlsx`) 解析 Shopee XLSX / CSV
- Supabase (PostgreSQL / Auth / Storage)
- OpenAI API（AI诊断层，第二阶段接入）
- Vercel 部署

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 环境变量

复制 `.env.example` 为 `.env.local`，填写：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

## 当前支持的用户真实报表

- Product Performance XLSX：中文字段版本，核心工作表 `热销商品`
- Business Insights XLSX：后续接入店铺级趋势/来源诊断
- Shopee Ads CSV：支持前7行元数据 + `Sequence,Ad Name,...` 表头格式
- Affiliate CSV：联盟伙伴维度

## 关键数据规则

- Product Performance 中 `规格编号 = -` 才作为商品汇总行进入商品指标，避免SKU重复计算。
- Ads 中 `Product ID = -` 视为店铺级广告，V1不强行分配给某个Item ID。
- 小样本商品进入 WATCH，不因少量点击/订单被误判成P0。
- Benchmark来自店铺自身数据分位数，不使用固定“CTR<3%=差”的粗糙规则。

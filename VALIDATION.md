# V1.1 Validation — 2026-08-18

## Source-level validation

- Strict TypeScript source check passed for the full V1.1 source tree using dependency type stubs.
- Core Shopee modules were compiled with the real TypeScript 5.8.3 compiler and executed against a fixture extracted from the user's real Seller Centre exports.
- A full `npm install` / `next build` could not be run in the ChatGPT container because DNS access to `registry.npmjs.org` is blocked. Vercel must perform the final dependency/build validation after upload.

## Real export acceptance checks

Product Performance:
- Product-level rows (`规格编号 = -`): **167**
- SKU rows: **385**
- Unique product Item IDs: **167**
- SKU rows are excluded from listing-level GMV/funnel aggregation.

Ads:
- Total ad rows: **42**
- Product-specific rows: **31**
- Unique product-specific Item IDs: **28**
- `Product ID = -` store/campaign rows: **11**
- Duplicate item-level ads are aggregated by summing measures and recalculating CTR/CR/ROAS/ACOS.

Affiliate:
- Partner rows: **276**
- No Item ID exists in the export, so V1.1 stores Affiliate at partner/store level only.

Business Insights:
- Period: **2026-08-11 → 2026-08-17**
- Placed/confirmed/paid store summaries parse successfully.
- Traffic-source sections parse across all three stages.
- Product-source context contains **11 unique Item IDs** across stages.

Period quality:
- Ads period: **2026-08-12 → 2026-08-18**
- BI period: **2026-08-11 → 2026-08-17**
- V1.1 raises a `PERIOD_MISMATCH` warning and treats cross-channel comparison as directional.

## Recalculated store benchmarks from the real Product Performance file

- CTR: P25 **2.21%**, median **2.91%**, P75 **3.51%**
- Bounce: P25 **16.67%**, median **19.44%**, P75 **23.14%**
- Add-to-cart: P25 **12.73%**, median **17.10%**, P75 **21.14%**
- Placed buyer CR: P25 **1.85%**, median **2.61%**, P75 **3.49%**
- Confirmed buyer CR: P25 **1.73%**, median **2.38%**, P75 **3.31%**
- Confirmation ratio: P25 **89.52%**, median **92.26%**, P75 **100%**
- Ads CTR median: **2.84%**
- Ads CR median: **3.76%**
- Ads ROAS median: **9.92**

## Known-item regression checks

`27235224100`
- CTR 4.22%, bounce 12.80%, ATC 30.89%, confirmed buyer CR 5.94%, confirmation 91.93%
- Aggregated Ads ROAS ~9.92
- Expected V1.1 diagnosis: **SCALE — Healthy funnel / scale candidate**
- Result: **PASS**

`41433263235`
- Ads: 71 clicks, ₱334.15 spend, 0 conversions, ROAS 0
- Expected V1.1 diagnosis: **P0 — Advertising spend without conversions**
- Result: **PASS**

`47113344171`
- Exported buyer conversion rates exceed 100%
- Expected V1.1 diagnosis: **DATA — Data quality anomaly**
- Result: **PASS**

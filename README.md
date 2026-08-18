# Shopee AI Listing Doctor V1.1

V1.1 closes the first usable loop for Shopee Philippines listing diagnosis:

1. Supabase email/password authentication.
2. Upload raw Product Performance, Business Insights, Ads and Affiliate exports.
3. Separate product-level rows from SKU rows to avoid double-counting.
4. Parse Ads metadata and keep `Product ID = -` rows at store/campaign level.
5. Aggregate duplicate item-level ad rows and recalculate rates from numerators.
6. Parse Business Insights store funnel, traffic sources and source/product context.
7. Detect report-period mismatch and data anomalies.
8. Recalculate store-specific benchmark quartiles on every import.
9. Produce deterministic P0/P1/P2/SCALE/WATCH/DATA diagnosis with evidence/actions.
10. Persist import history, metrics and diagnosis to Supabase under RLS.
11. Render a real dashboard and per-product doctor page from the latest import.

## Vercel environment variables

Set these for Production and Preview:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The publishable key is intentionally safe for browser use when RLS is enabled. Do not put a Supabase secret/service-role key in the browser.

## Build

```bash
npm install
npm run typecheck
npm run build
```

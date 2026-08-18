Shopee AI Doctor V1.1 Hotfix 1

Replace these two files in GitHub main branch:
- lib/supabase/server.ts
- lib/supabase/middleware.ts

This removes over-broad manual cookie option typings and lets @supabase/ssr infer the correct cookie types used by Next.js.
After committing, return to Vercel and Redeploy the latest main deployment.

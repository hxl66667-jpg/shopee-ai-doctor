# Deploy V1.1

1. Replace the contents of GitHub branch `agent/v1-foundation` with this package (do not upload the Shopee report files).
2. In Vercel, ensure the project deploys from `agent/v1-foundation` for Preview testing.
3. Add these environment variables to Vercel Preview + Production:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Redeploy.
5. Open `/login`, create the first account, then upload the four Shopee exports on `/import`.
6. If email confirmation redirects incorrectly, add the Vercel deployment URL to Supabase Auth redirect URLs, then retry signup.

Do not add a Supabase service-role/secret key to client-side environment variables.

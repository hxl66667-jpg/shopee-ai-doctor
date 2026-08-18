-- Shopee AI Listing Doctor V1.1 reference schema.
-- The connected production Supabase project was migrated separately and has RLS enabled.
-- Keep this file as a repository snapshot; use versioned migrations for future production changes.

create extension if not exists pgcrypto;

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id),
  name text,
  shop_url text not null unique,
  shopee_shop_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_runs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  period_start date,
  period_end date,
  source_periods jsonb not null default '{}'::jsonb,
  source_files jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  product_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  item_id text not null,
  product_name text not null,
  product_url text,
  status text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(shop_id,item_id)
);

create table if not exists public.product_metrics (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references public.import_runs(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  impressions bigint not null default 0, clicks bigint not null default 0, ctr numeric not null default 0,
  unique_impressions bigint not null default 0, unique_clicks bigint not null default 0,
  visitors bigint not null default 0, page_visitors bigint not null default 0, search_clicks bigint not null default 0,
  bounce_visitors bigint not null default 0, bounce_rate numeric not null default 0, likes bigint not null default 0,
  add_to_cart_visitors bigint not null default 0, add_to_cart_items bigint not null default 0, add_to_cart_rate numeric not null default 0,
  placed_orders bigint not null default 0, confirmed_orders bigint not null default 0,
  placed_buyers bigint not null default 0, confirmed_buyers bigint not null default 0,
  placed_buyer_cr numeric not null default 0, confirmed_buyer_cr numeric not null default 0,
  placed_sales numeric not null default 0, confirmed_sales numeric not null default 0,
  order_confirm_rate numeric not null default 0, repeat_order_rate numeric, repeat_order_days numeric,
  raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  unique(import_run_id,product_id)
);

create table if not exists public.sku_metrics (
  id uuid primary key default gen_random_uuid(), import_run_id uuid not null references public.import_runs(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade, sku_id text not null, sku_name text,
  impressions bigint not null default 0, clicks bigint not null default 0, visitors bigint not null default 0,
  add_to_cart_visitors bigint not null default 0, placed_orders bigint not null default 0, confirmed_orders bigint not null default 0,
  placed_sales numeric not null default 0, confirmed_sales numeric not null default 0,
  raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.business_insights_store (
  id uuid primary key default gen_random_uuid(), import_run_id uuid not null unique references public.import_runs(id) on delete cascade,
  placed_sales numeric not null default 0, placed_orders bigint not null default 0, product_clicks bigint not null default 0,
  visitors bigint not null default 0, placed_conversion numeric not null default 0,
  paid_sales numeric not null default 0, paid_orders bigint not null default 0, paid_conversion numeric not null default 0,
  raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.traffic_source_metrics (
  id uuid primary key default gen_random_uuid(), import_run_id uuid not null references public.import_runs(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade, source text not null,
  impressions bigint not null default 0, clicks bigint not null default 0, visitors bigint not null default 0,
  orders bigint not null default 0, buyers bigint not null default 0, gmv numeric not null default 0,
  conversion_rate numeric not null default 0, raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.ad_metrics (
  id uuid primary key default gen_random_uuid(), import_run_id uuid not null references public.import_runs(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade, ad_name text,
  impressions bigint not null default 0, clicks bigint not null default 0, ctr numeric not null default 0,
  add_to_cart bigint not null default 0, add_to_cart_rate numeric not null default 0,
  conversions bigint not null default 0, conversion_rate numeric not null default 0,
  gmv numeric not null default 0, expense numeric not null default 0, roas numeric not null default 0, acos numeric not null default 0,
  raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.store_ad_metrics (
  id uuid primary key default gen_random_uuid(), import_run_id uuid not null references public.import_runs(id) on delete cascade,
  ad_name text, impressions bigint not null default 0, clicks bigint not null default 0, ctr numeric not null default 0,
  conversions bigint not null default 0, conversion_rate numeric not null default 0,
  gmv numeric not null default 0, expense numeric not null default 0, roas numeric not null default 0, acos numeric not null default 0,
  raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.affiliate_partners (
  id uuid primary key default gen_random_uuid(), shop_id uuid not null references public.shops(id) on delete cascade,
  partner_id text not null, partner_name text, username text, created_at timestamptz not null default now(), unique(shop_id,partner_id)
);

create table if not exists public.affiliate_metrics (
  id uuid primary key default gen_random_uuid(), import_run_id uuid not null references public.import_runs(id) on delete cascade,
  partner_id uuid not null references public.affiliate_partners(id) on delete cascade, product_id uuid references public.products(id),
  gmv numeric not null default 0, orders bigint not null default 0, clicks bigint not null default 0, commission numeric not null default 0,
  roi numeric not null default 0, buyers bigint not null default 0, new_buyers bigint not null default 0,
  raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.benchmarks (
  id uuid primary key default gen_random_uuid(), import_run_id uuid not null unique references public.import_runs(id) on delete cascade,
  product_benchmarks jsonb not null default '{}'::jsonb, ad_benchmarks jsonb not null default '{}'::jsonb,
  cohort_metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.diagnoses (
  id uuid primary key default gen_random_uuid(), import_run_id uuid not null references public.import_runs(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade, primary_problem text not null,
  severity text not null check (severity in ('P0','P1','P2','SCALE','WATCH','DATA')),
  confidence numeric not null default 0 check(confidence between 0 and 1), opportunity_score numeric not null default 0,
  root_causes jsonb not null default '[]'::jsonb, evidence jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb, ai_analysis jsonb, created_at timestamptz not null default now(),
  unique(import_run_id,product_id)
);

create table if not exists public.optimization_tests (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  baseline_import_run_id uuid references public.import_runs(id), followup_import_run_id uuid references public.import_runs(id),
  change_type text not null, change_summary text, metric_to_watch text, baseline_value numeric, followup_value numeric,
  result text check(result is null or result in ('improved','flat','worse','pending')), notes text, created_at timestamptz not null default now()
);

-- Production RLS policies are already applied in Supabase and use private ownership helper functions.
-- Do not disable RLS when using the public/publishable API key.

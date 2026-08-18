create extension if not exists pgcrypto;

create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  name text,
  shop_url text not null,
  shopee_shop_id text,
  created_at timestamptz not null default now()
);

create table if not exists import_runs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) on delete cascade,
  period_start date,
  period_end date,
  source_files jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) on delete cascade,
  item_id text not null,
  product_name text not null,
  product_url text,
  status text,
  created_at timestamptz not null default now(),
  unique(shop_id, item_id)
);

create table if not exists product_metrics (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid references import_runs(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  impressions bigint default 0,
  clicks bigint default 0,
  ctr numeric default 0,
  visitors bigint default 0,
  page_visitors bigint default 0,
  bounce_rate numeric default 0,
  add_to_cart_visitors bigint default 0,
  add_to_cart_rate numeric default 0,
  placed_orders bigint default 0,
  confirmed_orders bigint default 0,
  placed_buyer_cr numeric default 0,
  confirmed_buyer_cr numeric default 0,
  placed_sales numeric default 0,
  confirmed_sales numeric default 0,
  order_confirm_rate numeric default 0
);

create table if not exists ad_metrics (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid references import_runs(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  impressions bigint default 0,
  clicks bigint default 0,
  ctr numeric default 0,
  conversions bigint default 0,
  conversion_rate numeric default 0,
  gmv numeric default 0,
  expense numeric default 0,
  roas numeric default 0,
  acos numeric default 0
);

create table if not exists diagnoses (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid references import_runs(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  primary_problem text not null,
  severity text not null,
  confidence numeric not null,
  evidence jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  ai_analysis jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_products_item_id on products(item_id);
create index if not exists idx_diagnoses_product on diagnoses(product_id, created_at desc);

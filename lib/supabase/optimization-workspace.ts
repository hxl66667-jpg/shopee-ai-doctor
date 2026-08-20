import { getSupabaseBrowserClient } from "./client";
import type { OptimizationMetric, OptimizationResult, OptimizationTestRow } from "./optimization";

export interface LatestDiagnosisOption {
  runId: string;
  runCreatedAt: string;
  shopUrl: string;
  productId: string;
  itemId: string;
  productName: string;
  severity: string;
  primaryProblem: string;
  ctr: number;
  addToCartRate: number;
  conversionRate: number;
  roas: number | null;
}

export interface OptimizationWorkspaceData {
  latestRunId: string | null;
  latestRunCreatedAt: string | null;
  shopUrl: string | null;
  options: LatestDiagnosisOption[];
  tests: OptimizationTestRow[];
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function resultFor(baseline: number, followup: number, metric: OptimizationMetric): OptimizationResult {
  const floor = metric === "roas" ? 0.1 : 0.001;
  const tolerance = Math.max(Math.abs(baseline) * 0.05, floor);
  if (followup > baseline + tolerance) return "improved";
  if (followup < baseline - tolerance) return "worse";
  return "flat";
}

function valueFor(option: LatestDiagnosisOption, metric: OptimizationMetric): number | null {
  if (metric === "ctr") return option.ctr;
  if (metric === "add_to_cart_rate") return option.addToCartRate;
  if (metric === "conversion_rate") return option.conversionRate;
  if (metric === "roas") return option.roas;
  return null;
}

async function readLatestOptions(): Promise<{ runId: string; createdAt: string; shopId: string; shopUrl: string; options: LatestDiagnosisOption[] } | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  const { data: run, error: runError } = await supabase
    .from("import_runs")
    .select("id,shop_id,created_at,shops(shop_url)")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runError) throw runError;
  if (!run) return null;

  const shop = relationOne(run.shops as { shop_url?: string } | Array<{ shop_url?: string }> | null);
  const shopUrl = String(shop?.shop_url ?? "");
  const runId = String(run.id);
  const shopId = String(run.shop_id);

  const [diagnosesResult, metricsResult, adsResult] = await Promise.all([
    supabase
      .from("diagnoses")
      .select("product_id,severity,primary_problem,opportunity_score,products(item_id,product_name)")
      .eq("import_run_id", runId),
    supabase
      .from("product_metrics")
      .select("product_id,ctr,add_to_cart_rate,placed_buyer_cr,confirmed_buyer_cr")
      .eq("import_run_id", runId),
    supabase
      .from("ad_metrics")
      .select("product_id,gmv,expense")
      .eq("import_run_id", runId),
  ]);
  if (diagnosesResult.error) throw diagnosesResult.error;
  if (metricsResult.error) throw metricsResult.error;
  if (adsResult.error) throw adsResult.error;

  const metricMap = new Map((metricsResult.data ?? []).map((row) => [String(row.product_id), row]));
  const adAgg = new Map<string, { gmv: number; expense: number }>();
  for (const row of adsResult.data ?? []) {
    const key = String(row.product_id);
    const current = adAgg.get(key) ?? { gmv: 0, expense: 0 };
    current.gmv += Number(row.gmv ?? 0);
    current.expense += Number(row.expense ?? 0);
    adAgg.set(key, current);
  }

  const options: LatestDiagnosisOption[] = (diagnosesResult.data ?? []).map((row) => {
    const productId = String(row.product_id);
    const product = relationOne(row.products as { item_id?: string; product_name?: string } | Array<{ item_id?: string; product_name?: string }> | null);
    const metric = metricMap.get(productId);
    const ad = adAgg.get(productId);
    return {
      runId,
      runCreatedAt: String(run.created_at),
      shopUrl,
      productId,
      itemId: String(product?.item_id ?? ""),
      productName: String(product?.product_name ?? "Unknown product"),
      severity: String(row.severity ?? ""),
      primaryProblem: String(row.primary_problem ?? ""),
      ctr: Number(metric?.ctr ?? 0),
      addToCartRate: Number(metric?.add_to_cart_rate ?? 0),
      conversionRate: Number(metric?.confirmed_buyer_cr || metric?.placed_buyer_cr || 0),
      roas: ad && ad.expense > 0 ? ad.gmv / ad.expense : null,
    };
  });

  return { runId, createdAt: String(run.created_at), shopId, shopUrl, options };
}

async function settleFromLatest(options: LatestDiagnosisOption[], runId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !options.length) return;

  const optionByProduct = new Map(options.map((row) => [row.productId, row]));
  const { data: pending, error } = await supabase
    .from("optimization_tests")
    .select("id,product_id,baseline_import_run_id,metric_to_watch,baseline_value")
    .in("product_id", options.map((row) => row.productId))
    .eq("result", "pending")
    .is("followup_import_run_id", null);
  if (error) throw error;

  await Promise.all((pending ?? []).map(async (test) => {
    if (String(test.baseline_import_run_id || "") === runId) return;
    const option = optionByProduct.get(String(test.product_id));
    const metric = String(test.metric_to_watch || "ctr") as OptimizationMetric;
    const baseline = Number(test.baseline_value);
    const followup = option ? valueFor(option, metric) : null;
    if (!option || followup === null || !Number.isFinite(baseline) || !Number.isFinite(followup)) return;

    const { error: updateError } = await supabase
      .from("optimization_tests")
      .update({
        followup_import_run_id: runId,
        followup_value: followup,
        result: resultFor(baseline, followup, metric),
      })
      .eq("id", test.id)
      .is("followup_import_run_id", null);
    if (updateError) throw updateError;
  }));
}

async function readTests(shopId: string): Promise<OptimizationTestRow[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("shop_id", shopId);
  if (productError) throw productError;
  const ids = (products ?? []).map((row) => String(row.id));
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("optimization_tests")
    .select("id,change_type,change_summary,metric_to_watch,baseline_value,followup_value,result,created_at,products(item_id,product_name)")
    .in("product_id", ids)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const product = relationOne(row.products as { item_id?: string; product_name?: string } | Array<{ item_id?: string; product_name?: string }> | null);
    return {
      id: String(row.id),
      itemId: String(product?.item_id ?? ""),
      productName: String(product?.product_name ?? "Unknown product"),
      changeType: String(row.change_type ?? "other"),
      changeSummary: String(row.change_summary ?? ""),
      metricToWatch: String(row.metric_to_watch ?? "ctr") as OptimizationMetric,
      baselineValue: row.baseline_value === null ? null : Number(row.baseline_value),
      followupValue: row.followup_value === null ? null : Number(row.followup_value),
      result: String(row.result ?? "pending") as OptimizationResult,
      createdAt: String(row.created_at),
    };
  });
}

export async function loadOptimizationWorkspace(): Promise<OptimizationWorkspaceData> {
  const latest = await readLatestOptions();
  if (!latest) return { latestRunId: null, latestRunCreatedAt: null, shopUrl: null, options: [], tests: [] };

  await settleFromLatest(latest.options, latest.runId);
  const tests = await readTests(latest.shopId);
  return {
    latestRunId: latest.runId,
    latestRunCreatedAt: latest.createdAt,
    shopUrl: latest.shopUrl,
    options: latest.options,
    tests,
  };
}

export async function createWorkspaceOptimizationTest(input: {
  option: LatestDiagnosisOption;
  changeType: string;
  changeSummary: string;
  metricToWatch: OptimizationMetric;
}): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase 尚未配置。 ");
  const baselineValue = valueFor(input.option, input.metricToWatch);
  if (baselineValue === null) throw new Error("当前报表没有该指标，不能建立跟踪。 ");

  const { data, error } = await supabase
    .from("optimization_tests")
    .insert({
      product_id: input.option.productId,
      baseline_import_run_id: input.option.runId,
      followup_import_run_id: null,
      change_type: input.changeType,
      change_summary: input.changeSummary,
      metric_to_watch: input.metricToWatch,
      baseline_value: baselineValue,
      followup_value: null,
      result: "pending",
      notes: null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

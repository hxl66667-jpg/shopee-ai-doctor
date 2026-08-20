import type { AnalysisResult } from "@/lib/shopee/types";
import { getSupabaseBrowserClient } from "./client";

export type OptimizationMetric = "ctr" | "add_to_cart_rate" | "conversion_rate" | "roas";
export type OptimizationResult = "pending" | "improved" | "flat" | "worse";

export interface OptimizationTestRow {
  id: string;
  itemId: string;
  productName: string;
  changeType: string;
  changeSummary: string;
  metricToWatch: OptimizationMetric;
  baselineValue: number | null;
  followupValue: number | null;
  result: OptimizationResult;
  createdAt: string;
}

export interface CreateOptimizationTestInput {
  importRunId: string;
  itemId: string;
  changeType: string;
  changeSummary: string;
  metricToWatch: OptimizationMetric;
  baselineValue: number;
}

function getMetricValue(analysis: AnalysisResult, itemId: string, metric: OptimizationMetric): number | null {
  const diagnosis = analysis.diagnoses.find((row) => row.itemId === itemId);
  if (!diagnosis) return null;
  if (metric === "ctr") return diagnosis.row.ctr;
  if (metric === "add_to_cart_rate") return diagnosis.row.addToCartRate;
  if (metric === "conversion_rate") return diagnosis.row.confirmedBuyerCr || diagnosis.row.placedBuyerCr;
  if (metric === "roas") return diagnosis.row.ad?.roas ?? null;
  return null;
}

function compareMetric(baseline: number, followup: number, metric: OptimizationMetric): OptimizationResult {
  const floor = metric === "roas" ? 0.1 : 0.001;
  const tolerance = Math.max(Math.abs(baseline) * 0.05, floor);
  if (followup > baseline + tolerance) return "improved";
  if (followup < baseline - tolerance) return "worse";
  return "flat";
}

export async function createOptimizationTest(input: CreateOptimizationTestInput): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase 尚未配置。 ");

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("请先登录。 ");

  const { data: diagnosis, error: diagnosisError } = await supabase
    .from("diagnoses")
    .select("product_id,products!inner(item_id)")
    .eq("import_run_id", input.importRunId)
    .eq("products.item_id", input.itemId)
    .single();
  if (diagnosisError || !diagnosis) throw diagnosisError || new Error("找不到已保存的商品诊断。 ");

  const { data, error } = await supabase
    .from("optimization_tests")
    .insert({
      product_id: diagnosis.product_id,
      baseline_import_run_id: input.importRunId,
      followup_import_run_id: null,
      change_type: input.changeType,
      change_summary: input.changeSummary,
      metric_to_watch: input.metricToWatch,
      baseline_value: input.baselineValue,
      followup_value: null,
      result: "pending",
      notes: null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

export async function settlePendingOptimizationTests(args: {
  importRunId: string;
  analysis: AnalysisResult;
  productMap: Map<string, string>;
}): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !args.productMap.size) return;

  const productIds = Array.from(args.productMap.values());
  const reverseMap = new Map(Array.from(args.productMap.entries()).map(([itemId, productId]) => [productId, itemId]));

  const { data: tests, error } = await supabase
    .from("optimization_tests")
    .select("id,product_id,baseline_import_run_id,metric_to_watch,baseline_value")
    .in("product_id", productIds)
    .is("followup_import_run_id", null)
    .eq("result", "pending");
  if (error) throw error;
  if (!tests?.length) return;

  await Promise.all(tests.map(async (test) => {
    if (String(test.baseline_import_run_id || "") === args.importRunId) return;
    const itemId = reverseMap.get(String(test.product_id));
    const metric = String(test.metric_to_watch || "") as OptimizationMetric;
    const baseline = Number(test.baseline_value);
    if (!itemId || !Number.isFinite(baseline)) return;

    const followup = getMetricValue(args.analysis, itemId, metric);
    if (followup === null || !Number.isFinite(followup)) return;

    const result = compareMetric(baseline, followup, metric);
    const { error: updateError } = await supabase
      .from("optimization_tests")
      .update({
        followup_import_run_id: args.importRunId,
        followup_value: followup,
        result,
      })
      .eq("id", test.id)
      .is("followup_import_run_id", null);
    if (updateError) throw updateError;
  }));
}

export async function loadOptimizationTests(shopUrl: string): Promise<OptimizationTestRow[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !shopUrl) return [];

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("id")
    .eq("shop_url", shopUrl)
    .maybeSingle();
  if (shopError) throw shopError;
  if (!shop) return [];

  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("shop_id", shop.id);
  if (productError) throw productError;
  const productIds = (products ?? []).map((row) => String(row.id));
  if (!productIds.length) return [];

  const { data, error } = await supabase
    .from("optimization_tests")
    .select("id,change_type,change_summary,metric_to_watch,baseline_value,followup_value,result,created_at,products(item_id,product_name)")
    .in("product_id", productIds)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const relation = Array.isArray(row.products) ? row.products[0] : row.products;
    return {
      id: String(row.id),
      itemId: String(relation?.item_id ?? ""),
      productName: String(relation?.product_name ?? "Unknown product"),
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

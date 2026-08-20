import type { AnalysisResult, AdMetric, AffiliateMetric, ProductMetric, Severity } from "@/lib/shopee/types";
import { safeDivide } from "@/lib/shopee/number";
import { getSupabaseBrowserClient } from "./client";

export interface SaveAnalysisInput {
  shopUrl: string;
  products: ProductMetric[];
  ads: AdMetric[];
  affiliate: AffiliateMetric[];
  analysis: AnalysisResult;
  sourceFiles: {
    product?: string;
    ads?: string;
    affiliate?: string;
  };
}

export interface RecentRun {
  id: string;
  status: "processing" | "completed" | "failed";
  productCount: number;
  createdAt: string;
  p0: number;
  p1: number;
  scale: number;
  warnings: string[];
}

function shopNameFromUrl(shopUrl: string): string {
  try {
    const url = new URL(shopUrl);
    const segment = url.pathname.split("/").filter(Boolean)[0];
    return segment || url.hostname;
  } catch {
    return "Shopee Shop";
  }
}

function assertRows<T>(rows: T[] | null, label: string): T[] {
  if (!rows?.length) throw new Error(`${label} 写入后没有返回数据。`);
  return rows;
}

export async function saveAnalysis(input: SaveAnalysisInput): Promise<{ importRunId: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase 尚未配置。诊断结果只保留在当前浏览器页面。 ");

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const user = authData.user;
  if (!user) throw new Error("请先登录，再保存诊断记录。 ");

  const now = new Date().toISOString();
  let importRunId = "";

  try {
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .upsert(
        {
          owner_user_id: user.id,
          name: shopNameFromUrl(input.shopUrl),
          shop_url: input.shopUrl,
          updated_at: now,
        },
        { onConflict: "shop_url" },
      )
      .select("id")
      .single();
    if (shopError) throw shopError;

    const { data: importRun, error: importError } = await supabase
      .from("import_runs")
      .insert({
        shop_id: shop.id,
        source_periods: {},
        source_files: input.sourceFiles,
        warnings: input.analysis.warnings,
        status: "processing",
        product_count: input.products.length,
      })
      .select("id")
      .single();
    if (importError) throw importError;
    importRunId = importRun.id;

    const { data: productRows, error: productError } = await supabase
      .from("products")
      .upsert(
        input.products.map((row) => ({
          shop_id: shop.id,
          item_id: row.itemId,
          product_name: row.productName,
          status: row.status || null,
          last_seen_at: now,
        })),
        { onConflict: "shop_id,item_id" },
      )
      .select("id,item_id");
    if (productError) throw productError;

    const productMap = new Map(assertRows(productRows, "商品").map((row) => [String(row.item_id), String(row.id)]));

    const productMetricRows = input.products.flatMap((row) => {
      const productId = productMap.get(row.itemId);
      if (!productId) return [];
      return [{
        import_run_id: importRunId,
        product_id: productId,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.ctr,
        visitors: row.visitors,
        add_to_cart_visitors: row.addToCartVisitors,
        add_to_cart_rate: row.addToCartRate,
        placed_orders: row.placedOrders,
        confirmed_orders: row.confirmedOrders,
        placed_buyer_cr: row.placedBuyerCr,
        confirmed_buyer_cr: row.confirmedBuyerCr,
        placed_sales: row.placedSales,
        confirmed_sales: row.confirmedSales,
        order_confirm_rate: safeDivide(row.confirmedOrders, row.placedOrders),
        raw_payload: row,
      }];
    });

    if (productMetricRows.length) {
      const { error } = await supabase
        .from("product_metrics")
        .upsert(productMetricRows, { onConflict: "import_run_id,product_id" });
      if (error) throw error;
    }

    const adRows = input.ads.flatMap((row) => {
      const productId = productMap.get(row.itemId);
      if (!productId) return [];
      return [{
        import_run_id: importRunId,
        product_id: productId,
        ad_name: row.adName || null,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.ctr,
        add_to_cart: row.addToCart,
        add_to_cart_rate: row.addToCartRate,
        conversions: row.conversions,
        conversion_rate: row.conversionRate,
        gmv: row.gmv,
        expense: row.expense,
        roas: row.roas,
        acos: row.acos,
        raw_payload: row,
      }];
    });
    if (adRows.length) {
      const { error } = await supabase.from("ad_metrics").insert(adRows);
      if (error) throw error;
    }

    if (input.affiliate.length) {
      const uniquePartners = Array.from(new Map(input.affiliate.map((row) => [row.partnerId, row])).values());
      const { data: partnerRows, error: partnerError } = await supabase
        .from("affiliate_partners")
        .upsert(
          uniquePartners.map((row) => ({
            shop_id: shop.id,
            partner_id: row.partnerId,
            partner_name: row.partnerName || null,
            username: null,
          })),
          { onConflict: "shop_id,partner_id" },
        )
        .select("id,partner_id");
      if (partnerError) throw partnerError;

      const partnerMap = new Map(assertRows(partnerRows, "联盟伙伴").map((row) => [String(row.partner_id), String(row.id)]));
      const affiliateRows = input.affiliate.flatMap((row) => {
        const partnerId = partnerMap.get(row.partnerId);
        if (!partnerId) return [];
        return [{
          import_run_id: importRunId,
          partner_id: partnerId,
          product_id: row.itemId ? productMap.get(row.itemId) || null : null,
          gmv: row.gmv,
          orders: row.orders,
          clicks: row.clicks,
          commission: row.commission,
          roi: row.roi,
          buyers: 0,
          new_buyers: 0,
          raw_payload: row,
        }];
      });
      if (affiliateRows.length) {
        const { error } = await supabase.from("affiliate_metrics").insert(affiliateRows);
        if (error) throw error;
      }
    }

    const { error: benchmarkError } = await supabase
      .from("benchmarks")
      .upsert(
        {
          import_run_id: importRunId,
          product_benchmarks: input.analysis.benchmarks,
          ad_benchmarks: { roas: input.analysis.benchmarks.roas },
          cohort_metadata: {
            product_count: input.products.length,
            ad_rows: input.ads.length,
            affiliate_rows: input.affiliate.length,
          },
        },
        { onConflict: "import_run_id" },
      );
    if (benchmarkError) throw benchmarkError;

    const diagnosisRows = input.analysis.diagnoses.flatMap((item) => {
      const productId = productMap.get(item.itemId);
      if (!productId) return [];
      return [{
        import_run_id: importRunId,
        product_id: productId,
        primary_problem: item.primaryProblem,
        severity: item.severity,
        confidence: item.confidence,
        opportunity_score: item.opportunityScore,
        root_causes: [item.primaryProblem],
        evidence: item.evidence,
        actions: item.actions,
        ai_analysis: null,
      }];
    });
    if (diagnosisRows.length) {
      const { error } = await supabase
        .from("diagnoses")
        .upsert(diagnosisRows, { onConflict: "import_run_id,product_id" });
      if (error) throw error;
    }

    const { error: completeError } = await supabase
      .from("import_runs")
      .update({ status: "completed", product_count: input.products.length, warnings: input.analysis.warnings })
      .eq("id", importRunId);
    if (completeError) throw completeError;

    return { importRunId };
  } catch (error) {
    if (importRunId) {
      await supabase
        .from("import_runs")
        .update({ status: "failed" })
        .eq("id", importRunId);
    }
    throw error;
  }
}

export async function loadRecentRuns(shopUrl: string): Promise<RecentRun[]> {
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

  const { data, error } = await supabase
    .from("import_runs")
    .select("id,status,product_count,created_at,warnings,diagnoses(severity,opportunity_score)")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw error;

  return (data ?? []).map((run) => {
    const diagnoses = (run.diagnoses ?? []) as Array<{ severity: Severity; opportunity_score: number }>;
    return {
      id: String(run.id),
      status: run.status as RecentRun["status"],
      productCount: Number(run.product_count ?? 0),
      createdAt: String(run.created_at),
      p0: diagnoses.filter((row) => row.severity === "P0").length,
      p1: diagnoses.filter((row) => row.severity === "P1").length,
      scale: diagnoses.filter((row) => row.severity === "SCALE").length,
      warnings: Array.isArray(run.warnings) ? run.warnings.map(String) : [],
    };
  });
}

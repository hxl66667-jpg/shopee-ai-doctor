import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateAds } from "./master-table";
import type {
  AdsReport,
  AffiliateMetric,
  Benchmarks,
  BusinessInsightsReport,
  DataWarning,
  MasterProduct,
  ProductPerformanceReport
} from "./types";

type PersistInput = {
  supabase: SupabaseClient;
  userId: string;
  shopUrl: string;
  productReport: ProductPerformanceReport;
  ads?: AdsReport;
  affiliates: AffiliateMetric[];
  business?: BusinessInsightsReport;
  master: MasterProduct[];
  benchmarks: Benchmarks;
  warnings: DataWarning[];
  files: Record<string, string | null>;
};

function fail(error: { message?: string } | null, context: string): never {
  throw new Error(`${context}: ${error?.message || "unknown database error"}`);
}

export async function persistAnalysis(input: PersistInput): Promise<{ importRunId: string; shopId: string }> {
  const { supabase } = input;
  const shopName = input.ads?.meta.shopName || "Shopee Store";
  const shopeeShopId = input.ads?.meta.shopId || null;

  let { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("id, shop_url, shopee_shop_id, name")
    .eq("shop_url", input.shopUrl)
    .maybeSingle();
  if (shopError) fail(shopError, "Read shop");

  if (!shop) {
    const inserted = await supabase
      .from("shops")
      .insert({ owner_user_id: input.userId, name: shopName, shop_url: input.shopUrl, shopee_shop_id: shopeeShopId })
      .select("id, shop_url, shopee_shop_id, name")
      .single();
    if (inserted.error) fail(inserted.error, "Create shop");
    shop = inserted.data;
  } else {
    const update = await supabase
      .from("shops")
      .update({ name: shopName, shopee_shop_id: shopeeShopId, updated_at: new Date().toISOString() })
      .eq("id", shop.id);
    if (update.error) fail(update.error, "Update shop");
  }

  const primaryPeriod = input.business?.period || input.ads?.meta.period;
  const importInsert = await supabase
    .from("import_runs")
    .insert({
      shop_id: shop.id,
      period_start: primaryPeriod?.start || null,
      period_end: primaryPeriod?.end || null,
      source_periods: {
        businessInsights: input.business?.period || null,
        ads: input.ads?.meta.period || null
      },
      source_files: input.files,
      warnings: input.warnings,
      status: "processing",
      product_count: input.master.length
    })
    .select("id")
    .single();
  if (importInsert.error) fail(importInsert.error, "Create import run");
  const importRunId = importInsert.data.id as string;

  try {
    const productPayload = input.master.map((p) => ({
      shop_id: shop.id,
      item_id: p.itemId,
      product_name: p.productName,
      product_url: p.productUrl || null,
      status: p.status || null,
      last_seen_at: new Date().toISOString()
    }));
    const productUpsert = await supabase
      .from("products")
      .upsert(productPayload, { onConflict: "shop_id,item_id" })
      .select("id,item_id");
    if (productUpsert.error) fail(productUpsert.error, "Upsert products");
    const productIdMap = new Map<string, string>((productUpsert.data || []).map((row: any) => [String(row.item_id), String(row.id)]));

    const productMetricRows = input.master.map((p) => ({
      import_run_id: importRunId,
      product_id: productIdMap.get(p.itemId),
      impressions: p.impressions,
      clicks: p.clicks,
      ctr: p.ctr,
      unique_impressions: p.uniqueImpressions,
      unique_clicks: p.uniqueClicks,
      visitors: p.visitors,
      page_visitors: p.pageVisitors,
      search_clicks: p.searchClicks,
      bounce_visitors: p.bounceVisitors,
      bounce_rate: p.bounceRate,
      likes: p.likes,
      add_to_cart_visitors: p.addToCartVisitors,
      add_to_cart_items: p.addToCartItems,
      add_to_cart_rate: p.addToCartRate,
      placed_orders: p.placedOrders,
      confirmed_orders: p.confirmedOrders,
      placed_buyers: p.placedBuyers,
      confirmed_buyers: p.confirmedBuyers,
      placed_buyer_cr: p.placedBuyerCr,
      confirmed_buyer_cr: p.confirmedBuyerCr,
      placed_sales: p.placedSales,
      confirmed_sales: p.confirmedSales,
      order_confirm_rate: p.orderConfirmRate,
      repeat_order_rate: p.repeatConfirmedRate ?? null,
      repeat_order_days: p.repeatConfirmedDays ?? null,
      raw_payload: {
        placedOrderCr: p.placedOrderCr,
        confirmedOrderCr: p.confirmedOrderCr,
        placedItems: p.placedItems,
        confirmedItems: p.confirmedItems,
        repeatPlacedRate: p.repeatPlacedRate,
        repeatConfirmedRate: p.repeatConfirmedRate,
        repeatPlacedDays: p.repeatPlacedDays,
        repeatConfirmedDays: p.repeatConfirmedDays,
        source: p.raw || {}
      }
    }));
    if (productMetricRows.some((r) => !r.product_id)) throw new Error("One or more product IDs could not be mapped after upsert.");
    const productMetricsWrite = await supabase.from("product_metrics").insert(productMetricRows);
    if (productMetricsWrite.error) fail(productMetricsWrite.error, "Insert product metrics");

    const skuRows = input.productReport.skus
      .map((s) => ({
        import_run_id: importRunId,
        product_id: productIdMap.get(s.itemId),
        sku_id: s.skuId,
        sku_name: s.skuName,
        impressions: 0,
        clicks: 0,
        visitors: 0,
        add_to_cart_visitors: 0,
        placed_orders: s.placedOrders,
        confirmed_orders: s.confirmedOrders,
        placed_sales: s.placedSales,
        confirmed_sales: s.confirmedSales,
        raw_payload: s
      }))
      .filter((row) => row.product_id);
    if (skuRows.length) {
      const write = await supabase.from("sku_metrics").insert(skuRows);
      if (write.error) fail(write.error, "Insert SKU metrics");
    }

    if (input.business) {
      const biWrite = await supabase.from("business_insights_store").insert({
        import_run_id: importRunId,
        placed_sales: input.business.placed?.sales || 0,
        placed_orders: input.business.placed?.orders || 0,
        product_clicks: input.business.placed?.productClicks || 0,
        visitors: input.business.placed?.visitors || 0,
        placed_conversion: input.business.placed?.conversionRate || 0,
        paid_sales: input.business.paid?.sales || 0,
        paid_orders: input.business.paid?.orders || 0,
        paid_conversion: input.business.paid?.conversionRate || 0,
        raw_payload: {
          placed: input.business.placed || null,
          confirmed: input.business.confirmed || null,
          paid: input.business.paid || null
        }
      });
      if (biWrite.error) fail(biWrite.error, "Insert Business Insights store metrics");

      const trafficRows = [
        ...input.business.trafficSources.map((t) => ({
          import_run_id: importRunId,
          product_id: null as string | null,
          source: `${t.stage}:${t.section}:${t.source}`,
          impressions: t.impressions,
          clicks: t.clicks,
          visitors: 0,
          orders: t.orders,
          buyers: t.buyers,
          gmv: t.sales,
          conversion_rate: t.conversionRate,
          raw_payload: t
        })),
        ...input.business.productSources
          .map((t) => ({
            import_run_id: importRunId,
            product_id: productIdMap.get(t.itemId) || null,
            source: `${t.stage}:${t.section}`,
            impressions: t.impressions,
            clicks: t.clicks,
            visitors: 0,
            orders: t.orders,
            buyers: t.buyers,
            gmv: t.sales,
            conversion_rate: t.conversionRate,
            raw_payload: t
          }))
          .filter((t) => t.product_id)
      ];
      if (trafficRows.length) {
        const write = await supabase.from("traffic_source_metrics").insert(trafficRows);
        if (write.error) fail(write.error, "Insert Business Insights traffic sources");
      }
    }

    if (input.ads) {
      const aggregated = [...aggregateAds(input.ads.itemRows).values()];
      const adRows = aggregated
        .map((a) => ({
          import_run_id: importRunId,
          product_id: productIdMap.get(a.itemId),
          ad_name: a.adName,
          impressions: a.impressions,
          clicks: a.clicks,
          ctr: a.ctr,
          add_to_cart: a.addToCart,
          add_to_cart_rate: a.addToCartRate,
          conversions: a.conversions,
          conversion_rate: a.conversionRate,
          gmv: a.gmv,
          expense: a.expense,
          roas: a.roas,
          acos: a.acos,
          raw_payload: a
        }))
        .filter((row) => row.product_id);
      if (adRows.length) {
        const write = await supabase.from("ad_metrics").insert(adRows);
        if (write.error) fail(write.error, "Insert product Ads metrics");
      }

      if (input.ads.storeRows.length) {
        const rows = input.ads.storeRows.map((a) => ({
          import_run_id: importRunId,
          ad_name: a.adName,
          impressions: a.impressions,
          clicks: a.clicks,
          ctr: a.ctr,
          conversions: a.conversions,
          conversion_rate: a.conversionRate,
          gmv: a.gmv,
          expense: a.expense,
          roas: a.roas,
          acos: a.acos,
          raw_payload: a
        }));
        const write = await supabase.from("store_ad_metrics").insert(rows);
        if (write.error) fail(write.error, "Insert store-level Ads metrics");
      }
    }

    if (input.affiliates.length) {
      const partnerUpsert = await supabase
        .from("affiliate_partners")
        .upsert(
          input.affiliates.map((a) => ({ shop_id: shop.id, partner_id: a.partnerId, partner_name: a.partnerName, username: a.username })),
          { onConflict: "shop_id,partner_id" }
        )
        .select("id,partner_id");
      if (partnerUpsert.error) fail(partnerUpsert.error, "Upsert affiliate partners");
      const partnerMap = new Map<string, string>((partnerUpsert.data || []).map((row: any) => [String(row.partner_id), String(row.id)]));
      const affiliateRows = input.affiliates
        .map((a) => ({
          import_run_id: importRunId,
          partner_id: partnerMap.get(a.partnerId),
          product_id: null,
          gmv: a.gmv,
          orders: a.orders,
          clicks: a.clicks,
          commission: a.commission,
          roi: a.roi,
          buyers: a.buyers,
          new_buyers: a.newBuyers,
          raw_payload: a
        }))
        .filter((row) => row.partner_id);
      if (affiliateRows.length) {
        const write = await supabase.from("affiliate_metrics").insert(affiliateRows);
        if (write.error) fail(write.error, "Insert affiliate metrics");
      }
    }

    const benchmarkWrite = await supabase.from("benchmarks").insert({
      import_run_id: importRunId,
      product_benchmarks: {
        ctr: input.benchmarks.ctr,
        bounceRate: input.benchmarks.bounceRate,
        addToCartRate: input.benchmarks.addToCartRate,
        placedBuyerCr: input.benchmarks.placedBuyerCr,
        confirmedBuyerCr: input.benchmarks.confirmedBuyerCr,
        orderConfirmRate: input.benchmarks.orderConfirmRate,
        searchClickShare: input.benchmarks.searchClickShare
      },
      ad_benchmarks: {
        adCtr: input.benchmarks.adCtr,
        adConversionRate: input.benchmarks.adConversionRate,
        adRoas: input.benchmarks.adRoas,
        adAcos: input.benchmarks.adAcos
      },
      cohort_metadata: input.benchmarks.cohorts
    });
    if (benchmarkWrite.error) fail(benchmarkWrite.error, "Insert benchmarks");

    const diagnosisRows = input.master
      .map((p) => ({
        import_run_id: importRunId,
        product_id: productIdMap.get(p.itemId),
        primary_problem: p.diagnosis?.primaryProblem || "No diagnosis",
        severity: p.diagnosis?.severity || "DATA",
        confidence: p.diagnosis?.confidence || 0,
        opportunity_score: p.diagnosis?.opportunityScore || 0,
        root_causes: p.diagnosis?.rootCauses || [],
        evidence: p.diagnosis?.evidence || [],
        actions: p.diagnosis?.actions || [],
        ai_analysis: p.diagnosis ? { summary: p.diagnosis.summary, doNotChange: p.diagnosis.doNotChange, confidenceBand: p.diagnosis.confidenceBand } : null
      }))
      .filter((row) => row.product_id);
    const diagnosisWrite = await supabase.from("diagnoses").insert(diagnosisRows);
    if (diagnosisWrite.error) fail(diagnosisWrite.error, "Insert diagnoses");

    const complete = await supabase.from("import_runs").update({ status: "completed", product_count: input.master.length }).eq("id", importRunId);
    if (complete.error) fail(complete.error, "Complete import run");
    return { importRunId, shopId: shop.id as string };
  } catch (error) {
    await supabase.from("import_runs").update({ status: "failed" }).eq("id", importRunId);
    throw error;
  }
}

import { NextResponse } from "next/server";
import { calculateBenchmarks } from "@/lib/shopee/benchmark";
import { diagnoseAll } from "@/lib/shopee/diagnosis";
import { buildMasterTable } from "@/lib/shopee/master-table";
import { persistAnalysis } from "@/lib/shopee/persist";
import { buildDataWarnings } from "@/lib/shopee/quality";
import {
  parseAdsCsv,
  parseAffiliateCsv,
  parseBusinessInsights,
  parseProductPerformance
} from "@/lib/shopee/report-parser";
import type { AnalysisSummary, Severity } from "@/lib/shopee/types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

async function fileBuffer(value: FormDataEntryValue | null): Promise<ArrayBuffer | undefined> {
  if (!(value instanceof File) || value.size === 0) return undefined;
  return value.arrayBuffer();
}

function fileName(value: FormDataEntryValue | null): string | null {
  return value instanceof File && value.size > 0 ? value.name : null;
}

const severityOrder: Record<Severity, number> = { P0: 0, P1: 1, DATA: 2, SCALE: 3, P2: 4, WATCH: 5 };

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Please sign in before importing data." }, { status: 401 });

    const form = await request.formData();
    const productFile = form.get("productPerformance");
    const businessFile = form.get("businessInsights");
    const adsFile = form.get("ads");
    const affiliateFile = form.get("affiliate");
    const shopUrl = String(form.get("shopUrl") ?? "").trim();

    const productBuffer = await fileBuffer(productFile);
    if (!productBuffer) return NextResponse.json({ error: "Product Performance (.xlsx) is required." }, { status: 400 });
    if (!shopUrl.startsWith("http")) return NextResponse.json({ error: "A valid Shopee store URL is required." }, { status: 400 });

    const productReport = parseProductPerformance(productBuffer);
    if (!productReport.products.length) return NextResponse.json({ error: "No product-level rows were found. Please upload the original Product Performance export." }, { status: 400 });

    const businessBuffer = await fileBuffer(businessFile);
    const adsBuffer = await fileBuffer(adsFile);
    const affiliateBuffer = await fileBuffer(affiliateFile);
    const business = businessBuffer ? parseBusinessInsights(businessBuffer) : undefined;
    const ads = adsBuffer ? parseAdsCsv(adsBuffer) : undefined;
    const affiliates = affiliateBuffer ? parseAffiliateCsv(affiliateBuffer) : [];

    const masterBase = buildMasterTable(productReport.products, ads?.itemRows ?? [], ads?.meta.shopId);
    const benchmarks = calculateBenchmarks(masterBase);
    const master = diagnoseAll(masterBase, benchmarks);
    const warnings = buildDataWarnings({ productReport, ads, business, master });

    const counts: Record<Severity, number> = { P0: 0, P1: 0, P2: 0, SCALE: 0, WATCH: 0, DATA: 0 };
    master.forEach((p) => { counts[p.diagnosis?.severity ?? "DATA"] += 1; });

    const persisted = await persistAnalysis({
      supabase,
      userId: user.id,
      shopUrl,
      productReport,
      ads,
      affiliates,
      business,
      master,
      benchmarks,
      warnings,
      files: {
        productPerformance: fileName(productFile),
        businessInsights: fileName(businessFile),
        ads: fileName(adsFile),
        affiliate: fileName(affiliateFile)
      }
    });

    const summary: AnalysisSummary = {
      products: master.length,
      skuRows: productReport.skus.length,
      adsMatched: master.filter((p) => p.ad).length,
      storeAdRows: ads?.storeRows.length ?? 0,
      affiliatePartners: affiliates.length,
      businessInsightsLoaded: Boolean(business),
      counts,
      warnings
    };

    const preview = [...master]
      .sort((a, b) => {
        const severity = severityOrder[a.diagnosis!.severity] - severityOrder[b.diagnosis!.severity];
        return severity || b.diagnosis!.opportunityScore - a.diagnosis!.opportunityScore;
      })
      .slice(0, 15)
      .map((p) => ({
        itemId: p.itemId,
        productName: p.productName,
        ctr: p.ctr,
        addToCartRate: p.addToCartRate,
        confirmedBuyerCr: p.confirmedBuyerCr,
        orderConfirmRate: p.orderConfirmRate,
        adRoas: p.ad?.roas ?? null,
        diagnosis: p.diagnosis
      }));

    return NextResponse.json({
      ok: true,
      importRunId: persisted.importRunId,
      shopId: persisted.shopId,
      summary,
      periods: { businessInsights: business?.period ?? null, ads: ads?.meta.period ?? null },
      store: { shopName: ads?.meta.shopName ?? null, shopeeShopId: ads?.meta.shopId ?? null },
      business: business ? { placed: business.placed, confirmed: business.confirmed, paid: business.paid } : null,
      benchmarks,
      preview
    });
  } catch (error) {
    console.error("Analyze import failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown import error." }, { status: 500 });
  }
}

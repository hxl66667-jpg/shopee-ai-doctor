import { NextResponse } from "next/server";
import { calculateBenchmarks } from "@/lib/shopee/benchmark";
import { diagnoseAll } from "@/lib/shopee/diagnosis";
import { buildMasterTable } from "@/lib/shopee/master-table";
import { parseAdsCsv, parseAffiliateCsv, parseProductPerformance } from "@/lib/shopee/report-parser";

export const runtime = "nodejs";

async function buffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const productFile = form.get("productPerformance");
    const adsFile = form.get("ads");
    const affiliateFile = form.get("affiliate");
    const shopUrl = String(form.get("shopUrl") ?? "");

    if (!(productFile instanceof File) || !(adsFile instanceof File)) {
      return NextResponse.json({ error: "Product Performance and Ads files are required." }, { status: 400 });
    }

    const products = parseProductPerformance(await buffer(productFile));
    const ads = parseAdsCsv(await buffer(adsFile));
    const affiliates = affiliateFile instanceof File && affiliateFile.size > 0
      ? parseAffiliateCsv(await buffer(affiliateFile))
      : [];

    const master = buildMasterTable(products, ads, shopUrl);
    const benchmarks = calculateBenchmarks(master);
    const diagnosed = diagnoseAll(master, benchmarks);

    const adsMatched = diagnosed.filter((p) => p.ad).length;
    const counts = diagnosed.reduce<Record<string, number>>((acc, p) => {
      const key = p.diagnosis?.severity ?? "DATA";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      products: diagnosed.length,
      adsMatched,
      affiliatePartners: affiliates.length,
      counts,
      benchmarks,
      preview: diagnosed.slice(0, 10).map((p) => ({
        itemId: p.itemId,
        productName: p.productName,
        ctr: p.ctr,
        addToCartRate: p.addToCartRate,
        confirmedBuyerCr: p.confirmedBuyerCr,
        adRoas: p.ad?.roas ?? null,
        diagnosis: p.diagnosis
      }))
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown parsing error." }, { status: 500 });
  }
}

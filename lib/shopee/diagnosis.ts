import { Benchmarks, Diagnosis, MasterProduct } from "./types";

function confidence(p: MasterProduct): number {
  if (p.impressions >= 100000 && p.visitors >= 1000) return 0.95;
  if (p.impressions >= 20000 && p.visitors >= 300) return 0.88;
  if (p.impressions >= 5000 && p.visitors >= 100) return 0.78;
  return 0.45;
}

export function diagnoseProduct(p: MasterProduct, b: Benchmarks): Diagnosis {
  const conf = confidence(p);
  if (p.impressions < 1000 || p.visitors < 50) {
    return {
      primaryProblem: "INSUFFICIENT_DATA",
      severity: "WATCH",
      confidence: conf,
      evidence: [`Only ${p.impressions} impressions and ${p.visitors} visitors in the selected period.`],
      actions: ["Keep collecting traffic before making a major listing change."]
    };
  }

  const ctrLow = p.ctr < b.ctr.p25;
  const bounceHigh = p.bounceRate > b.bounceRate.p75;
  const atcLow = p.addToCartRate < b.addToCartRate.p25;
  const placedLow = p.placedBuyerCr < b.placedBuyerCr.p25;
  const confirmedLow = p.confirmedBuyerCr < b.confirmedBuyerCr.p25;
  const confirmLow = p.placedOrders >= 10 && p.orderConfirmRate < b.orderConfirmRate.p25;

  if (ctrLow && !atcLow && !confirmedLow) {
    return {
      primaryProblem: "LOW_CTR",
      severity: p.impressions >= 20000 ? "P0" : "P1",
      confidence: conf,
      evidence: [
        `CTR ${(p.ctr * 100).toFixed(2)}% is below store P25 ${(b.ctr.p25 * 100).toFixed(2)}%.`,
        `Add-to-cart and confirmed conversion are not simultaneously weak.`
      ],
      actions: [
        "Prioritize main-image competitiveness before rebuilding the detail page.",
        "Check search-card price, discount/voucher visibility and title front-loaded keywords.",
        "Change one major variable at a time and track 7-day CTR afterward."
      ]
    };
  }

  if (!ctrLow && (bounceHigh || atcLow) && placedLow) {
    return {
      primaryProblem: "PRODUCT_PAGE",
      severity: "P0",
      confidence: conf,
      evidence: [
        `CTR is not in the bottom quartile, but page engagement/conversion is weak.`,
        `ATC ${(p.addToCartRate * 100).toFixed(2)}%, bounce ${(p.bounceRate * 100).toFixed(2)}%, placed CR ${(p.placedBuyerCr * 100).toFixed(2)}%.`
      ],
      actions: [
        "Audit first-screen detail images, product value proposition, parameters and installation/use clarity.",
        "Check SKU price ladder and whether the lowest displayed price belongs to a non-core variant.",
        "Compare offer, accessories, warranty and proof elements against direct competitors."
      ]
    };
  }

  if (!placedLow && (confirmedLow || confirmLow)) {
    return {
      primaryProblem: "ORDER_COMPLETION",
      severity: "P0",
      confidence: conf,
      evidence: [
        `Placed conversion is acceptable while confirmed performance falls below benchmark.`,
        `Order confirmation rate ${(p.orderConfirmRate * 100).toFixed(2)}% vs store P25 ${(b.orderConfirmRate.p25 * 100).toFixed(2)}%.`
      ],
      actions: [
        "Check cancellations, COD behavior, stock availability, fulfillment and variant errors.",
        "Do not prioritize a main-image redesign until the post-order loss is understood."
      ]
    };
  }

  if (p.ad && b.adCtr && b.adConversionRate && b.adRoas) {
    const adCtrLow = p.ad.ctr < b.adCtr.p25;
    const organicCtrHealthy = p.ctr >= b.ctr.median;
    if (adCtrLow && organicCtrHealthy) {
      return {
        primaryProblem: "AD_TRAFFIC_QUALITY",
        severity: "P1",
        confidence: conf,
        evidence: [
          `Listing CTR ${(p.ctr * 100).toFixed(2)}% is healthy while Ads CTR ${(p.ad.ctr * 100).toFixed(2)}% is weak.`
        ],
        actions: [
          "Review ad traffic quality and targeting before changing the listing creative.",
          "Compare ad placements/campaign types and reduce spend on low-quality traffic."
        ]
      };
    }

    const strong =
      p.ctr >= b.ctr.p75 &&
      p.addToCartRate >= b.addToCartRate.p75 &&
      p.confirmedBuyerCr >= b.confirmedBuyerCr.p75 &&
      p.ad.roas >= b.adRoas.p75;
    if (strong) {
      return {
        primaryProblem: "HEALTHY_SCALE",
        severity: "SCALE",
        confidence: conf,
        evidence: ["Listing funnel and Ads ROAS are in the store's upper quartile."],
        actions: ["Protect stock and cautiously scale qualified traffic/ad budget.", "Avoid unnecessary major listing edits while performance is strong."]
      };
    }
  }

  if (confirmedLow) {
    return {
      primaryProblem: "LOW_CONVERSION",
      severity: "P1",
      confidence: conf,
      evidence: [`Confirmed buyer CR ${(p.confirmedBuyerCr * 100).toFixed(2)}% is below store P25 ${(b.confirmedBuyerCr.p25 * 100).toFixed(2)}%.`],
      actions: ["Audit price/value, reviews, SKU structure, shipping friction and competitor offer before spending more on traffic."]
    };
  }

  return {
    primaryProblem: "HEALTHY_OR_MINOR",
    severity: "P2",
    confidence: conf,
    evidence: ["No major funnel break matched the current high-priority rules."],
    actions: ["Keep monitoring; prioritize listings with larger revenue opportunity or clearer bottlenecks first."]
  };
}

export function diagnoseAll(products: MasterProduct[], benchmarks: Benchmarks): MasterProduct[] {
  return products.map((p) => ({ ...p, diagnosis: diagnoseProduct(p, benchmarks) }));
}

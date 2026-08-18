import { safeDivide } from "./number";
import type { Benchmarks, ConfidenceBand, Diagnosis, MasterProduct } from "./types";

function trafficConfidence(p: MasterProduct): number {
  if (p.impressions >= 5000 && p.clicks >= 100) return 0.95;
  if (p.impressions >= 1000) return 0.72;
  return 0.38;
}
function engagementConfidence(p: MasterProduct): number {
  if (p.visitors >= 300) return 0.95;
  if (p.visitors >= 50) return 0.72;
  return 0.38;
}
function conversionConfidence(p: MasterProduct): number {
  if (p.visitors >= 300 && p.placedBuyers >= 10) return 0.95;
  if (p.visitors >= 100) return 0.72;
  return 0.38;
}
function confirmationConfidence(p: MasterProduct): number {
  if (p.placedOrders >= 20) return 0.95;
  if (p.placedOrders >= 5) return 0.72;
  return 0.38;
}
function adsConfidence(p: MasterProduct): number {
  if (!p.ad) return 0;
  if (p.ad.clicks >= 200 || p.ad.expense >= 1000) return 0.95;
  if (p.ad.clicks >= 50 || p.ad.expense >= 200) return 0.72;
  return 0.38;
}
function band(value: number): ConfidenceBand {
  return value >= 0.9 ? "HIGH" : value >= 0.65 ? "MEDIUM" : "LOW";
}

function estimatedOpportunity(p: MasterProduct, b: Benchmarks): number {
  const aov = p.confirmedOrders > 0 ? p.confirmedSales / p.confirmedOrders : p.placedOrders > 0 ? p.placedSales / p.placedOrders : 0;
  const confirmedOrderPerClick = safeDivide(p.confirmedOrders, p.clicks);
  const ctrGap = Math.max(0, b.ctr.median - p.ctr);
  const ctrLost = p.impressions * ctrGap * confirmedOrderPerClick * aov;
  const crGap = Math.max(0, b.confirmedBuyerCr.median - p.confirmedBuyerCr);
  const conversionLost = p.visitors * crGap * aov;
  const confirmGap = Math.max(0, b.orderConfirmRate.median - p.orderConfirmRate);
  const confirmationLost = p.placedOrders * confirmGap * aov;
  const adWaste = p.ad && p.ad.expense >= 200 && p.ad.conversions === 0 ? p.ad.expense : 0;
  return Math.max(0, ctrLost, conversionLost, confirmationLost, adWaste);
}

function result(
  p: MasterProduct,
  b: Benchmarks,
  data: Omit<Diagnosis, "confidenceBand" | "opportunityScore"> & { opportunityScore?: number }
): Diagnosis {
  const confidence = Math.max(0, Math.min(1, data.confidence));
  return {
    ...data,
    confidence,
    confidenceBand: band(confidence),
    opportunityScore: data.opportunityScore ?? estimatedOpportunity(p, b)
  };
}

function invalidProductRates(p: MasterProduct): string[] {
  const entries: Array<[string, number]> = [
    ["CTR", p.ctr],
    ["Bounce rate", p.bounceRate],
    ["ATC rate", p.addToCartRate],
    ["Placed buyer CR", p.placedBuyerCr],
    ["Confirmed buyer CR", p.confirmedBuyerCr],
    ["Order confirmation rate", p.orderConfirmRate]
  ];
  if (p.ad) {
    entries.push(["Ads CTR", p.ad.ctr], ["Ads conversion rate", p.ad.conversionRate], ["Ads ACOS", p.ad.acos]);
  }
  return entries.filter(([, value]) => !Number.isFinite(value) || value < 0 || value > 1.000001).map(([name]) => name);
}

export function diagnoseProduct(p: MasterProduct, b: Benchmarks): Diagnosis {
  const invalid = invalidProductRates(p);
  if (invalid.length) {
    return result(p, b, {
      primaryProblem: "Data quality anomaly",
      severity: "DATA",
      confidence: 0.99,
      summary: "This listing contains impossible rate values, so funnel diagnosis is intentionally blocked until the source export is verified.",
      rootCauses: [{ code: "D_RATE_OUTLIER", confidence: 0.99, evidence: `Invalid metrics: ${invalid.join(", ")}` }],
      evidence: [`Invalid metrics: ${invalid.join(", ")}`],
      actions: [{ priority: 1, action: "Re-export the same date range from Seller Centre and verify the affected row before changing the listing.", reason: "Optimizing from impossible rates can create false decisions.", metricToWatch: "Data validity" }],
      doNotChange: ["Do not change the main image, price or ads based on this row until the export is verified."],
      opportunityScore: 0
    });
  }

  const tc = trafficConfidence(p);
  const ec = engagementConfidence(p);
  const cc = conversionConfidence(p);
  const oc = confirmationConfidence(p);
  const ac = adsConfidence(p);

  if (p.ad && p.ad.expense >= 200 && p.ad.conversions === 0 && (p.ad.clicks >= 50 || p.ad.expense >= 1000)) {
    return result(p, b, {
      primaryProblem: "Advertising spend without conversions",
      severity: "P0",
      confidence: ac,
      summary: "The ad is spending meaningful budget but has produced no attributed conversions. Stop leakage before scaling traffic.",
      rootCauses: [
        { code: "A_NO_CONVERSIONS", confidence: ac, evidence: `Ads: ${p.ad.clicks} clicks, ₱${p.ad.expense.toFixed(0)} spend, 0 conversions, ROAS ${p.ad.roas.toFixed(2)}.` }
      ],
      evidence: [`Ads CTR ${(p.ad.ctr * 100).toFixed(2)}%`, `${p.ad.clicks} ad clicks`, `₱${p.ad.expense.toFixed(0)} spend`, "0 ad conversions"],
      actions: [
        { priority: 1, action: "Reduce or pause this listing's paid traffic until the product page/offer is fixed.", reason: "Current paid clicks are not converting.", metricToWatch: "Ads conversion rate" },
        { priority: 2, action: "Check price competitiveness, shipping fee, voucher visibility and the first 3 detail images against the best-selling same-category listing.", reason: "Zero conversions after meaningful clicks usually indicates offer/page friction rather than insufficient traffic.", metricToWatch: "Confirmed buyer CR" },
        { priority: 3, action: "Relaunch with a smaller budget only after conversion improves; then scale based on ROAS/ACOS, not impressions.", reason: "Prevents repeated spend leakage.", metricToWatch: "ROAS / ACOS" }
      ],
      doNotChange: ["Do not increase budget simply to get more data."],
    });
  }

  if (p.placedOrders >= 20 && p.orderConfirmRate < Math.min(0.8, b.orderConfirmRate.p25 * 0.9)) {
    return result(p, b, {
      primaryProblem: "Order completion / cancellation",
      severity: "P0",
      confidence: oc,
      summary: "The listing generates placed orders but loses too many before confirmation. Fix fulfillment/order-completion causes before buying more traffic.",
      rootCauses: [{ code: "C_LOW_CONFIRMATION", confidence: oc, evidence: `${p.confirmedOrders}/${p.placedOrders} orders confirmed (${(p.orderConfirmRate * 100).toFixed(1)}%).` }],
      evidence: [`Placed orders ${p.placedOrders}`, `Confirmed orders ${p.confirmedOrders}`, `Confirmation ${(p.orderConfirmRate * 100).toFixed(1)}%`, `Store P25 ${(b.orderConfirmRate.p25 * 100).toFixed(1)}%`],
      actions: [
        { priority: 1, action: "Audit cancellation reasons, stock accuracy, variant availability and fulfillment handling for this Item ID.", reason: "The leak occurs after the customer already ordered.", metricToWatch: "Confirmed / placed orders" },
        { priority: 2, action: "Remove unavailable or misleading variants and align lead time/shipping promises with actual fulfillment.", reason: "Reduces buyer and seller cancellations.", metricToWatch: "Cancellation rate" }
      ],
      doNotChange: ["Do not treat this as a traffic problem while order completion is weak."]
    });
  }

  const healthyScale =
    p.impressions >= 5000 &&
    p.visitors >= 300 &&
    p.ctr >= b.ctr.p75 &&
    p.bounceRate <= b.bounceRate.p25 &&
    p.addToCartRate >= b.addToCartRate.p75 &&
    p.confirmedBuyerCr >= b.confirmedBuyerCr.p75 &&
    p.orderConfirmRate >= Math.max(0.85, b.orderConfirmRate.p25);
  if (healthyScale) {
    const evidence = [
      `CTR ${(p.ctr * 100).toFixed(2)}% ≥ P75 ${(b.ctr.p75 * 100).toFixed(2)}%`,
      `Bounce ${(p.bounceRate * 100).toFixed(2)}% ≤ P25 ${(b.bounceRate.p25 * 100).toFixed(2)}%`,
      `ATC ${(p.addToCartRate * 100).toFixed(2)}% ≥ P75 ${(b.addToCartRate.p75 * 100).toFixed(2)}%`,
      `Confirmed buyer CR ${(p.confirmedBuyerCr * 100).toFixed(2)}% ≥ P75 ${(b.confirmedBuyerCr.p75 * 100).toFixed(2)}%`
    ];
    return result(p, b, {
      primaryProblem: "Healthy funnel / scale candidate",
      severity: "SCALE",
      confidence: Math.min(tc, ec, cc, oc),
      summary: "This listing is strong across discovery, product-page engagement and conversion. Preserve the winning creative/offer and scale carefully.",
      rootCauses: [{ code: "S_HEALTHY_FUNNEL", confidence: Math.min(tc, ec, cc, oc), evidence: evidence.join("; ") }],
      evidence,
      actions: [
        { priority: 1, action: "Protect the current main image, title structure, hero offer and best-selling SKU while testing only one variable at a time.", reason: "The current funnel is already outperforming the store benchmark.", metricToWatch: "CTR + confirmed buyer CR" },
        { priority: 2, action: p.ad ? "Increase ad exposure gradually only while ROAS/ACOS remains inside the profitable range." : "Test paid traffic with a controlled budget because the organic funnel is already proven.", reason: "Scale a proven listing instead of redesigning it.", metricToWatch: "Incremental GMV / ROAS" }
      ],
      doNotChange: ["Do not redesign the main image or rewrite the whole listing without an A/B reason."]
    });
  }

  if (p.impressions >= 1000 && p.ctr < b.ctr.p25) {
    const severe = p.impressions >= 5000 && p.ctr < b.ctr.p25 * 0.75;
    return result(p, b, {
      primaryProblem: "Low search-card click-through",
      severity: severe ? "P0" : "P1",
      confidence: tc,
      summary: "The listing is receiving visibility but too few shoppers choose it. The first bottleneck is the search/recommendation card, not the detail page.",
      rootCauses: [{ code: "T_LOW_CTR", confidence: tc, evidence: `CTR ${(p.ctr * 100).toFixed(2)}% vs store P25 ${(b.ctr.p25 * 100).toFixed(2)}%.` }],
      evidence: [`${p.impressions.toLocaleString()} impressions`, `${p.clicks.toLocaleString()} clicks`, `CTR ${(p.ctr * 100).toFixed(2)}%`, `P25 ${(b.ctr.p25 * 100).toFixed(2)}%`],
      actions: [
        { priority: 1, action: "Rebuild the main image around one dominant product, the strongest purchase reason and a cleaner mobile-size layout.", reason: "CTR is below the store's lower quartile despite enough impressions.", metricToWatch: "Product CTR" },
        { priority: 2, action: "Move the highest-intent keyword and product type to the front of the title; remove low-value keyword clutter.", reason: "Improves relevance at the search-card stage.", metricToWatch: "Search clicks / CTR" },
        { priority: 3, action: "Check visible price/discount competitiveness against the first-page same-category listings before changing detail content.", reason: "Price is part of the card-level click decision.", metricToWatch: "CTR" }
      ],
      doNotChange: ["Do not spend time rewriting the lower detail page before the card earns the click."]
    });
  }

  if (p.visitors >= 50 && p.bounceRate > b.bounceRate.p75 && p.addToCartRate < b.addToCartRate.p25) {
    return result(p, b, {
      primaryProblem: "Product page fails to hold interest",
      severity: p.visitors >= 300 ? "P0" : "P1",
      confidence: ec,
      summary: "Shoppers enter the listing but leave quickly and rarely add to cart. The card promise and the product-page proof/value proposition are not connecting.",
      rootCauses: [
        { code: "E_HIGH_BOUNCE", confidence: ec, evidence: `Bounce ${(p.bounceRate * 100).toFixed(2)}% > P75 ${(b.bounceRate.p75 * 100).toFixed(2)}%.` },
        { code: "E_LOW_ATC", confidence: ec, evidence: `ATC ${(p.addToCartRate * 100).toFixed(2)}% < P25 ${(b.addToCartRate.p25 * 100).toFixed(2)}%.` }
      ],
      evidence: [`Bounce ${(p.bounceRate * 100).toFixed(2)}%`, `ATC ${(p.addToCartRate * 100).toFixed(2)}%`, `${p.visitors} visitors`],
      actions: [
        { priority: 1, action: "Make the first 3 detail images answer: exact product/size, strongest measurable benefit, and what is included.", reason: "The page needs immediate clarity after the click.", metricToWatch: "Bounce rate" },
        { priority: 2, action: "Add proof for durability/performance and a clear SKU/package comparison before long lifestyle content.", reason: "Raises purchase confidence and SKU clarity.", metricToWatch: "Add-to-cart rate" },
        { priority: 3, action: "Ensure the main-image promise exactly matches the default SKU and first-screen page content.", reason: "Expectation mismatch often produces both high bounce and low ATC.", metricToWatch: "Bounce + ATC" }
      ],
      doNotChange: ["Do not simply add more decorative detail images; prioritize purchase information density."]
    });
  }

  if (p.visitors >= 50 && p.addToCartRate < b.addToCartRate.p25) {
    return result(p, b, {
      primaryProblem: "Weak add-to-cart intent",
      severity: p.visitors >= 300 ? "P1" : "P2",
      confidence: ec,
      summary: "Traffic reaches the product page, but the offer is not creating enough purchase intent.",
      rootCauses: [{ code: "E_LOW_ATC", confidence: ec, evidence: `ATC ${(p.addToCartRate * 100).toFixed(2)}% vs P25 ${(b.addToCartRate.p25 * 100).toFixed(2)}%.` }],
      evidence: [`ATC ${(p.addToCartRate * 100).toFixed(2)}%`, `P25 ${(b.addToCartRate.p25 * 100).toFixed(2)}%`, `${p.visitors} visitors`],
      actions: [
        { priority: 1, action: "Strengthen SKU naming, package contents, warranty/after-sales proof and the first-screen value proposition.", reason: "These elements convert browsing into cart intent.", metricToWatch: "Add-to-cart rate" },
        { priority: 2, action: "Compare delivered value (price + shipping + accessories) with the top same-category alternatives.", reason: "A weak relative offer suppresses ATC even when CTR is acceptable.", metricToWatch: "ATC + confirmed buyer CR" }
      ],
      doNotChange: ["Do not increase traffic budget until ATC improves."]
    });
  }

  if (p.visitors >= 100 && p.addToCartRate >= b.addToCartRate.p75 && p.confirmedBuyerCr < b.confirmedBuyerCr.p25) {
    return result(p, b, {
      primaryProblem: "Cart-to-order friction",
      severity: p.visitors >= 300 ? "P1" : "P2",
      confidence: cc,
      summary: "Shoppers show strong cart intent but too few become confirmed buyers. Focus on checkout-level economics and purchase friction.",
      rootCauses: [{ code: "C_HIGH_ATC_LOW_CR", confidence: cc, evidence: `ATC ${(p.addToCartRate * 100).toFixed(2)}% but confirmed buyer CR ${(p.confirmedBuyerCr * 100).toFixed(2)}%.` }],
      evidence: [`ATC ${(p.addToCartRate * 100).toFixed(2)}%`, `Confirmed buyer CR ${(p.confirmedBuyerCr * 100).toFixed(2)}%`, `CR P25 ${(b.confirmedBuyerCr.p25 * 100).toFixed(2)}%`],
      actions: [
        { priority: 1, action: "Audit final payable price, shipping fee, voucher threshold, COD availability and stock for the most-carted variants.", reason: "Intent exists; friction is later in the funnel.", metricToWatch: "Confirmed buyer CR" },
        { priority: 2, action: "Use a clearer best-value SKU and bundle ladder so shoppers do not abandon after opening variant selection.", reason: "Reduces SKU/price decision friction.", metricToWatch: "Confirmed orders" }
      ],
      doNotChange: ["Do not sacrifice a strong main image just because final conversion is weak."]
    });
  }

  if (p.visitors >= 100 && p.confirmedBuyerCr < b.confirmedBuyerCr.p25) {
    return result(p, b, {
      primaryProblem: "Low product conversion",
      severity: p.visitors >= 300 ? "P1" : "P2",
      confidence: cc,
      summary: "The listing has enough visitors but confirmed buyer conversion is below the store's lower quartile.",
      rootCauses: [{ code: "C_LOW_CONFIRMED_CR", confidence: cc, evidence: `Confirmed buyer CR ${(p.confirmedBuyerCr * 100).toFixed(2)}% vs P25 ${(b.confirmedBuyerCr.p25 * 100).toFixed(2)}%.` }],
      evidence: [`${p.visitors} visitors`, `Confirmed buyer CR ${(p.confirmedBuyerCr * 100).toFixed(2)}%`, `P25 ${(b.confirmedBuyerCr.p25 * 100).toFixed(2)}%`],
      actions: [
        { priority: 1, action: "Review price, shipping, vouchers, reviews, SKU clarity and the first 5 detail images as one conversion package.", reason: "Traffic is sufficient; conversion is the bottleneck.", metricToWatch: "Confirmed buyer CR" },
        { priority: 2, action: "Prioritize concrete proof: real specifications, use-case fit, package contents, warranty and installation/use guidance.", reason: "Reduces uncertainty before checkout.", metricToWatch: "ATC + conversion" }
      ],
      doNotChange: ["Do not judge conversion from Ads metrics alone; Product Performance remains the primary listing funnel source."]
    });
  }

  if (p.ad && p.ad.impressions >= 1000 && b.adCtr && p.ad.ctr < b.adCtr.p25) {
    return result(p, b, {
      primaryProblem: "Low paid-ad click-through",
      severity: "P1",
      confidence: ac,
      summary: "The listing's paid exposure is not earning enough clicks compared with other advertised products in the same store.",
      rootCauses: [{ code: "A_LOW_CTR", confidence: ac, evidence: `Ad CTR ${(p.ad.ctr * 100).toFixed(2)}% vs ad P25 ${(b.adCtr.p25 * 100).toFixed(2)}%.` }],
      evidence: [`Ad impressions ${p.ad.impressions}`, `Ad CTR ${(p.ad.ctr * 100).toFixed(2)}%`, `Ad P25 ${(b.adCtr.p25 * 100).toFixed(2)}%`],
      actions: [
        { priority: 1, action: "Improve the product card before increasing ad budget: main image hierarchy, title front keywords and visible offer.", reason: "Paid impressions are being wasted at the click stage.", metricToWatch: "Ads CTR" },
        { priority: 2, action: "Keep bidding conservative until ad CTR returns to at least the store median.", reason: "Prevents buying low-quality exposure at scale.", metricToWatch: "Ads CTR + CPC" }
      ],
      doNotChange: ["Do not diagnose the product page from ad CTR alone."]
    });
  }

  if (p.ad && p.ad.clicks >= 50 && b.adConversionRate && p.ad.conversionRate < b.adConversionRate.p25) {
    return result(p, b, {
      primaryProblem: "Paid traffic converts poorly",
      severity: p.ad.expense >= 1000 ? "P1" : "P2",
      confidence: ac,
      summary: "Ads are generating clicks, but paid traffic converts below the store's advertised-product benchmark.",
      rootCauses: [{ code: "A_LOW_CR", confidence: ac, evidence: `Ad CR ${(p.ad.conversionRate * 100).toFixed(2)}% vs P25 ${(b.adConversionRate.p25 * 100).toFixed(2)}%.` }],
      evidence: [`Ad clicks ${p.ad.clicks}`, `Ad CR ${(p.ad.conversionRate * 100).toFixed(2)}%`, `ROAS ${p.ad.roas.toFixed(2)}`],
      actions: [
        { priority: 1, action: "Reduce paid exposure while fixing the listing's offer/page conversion bottleneck.", reason: "More clicks will amplify inefficient spend.", metricToWatch: "Ads conversion rate" },
        { priority: 2, action: "Compare ad traffic quality with organic Product Performance; if organic conversion is healthy, tighten ad targeting/bidding rather than redesigning the product page.", reason: "Separates traffic-quality problems from listing problems.", metricToWatch: "Organic vs ad conversion" }
      ],
      doNotChange: ["Do not conflate Ads conversion with full listing conversion."]
    });
  }

  if (p.impressions < 1000 && p.visitors < 100 && (!p.ad || (p.ad.clicks < 50 && p.ad.expense < 200))) {
    return result(p, b, {
      primaryProblem: "Insufficient sample",
      severity: "WATCH",
      confidence: 0.38,
      summary: "There is not enough traffic/conversion evidence to make a high-confidence redesign decision.",
      rootCauses: [{ code: "W_LOW_SAMPLE", confidence: 0.38, evidence: `${p.impressions} impressions, ${p.visitors} visitors.` }],
      evidence: [`${p.impressions} impressions`, `${p.visitors} visitors`, `${p.confirmedOrders} confirmed orders`],
      actions: [
        { priority: 1, action: "Collect more comparable-period data before making major listing changes.", reason: "Small samples create unstable rates.", metricToWatch: "Impressions / visitors" },
        { priority: 2, action: "Use low-risk hygiene improvements only: accurate title, complete specs, correct SKU names and stock.", reason: "These do not depend on noisy funnel signals.", metricToWatch: "Data volume" }
      ],
      doNotChange: ["Do not label this listing a winner or loser from a tiny sample."],
      opportunityScore: 0
    });
  }

  const strongest = Math.min(tc, p.visitors >= 50 ? ec : 1, p.visitors >= 100 ? cc : 1);
  return result(p, b, {
    primaryProblem: "Secondary optimization / no dominant bottleneck",
    severity: "P2",
    confidence: strongest,
    summary: "No single P0/P1 bottleneck dominates the current evidence. Optimize incrementally and measure one funnel stage at a time.",
    rootCauses: [{ code: "P2_MIXED", confidence: strongest, evidence: "Core metrics are mixed or near store benchmarks." }],
    evidence: [`CTR ${(p.ctr * 100).toFixed(2)}%`, `ATC ${(p.addToCartRate * 100).toFixed(2)}%`, `Confirmed buyer CR ${(p.confirmedBuyerCr * 100).toFixed(2)}%`],
    actions: [
      { priority: 1, action: "Choose the weakest metric versus its store median and run one focused change for the next comparable period.", reason: "Avoids changing multiple variables without knowing what worked.", metricToWatch: "Weakest funnel metric" }
    ],
    doNotChange: ["Do not rebuild the whole listing without a dominant evidence-backed problem."]
  });
}

export function diagnoseAll(products: MasterProduct[], benchmarks: Benchmarks): MasterProduct[] {
  return products.map((product) => ({ ...product, diagnosis: diagnoseProduct(product, benchmarks) }));
}

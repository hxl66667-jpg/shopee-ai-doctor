export type Severity = "P0" | "P1" | "P2" | "SCALE" | "WATCH" | "DATA";
export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW";
export type Stage = "placed" | "confirmed" | "paid";

export type ReportPeriod = {
  raw: string;
  start: string;
  end: string;
};

export type ProductMetric = {
  itemId: string;
  productName: string;
  status?: string;
  impressions: number;
  clicks: number;
  ctr: number;
  placedOrderCr: number;
  confirmedOrderCr: number;
  uniqueImpressions: number;
  uniqueClicks: number;
  visitors: number;
  pageVisitors: number;
  bounceVisitors: number;
  bounceRate: number;
  searchClicks: number;
  likes: number;
  addToCartVisitors: number;
  addToCartItems: number;
  addToCartRate: number;
  placedOrders: number;
  confirmedOrders: number;
  placedItems: number;
  confirmedItems: number;
  placedBuyers: number;
  confirmedBuyers: number;
  placedBuyerCr: number;
  confirmedBuyerCr: number;
  placedSales: number;
  confirmedSales: number;
  orderConfirmRate: number;
  repeatPlacedRate?: number;
  repeatConfirmedRate?: number;
  repeatPlacedDays?: number;
  repeatConfirmedDays?: number;
  raw?: Record<string, unknown>;
};

export type SkuMetric = {
  itemId: string;
  skuId: string;
  skuName: string;
  skuStatus?: string;
  sellerSku?: string;
  parentSellerSku?: string;
  placedOrders: number;
  confirmedOrders: number;
  placedItems: number;
  confirmedItems: number;
  placedBuyers: number;
  confirmedBuyers: number;
  addToCartItems: number;
  placedSales: number;
  confirmedSales: number;
  repeatPlacedRate?: number;
  repeatConfirmedRate?: number;
  raw?: Record<string, unknown>;
};

export type ProductPerformanceReport = {
  products: ProductMetric[];
  skus: SkuMetric[];
  duplicateProductIds: string[];
};

export type AdsReportMeta = {
  username?: string;
  shopName?: string;
  shopId?: string;
  createdAt?: string;
  period?: ReportPeriod;
};

export type AdMetric = {
  itemId: string;
  adName: string;
  status?: string;
  adsType?: string;
  biddingMethod?: string;
  placement?: string;
  impressions: number;
  clicks: number;
  ctr: number;
  addToCart: number;
  addToCartRate: number;
  conversions: number;
  directConversions: number;
  conversionRate: number;
  directConversionRate: number;
  itemsSold: number;
  directItemsSold: number;
  gmv: number;
  directGmv: number;
  expense: number;
  roas: number;
  directRoas: number;
  acos: number;
  directAcos: number;
  voucherAmount: number;
  voucheredSales: number;
  raw?: Record<string, unknown>;
};

export type AdsReport = {
  meta: AdsReportMeta;
  itemRows: AdMetric[];
  storeRows: AdMetric[];
};

export type AffiliateMetric = {
  partnerId: string;
  partnerName: string;
  username: string;
  gmv: number;
  grossItems: number;
  orders: number;
  clicks: number;
  commission: number;
  roi: number;
  buyers: number;
  newBuyers: number;
  raw?: Record<string, unknown>;
};

export type OrderStageSummary = {
  stage: Stage;
  period?: ReportPeriod;
  sales: number;
  salesAfterRebate: number;
  orders: number;
  aov: number;
  productClicks: number;
  visitors: number;
  conversionRate: number;
  canceledOrders: number;
  canceledSales: number;
  refundOrders: number;
  refundSales: number;
  buyers: number;
  newBuyers: number;
  existingBuyers: number;
  potentialBuyers: number;
  repeatPurchaseRate: number;
};

export type TrafficSourceMetric = {
  stage: Stage;
  section: string;
  source: string;
  salesRate: number;
  sales: number;
  impressions: number;
  clicks: number;
  orders: number;
  items: number;
  ctr: number;
  conversionRate: number;
  aov: number;
  buyers: number;
  uniqueImpressions: number;
  uniqueClicks: number;
  raw?: Record<string, unknown>;
};

export type ProductSourceMetric = {
  stage: Stage;
  section: string;
  itemId: string;
  productName: string;
  status?: string;
  salesRate: number;
  sales: number;
  impressions: number;
  clicks: number;
  orders: number;
  items: number;
  ctr: number;
  conversionRate: number;
  aov: number;
  buyers: number;
  uniqueImpressions: number;
  uniqueClicks: number;
  raw?: Record<string, unknown>;
};

export type BusinessInsightsReport = {
  period?: ReportPeriod;
  placed?: OrderStageSummary;
  confirmed?: OrderStageSummary;
  paid?: OrderStageSummary;
  trafficSources: TrafficSourceMetric[];
  productSources: ProductSourceMetric[];
};

export type Quartiles = { p25: number; median: number; p75: number };

export type Benchmarks = {
  ctr: Quartiles;
  bounceRate: Quartiles;
  addToCartRate: Quartiles;
  placedBuyerCr: Quartiles;
  confirmedBuyerCr: Quartiles;
  orderConfirmRate: Quartiles;
  searchClickShare: Quartiles;
  adCtr?: Quartiles;
  adConversionRate?: Quartiles;
  adRoas?: Quartiles;
  adAcos?: Quartiles;
  cohorts: Record<string, number>;
};

export type Diagnosis = {
  primaryProblem: string;
  severity: Severity;
  confidence: number;
  confidenceBand: ConfidenceBand;
  opportunityScore: number;
  summary: string;
  rootCauses: Array<{ code: string; confidence: number; evidence: string }>;
  evidence: string[];
  actions: Array<{ priority: number; action: string; reason: string; metricToWatch: string }>;
  doNotChange: string[];
};

export type MasterProduct = ProductMetric & {
  ad?: AdMetric;
  productUrl?: string;
  diagnosis?: Diagnosis;
};

export type DataWarning = {
  code: string;
  level: "info" | "warning" | "error";
  message: string;
};

export type AnalysisSummary = {
  products: number;
  skuRows: number;
  adsMatched: number;
  storeAdRows: number;
  affiliatePartners: number;
  businessInsightsLoaded: boolean;
  counts: Record<Severity, number>;
  warnings: DataWarning[];
};

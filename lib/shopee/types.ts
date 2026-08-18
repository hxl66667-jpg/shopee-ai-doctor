export type Severity = "P0" | "P1" | "P2" | "SCALE" | "WATCH" | "DATA";

export type ProductMetric = {
  itemId: string;
  productName: string;
  status?: string;
  impressions: number;
  clicks: number;
  ctr: number;
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
  placedBuyers: number;
  confirmedBuyers: number;
  placedBuyerCr: number;
  confirmedBuyerCr: number;
  placedSales: number;
  confirmedSales: number;
  orderConfirmRate: number;
};

export type AdMetric = {
  itemId: string;
  adName: string;
  impressions: number;
  clicks: number;
  ctr: number;
  addToCart: number;
  addToCartRate: number;
  conversions: number;
  conversionRate: number;
  gmv: number;
  expense: number;
  roas: number;
  acos: number;
};

export type AffiliateMetric = {
  partnerId: string;
  partnerName: string;
  username: string;
  gmv: number;
  orders: number;
  clicks: number;
  commission: number;
  roi: number;
  buyers: number;
  newBuyers: number;
};

export type MasterProduct = ProductMetric & {
  ad?: AdMetric;
  productUrl?: string;
  diagnosis?: Diagnosis;
};

export type Diagnosis = {
  primaryProblem: string;
  severity: Severity;
  confidence: number;
  evidence: string[];
  actions: string[];
};

export type Benchmarks = {
  ctr: Quartiles;
  bounceRate: Quartiles;
  addToCartRate: Quartiles;
  placedBuyerCr: Quartiles;
  confirmedBuyerCr: Quartiles;
  orderConfirmRate: Quartiles;
  adCtr?: Quartiles;
  adConversionRate?: Quartiles;
  adRoas?: Quartiles;
};

export type Quartiles = { p25: number; median: number; p75: number };

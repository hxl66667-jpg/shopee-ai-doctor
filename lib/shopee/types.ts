export type Severity = "P0" | "P1" | "P2" | "SCALE" | "WATCH" | "DATA";

export interface ProductMetric {
  itemId: string;
  productName: string;
  status?: string;
  impressions: number;
  clicks: number;
  ctr: number;
  visitors: number;
  addToCartVisitors: number;
  addToCartRate: number;
  placedOrders: number;
  confirmedOrders: number;
  placedBuyerCr: number;
  confirmedBuyerCr: number;
  placedSales: number;
  confirmedSales: number;
  rating?: number;
}

export interface AdMetric {
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
}

export interface AffiliateMetric {
  itemId?: string;
  partnerId: string;
  partnerName: string;
  clicks: number;
  orders: number;
  gmv: number;
  commission: number;
  roi: number;
}

export interface ProductRow extends ProductMetric {
  ad?: AdMetric;
  affiliateGmv?: number;
  affiliateOrders?: number;
}

export interface Quartiles {
  p25: number;
  median: number;
  p75: number;
}

export interface Benchmarks {
  ctr: Quartiles;
  addToCartRate: Quartiles;
  conversionRate: Quartiles;
  roas: Quartiles;
  orderConfirmRate: Quartiles;
}

export interface Diagnosis {
  itemId: string;
  productName: string;
  severity: Severity;
  primaryProblem: string;
  confidence: number;
  opportunityScore: number;
  evidence: string[];
  actions: string[];
  row: ProductRow;
}

export interface AnalysisResult {
  products: ProductRow[];
  diagnoses: Diagnosis[];
  benchmarks: Benchmarks;
  warnings: string[];
  affiliateSummary: {
    partners: number;
    clicks: number;
    orders: number;
    gmv: number;
    commission: number;
  };
}

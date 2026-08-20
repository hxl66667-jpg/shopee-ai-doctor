import type { AdMetric, AffiliateMetric, ProductMetric } from "./types";

export const demoProducts: ProductMetric[] = [
  { itemId: "300000001", productName: "1HP Automatic Jet Pump", status: "Live", impressions: 18500, clicks: 520, ctr: 0.0281, visitors: 468, addToCartVisitors: 39, addToCartRate: 0.0833, placedOrders: 11, confirmedOrders: 9, placedBuyerCr: 0.0235, confirmedBuyerCr: 0.0192, placedSales: 13200, confirmedSales: 10800, rating: 4.7 },
  { itemId: "300000002", productName: "Stainless Steel Jet Pump 0.5HP", status: "Live", impressions: 11200, clicks: 760, ctr: 0.0679, visitors: 690, addToCartVisitors: 88, addToCartRate: 0.1275, placedOrders: 41, confirmedOrders: 37, placedBuyerCr: 0.0594, confirmedBuyerCr: 0.0536, placedSales: 38500, confirmedSales: 34900, rating: 4.9 },
  { itemId: "300000003", productName: "1 Inch Gasoline Water Pump", status: "Live", impressions: 6800, clicks: 430, ctr: 0.0632, visitors: 395, addToCartVisitors: 55, addToCartRate: 0.1392, placedOrders: 27, confirmedOrders: 25, placedBuyerCr: 0.0684, confirmedBuyerCr: 0.0633, placedSales: 45900, confirmedSales: 42500, rating: 4.8 },
  { itemId: "300000004", productName: "2 Stroke Brush Cutter 52CC", status: "Live", impressions: 9700, clicks: 335, ctr: 0.0345, visitors: 310, addToCartVisitors: 21, addToCartRate: 0.0677, placedOrders: 8, confirmedOrders: 6, placedBuyerCr: 0.0258, confirmedBuyerCr: 0.0194, placedSales: 13600, confirmedSales: 10200, rating: 4.5 },
  { itemId: "300000005", productName: "16 Inch Cordless Chainsaw", status: "Live", impressions: 4200, clicks: 360, ctr: 0.0857, visitors: 335, addToCartVisitors: 61, addToCartRate: 0.1821, placedOrders: 32, confirmedOrders: 30, placedBuyerCr: 0.0955, confirmedBuyerCr: 0.0896, placedSales: 65400, confirmedSales: 61200, rating: 4.9 },
  { itemId: "300000006", productName: "New 3 Inch Layflat Water Hose", status: "Live", impressions: 72, clicks: 4, ctr: 0.0556, visitors: 4, addToCartVisitors: 0, addToCartRate: 0, placedOrders: 0, confirmedOrders: 0, placedBuyerCr: 0, confirmedBuyerCr: 0, placedSales: 0, confirmedSales: 0 },
];

export const demoAds: AdMetric[] = [
  { itemId: "300000001", adName: "GMV Max - Jet Pump", impressions: 9200, clicks: 280, ctr: 0.0304, addToCart: 22, addToCartRate: 0.0786, conversions: 7, conversionRate: 0.025, gmv: 8400, expense: 3100, roas: 2.71, acos: 0.369 },
  { itemId: "300000002", adName: "GMV Max - Stainless", impressions: 5100, clicks: 370, ctr: 0.0725, addToCart: 49, addToCartRate: 0.1324, conversions: 23, conversionRate: 0.0622, gmv: 22100, expense: 3900, roas: 5.67, acos: 0.176 },
  { itemId: "300000003", adName: "Search - Gas Pump", impressions: 3300, clicks: 225, ctr: 0.0682, addToCart: 31, addToCartRate: 0.1378, conversions: 15, conversionRate: 0.0667, gmv: 25500, expense: 3900, roas: 6.54, acos: 0.153 },
  { itemId: "300000004", adName: "GMV Max - Cutter", impressions: 5500, clicks: 190, ctr: 0.0345, addToCart: 11, addToCartRate: 0.0579, conversions: 4, conversionRate: 0.0211, gmv: 6800, expense: 2800, roas: 2.43, acos: 0.412 },
  { itemId: "300000005", adName: "GMV Max - Chainsaw", impressions: 2600, clicks: 235, ctr: 0.0904, addToCart: 44, addToCartRate: 0.1872, conversions: 22, conversionRate: 0.0936, gmv: 44800, expense: 5400, roas: 8.3, acos: 0.121 },
];

export const demoAffiliate: AffiliateMetric[] = [
  { itemId: "300000005", partnerId: "A001", partnerName: "ToolReviewPH", clicks: 420, orders: 9, gmv: 18360, commission: 1468.8, roi: 12.5 },
  { itemId: "300000003", partnerId: "A002", partnerName: "FarmLifePH", clicks: 255, orders: 5, gmv: 8500, commission: 680, roi: 12.5 },
];

import type { AnalysisResult } from "@/lib/shopee/types";
import { getSupabaseBrowserClient } from "./client";
import { settlePendingOptimizationTests } from "./optimization";

export async function settleOptimizationTestsForAnalysis(importRunId: string, analysis: AnalysisResult): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !analysis.diagnoses.length) return;

  const itemIds = analysis.diagnoses.map((row) => row.itemId);
  const { data, error } = await supabase
    .from("products")
    .select("id,item_id")
    .in("item_id", itemIds);
  if (error) throw error;

  const productMap = new Map((data ?? []).map((row) => [String(row.item_id), String(row.id)]));
  await settlePendingOptimizationTests({ importRunId, analysis, productMap });
}

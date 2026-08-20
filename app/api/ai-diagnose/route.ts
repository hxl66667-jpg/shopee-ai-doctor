import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const MODEL = "gpt-5.6-luna";

type JsonObject = Record<string, unknown>;

function serverConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, publishableKey };
}

function textFromResponse(payload: JsonObject): string {
  const output = Array.isArray(payload.output) ? payload.output : [];
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as JsonObject).content) ? (item as JsonObject).content as unknown[] : [];
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const typed = block as JsonObject;
      if (typed.type === "output_text" && typeof typed.text === "string") parts.push(typed.text);
    }
  }
  return parts.join("\n").trim();
}

function cleanJsonText(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY 尚未配置，AI 深度诊断暂不可用。" }, { status: 503 });
    }

    const authorization = request.headers.get("authorization") || "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!accessToken) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

    const body = await request.json().catch(() => null) as { importRunId?: string; itemId?: string } | null;
    const importRunId = body?.importRunId?.trim();
    const itemId = body?.itemId?.trim();
    if (!importRunId || !itemId) return NextResponse.json({ error: "缺少诊断记录或 Item ID。" }, { status: 400 });

    const { url, publishableKey } = serverConfig();
    if (!url || !publishableKey) {
      return NextResponse.json({ error: "Supabase 环境变量尚未配置。" }, { status: 503 });
    }

    const supabase = createClient(url, publishableKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) return NextResponse.json({ error: "登录已失效，请重新登录。" }, { status: 401 });

    const { data: diagnosis, error: diagnosisError } = await supabase
      .from("diagnoses")
      .select("id,product_id,primary_problem,severity,confidence,opportunity_score,evidence,actions,ai_analysis,products!inner(item_id,product_name)")
      .eq("import_run_id", importRunId)
      .eq("products.item_id", itemId)
      .single();
    if (diagnosisError || !diagnosis) {
      return NextResponse.json({ error: "没有找到这条已保存的商品诊断。" }, { status: 404 });
    }

    if (diagnosis.ai_analysis && typeof diagnosis.ai_analysis === "object") {
      return NextResponse.json({ analysis: diagnosis.ai_analysis, cached: true, model: MODEL });
    }

    const productId = String(diagnosis.product_id);
    const [metricsResult, adsResult, benchmarkResult] = await Promise.all([
      supabase
        .from("product_metrics")
        .select("impressions,clicks,ctr,visitors,add_to_cart_visitors,add_to_cart_rate,placed_orders,confirmed_orders,placed_buyer_cr,confirmed_buyer_cr,placed_sales,confirmed_sales,order_confirm_rate")
        .eq("import_run_id", importRunId)
        .eq("product_id", productId)
        .maybeSingle(),
      supabase
        .from("ad_metrics")
        .select("ad_name,impressions,clicks,ctr,add_to_cart,add_to_cart_rate,conversions,conversion_rate,gmv,expense,roas,acos")
        .eq("import_run_id", importRunId)
        .eq("product_id", productId),
      supabase
        .from("benchmarks")
        .select("product_benchmarks,ad_benchmarks,cohort_metadata")
        .eq("import_run_id", importRunId)
        .maybeSingle(),
    ]);

    if (metricsResult.error) throw metricsResult.error;
    if (adsResult.error) throw adsResult.error;
    if (benchmarkResult.error) throw benchmarkResult.error;

    const productRelation = Array.isArray(diagnosis.products) ? diagnosis.products[0] : diagnosis.products;
    const structuredInput = {
      market: "Shopee Philippines",
      item: productRelation,
      ruleDiagnosis: {
        severity: diagnosis.severity,
        primaryProblem: diagnosis.primary_problem,
        confidence: diagnosis.confidence,
        opportunityScore: diagnosis.opportunity_score,
        evidence: diagnosis.evidence,
        existingActions: diagnosis.actions,
      },
      productMetrics: metricsResult.data,
      adMetrics: adsResult.data ?? [],
      shopBenchmarks: benchmarkResult.data,
    };

    const prompt = `你是一名专注菲律宾 Shopee 五金、工具、水泵、园林机械品类的资深运营诊断专家。\n\n只根据下方结构化数据做判断，不要虚构前台页面、竞品价格、评价内容、自然灾害或平台政策。若数据不能支持某个结论，必须明确写“需要进一步验证”。\n\n目标：把规则引擎结果升级为运营人员明天就能执行的方案。回答必须使用简体中文，涉及给菲律宾买家看的示例文案时使用英文。\n\n请严格返回 JSON，不要 Markdown，不要代码围栏，结构必须是：\n{\n  "summary": "一句话总结，最多80字",\n  "rootCauses": ["根因1", "根因2", "根因3"],\n  "actions": [\n    {"priority":"P0|P1|P2","action":"具体动作","why":"为什么","expectedImpact":"预期改善的指标"}\n  ],\n  "creativeBrief": {\n    "mainImage": "如果问题与点击有关，给主图修改方向；否则说明暂不优先改主图",\n    "title": "标题优化方向或无需优先修改",\n    "detailPage": "详情页优化方向或无需优先修改"\n  },\n  "abTest": {\n    "variable":"一次只测试一个变量",\n    "control":"对照组",\n    "variant":"实验组",\n    "successMetric":"主观察指标",\n    "minimumWindow":"建议观察周期"\n  },\n  "risks": ["可能误判或需要验证的点"]\n}\n\n结构化数据：\n${JSON.stringify(structuredInput)}`;

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: prompt,
        reasoning: { effort: "low" },
        text: { verbosity: "medium" },
      }),
      cache: "no-store",
    });

    const openaiPayload = await openaiResponse.json().catch(() => ({})) as JsonObject;
    if (!openaiResponse.ok) {
      const apiMessage = typeof (openaiPayload.error as JsonObject | undefined)?.message === "string"
        ? String((openaiPayload.error as JsonObject).message)
        : "OpenAI API 调用失败。";
      return NextResponse.json({ error: apiMessage }, { status: 502 });
    }

    const outputText = textFromResponse(openaiPayload);
    if (!outputText) return NextResponse.json({ error: "AI 没有返回可读取的诊断内容。" }, { status: 502 });

    let analysis: JsonObject;
    try {
      analysis = JSON.parse(cleanJsonText(outputText)) as JsonObject;
    } catch {
      return NextResponse.json({ error: "AI 返回格式异常，请稍后重试。" }, { status: 502 });
    }

    const stored = {
      ...analysis,
      meta: {
        model: MODEL,
        generatedAt: new Date().toISOString(),
        source: "structured-metrics-only",
      },
    };

    const { error: updateError } = await supabase
      .from("diagnoses")
      .update({ ai_analysis: stored })
      .eq("id", diagnosis.id);
    if (updateError) throw updateError;

    return NextResponse.json({ analysis: stored, cached: false, model: MODEL });
  } catch (error) {
    console.error("ai-diagnose", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI 深度诊断失败。" }, { status: 500 });
  }
}

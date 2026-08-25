import { NextResponse } from "next/server";
import { extractReport } from "@/lib/extract-service";
import { getGeminiKeyPreference, getActiveGeminiKey, checkAndRotateGeminiKeyIfNeeded } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { url, model, prompt, includeAi = false } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const activeKey = await getActiveGeminiKey();

    if (!activeKey) {
        const keyIndex = await getGeminiKeyPreference();
        return NextResponse.json({ error: `GEMINI_API_KEY(${keyIndex}) is not configured` }, { status: 500 });
    }

    const text = await extractReport(url, activeKey, model, prompt, !includeAi);

    if (text) {
        await checkAndRotateGeminiKeyIfNeeded(text);
    }

    return NextResponse.json({ result: text });
  } catch (error: any) {
    console.error("Gemini Report Extraction Error:", error);
    await checkAndRotateGeminiKeyIfNeeded(error.message || String(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

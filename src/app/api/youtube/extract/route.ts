import { NextRequest, NextResponse } from "next/server";
import { extractYoutube } from "@/lib/extract-service";
import { getGeminiApiKeys } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, model: requestedModel, prompt: requestedPrompt } = body;

    if (!url || (!url.includes("youtube.com") && !url.includes("youtu.be"))) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    const apiKeys = await getGeminiApiKeys();
    const activeKey = apiKeys.find(k => k.is_active)?.key_value || process.env.GEMINI_API_KEY;

    if (!activeKey) {
        return NextResponse.json(
            { error: "GEMINI_API_KEY is not configured" },
            { status: 500 }
        );
    }

    const data = await extractYoutube(url, activeKey, requestedModel, requestedPrompt);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("YouTube Extraction error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to extract YouTube video information" },
      { status: 500 }
    );
  }
}

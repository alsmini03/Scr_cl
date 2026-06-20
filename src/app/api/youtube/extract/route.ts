import { NextRequest, NextResponse } from "next/server";
import { extractYoutube } from "@/lib/extract-service";

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

    const data = await extractYoutube(url, requestedModel, requestedPrompt);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("YouTube Extraction error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to extract YouTube video information" },
      { status: 500 }
    );
  }
}

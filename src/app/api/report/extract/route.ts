import { NextResponse } from "next/server";
import { extractReport } from "@/lib/extract-service";
import { getGeminiApiKeys } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { url, model, prompt } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // SSRF Protection: Validate URL
    const allowedDomains = ["www.bondweb.co.kr", "bondweb.co.kr"];
    try {
        const parsedUrl = new URL(url);
        const host = req.headers.get('host') || '';
        const referer = req.headers.get('referer') || '';
        let refererHost = '';
        try { refererHost = referer ? new URL(referer).host : ''; } catch(e) {}

        const isLocal = (host && parsedUrl.host === host) ||
                        (refererHost && parsedUrl.host === refererHost) ||
                        (parsedUrl.hostname.endsWith('.netlify.app'));

        if (!allowedDomains.includes(parsedUrl.hostname) && !isLocal) {
            return NextResponse.json({ error: `Invalid domain: ${parsedUrl.hostname}. Only bondweb.co.kr or local origin is allowed.` }, { status: 403 });
        }
    } catch (e) {
        return NextResponse.json({ error: "Invalid URL format." }, { status: 400 });
    }

    const apiKeys = await getGeminiApiKeys();
    const activeKey = apiKeys.find(k => k.is_active)?.key_value || process.env.GEMINI_API_KEY;

    if (!activeKey) {
        return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const text = await extractReport(url, activeKey, model, prompt);

    return NextResponse.json({ result: text });
  } catch (error: any) {
    console.error("Gemini Report Extraction Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

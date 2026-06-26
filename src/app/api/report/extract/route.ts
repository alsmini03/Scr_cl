import { NextResponse } from "next/server";
import { extractReport } from "@/lib/extract-service";
import { getGeminiKeyPreference } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { url, model, prompt, includeAi = false } = await req.json();

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

    const keyIndex = await getGeminiKeyPreference();
    const activeKey =
        keyIndex === 5 ? process.env.GEMINI_API_KEY_5 :
        keyIndex === 4 ? process.env.GEMINI_API_KEY_4 :
        keyIndex === 3 ? process.env.GEMINI_API_KEY_3 :
        keyIndex === 2 ? process.env.GEMINI_API_KEY_2 :
        process.env.GEMINI_API_KEY;

    if (!activeKey) {
        return NextResponse.json({ error: `GEMINI_API_KEY(${keyIndex}) is not configured` }, { status: 500 });
    }

    const text = await extractReport(url, activeKey, model, prompt, !includeAi);

    return NextResponse.json({ result: text });
  } catch (error: any) {
    console.error("Gemini Report Extraction Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

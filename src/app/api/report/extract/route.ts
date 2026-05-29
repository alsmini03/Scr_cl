import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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
        // Also allow current deployment origin
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

    // 1. Fetch the PDF
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch PDF from ${url}`);
    }
    const pdfBuffer = await response.arrayBuffer();

    // Check for PDF signature (%PDF-)
    const buffer = Buffer.from(pdfBuffer);
    const signature = buffer.slice(0, 5).toString('ascii');
    if (signature !== '%PDF-') {
        // It might be an HTML error page from Bondweb
        const contentSample = buffer.slice(0, 500).toString('utf8');
        if (contentSample.includes('<html') || contentSample.includes('<HTML')) {
            throw new Error("유효한 PDF 파일이 아닙니다. (Bondweb 세션 만료 또는 접근 권한 오류)");
        }
        throw new Error("올바른 PDF 형식이 아닙니다.");
    }

    const base64Pdf = buffer.toString("base64");

    // 2. Initialize Gemini model
    const geminiModel = genAI.getGenerativeModel({ model: model || "gemini-1.5-flash" });

    // 3. Generate content with PDF data
    const result = await geminiModel.generateContent([
      prompt || "이 리포트를 요약하고 핵심 내용을 분석해 주세요.",
      {
        inlineData: {
          data: base64Pdf,
          mimeType: "application/pdf",
        },
      },
    ]);

    const text = result.response.text();

    return NextResponse.json({ result: text });
  } catch (error: any) {
    console.error("Gemini Report Extraction Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

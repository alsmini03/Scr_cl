import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      page = 1,
      pageSize = 20,
      srhWord = '',
      url = 'company'
    } = body;

    // Determine category from url or category parameter
    let category = 'company';
    if (url.includes('industry')) category = 'industry';
    else if (url.includes('market')) category = 'market';
    else if (url.includes('invest')) category = 'invest';
    else if (url.includes('economy')) category = 'economy';
    else if (url.includes('debenture')) category = 'debenture';
    else if (['company', 'industry', 'market', 'invest', 'economy', 'debenture'].includes(url)) {
      category = url;
    }

    const apiUrl = `https://m.stock.naver.com/api/research/${category}?page=${page}&pageSize=${pageSize}`;

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      },
    });

    if (!response.ok) {
      throw new Error(`Naver Research API error: ${response.status}`);
    }

    const rawData = await response.json();
    if (!Array.isArray(rawData)) {
      return NextResponse.json([]);
    }

    // Filter by srhWord if provided
    let filteredData = rawData;
    if (srhWord && srhWord.trim()) {
      const keyword = srhWord.trim().toLowerCase();
      filteredData = rawData.filter((item: any) =>
        (item.title && item.title.toLowerCase().includes(keyword)) ||
        (item.brokerName && item.brokerName.toLowerCase().includes(keyword)) ||
        (item.itemName && item.itemName.toLowerCase().includes(keyword))
      );
    }

    const reports = filteredData.map((item: any) => ({
      id: String(item.researchId),
      researchId: String(item.researchId),
      category: category,
      itemCode: item.itemCode || '',
      itemName: item.itemName || '',
      index: String(item.researchId),
      date: item.writeDate || '',
      title: item.title || '',
      author: item.brokerName || '',
      institution: item.brokerName || '',
      fileId: String(item.researchId),
      fileNum: category,
      hasFile: true,
      fileSize: 'PDF',
      url: item.endUrl || `https://m.stock.naver.com/investment/research/${category}/${item.researchId}`
    }));

    return NextResponse.json(reports);
  } catch (error: any) {
    console.error('Report fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

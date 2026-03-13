import { NextRequest, NextResponse } from "next/server";
import { getBlogPosts } from "@/lib/naver";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const blogIdParam = searchParams.get("blogId") || "totcar";
    const blogIds = blogIdParam.split(',');

    let allPosts: any[] = [];

    for (const idOrUrl of blogIds) {
        const posts = await getBlogPosts(idOrUrl);
        allPosts = [...allPosts, ...posts];
    }

    return NextResponse.json({ posts: allPosts });
  } catch (error: any) {
    console.error("Blog List Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

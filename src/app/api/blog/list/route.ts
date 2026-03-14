import { NextRequest, NextResponse } from "next/server";
import { getBlogPosts } from "@/lib/blog";

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

    // Sort by publication date (newest first)
    allPosts.sort((a, b) => {
        const dateA = new Date(a.published_at).getTime();
        const dateB = new Date(b.published_at).getTime();
        return dateB - dateA;
    });

    return NextResponse.json({ posts: allPosts });
  } catch (error: any) {
    console.error("Blog List Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

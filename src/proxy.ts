import authConfig from "./auth.config";
import NextAuth from "next-auth";

const { auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  ...authConfig,
});

export const proxy = auth;
export default auth;

export const config = {
  matcher: [
    "/((?!api/init|api/extract|api/blog/extract|api/blog/list|api/report|api/report/content|api/youtube/extract|api/youtube/recommend|api/migrate|best|blog|report|youtube/recommend|login|_next/static|_next/image|favicon.ico|$).*)",
  ],
};

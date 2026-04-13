import authConfig from "./auth.config";
import NextAuth from "next-auth";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    "/((?!api/init|api/extract|api/blog/extract|api/blog/list|api/report|api/youtube/extract|api/youtube/recommend|api/migrate|login|_next/static|_next/image|favicon.ico).*)",
  ],
};

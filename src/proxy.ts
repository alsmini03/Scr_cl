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
    "/((?!api/extract|api/youtube/extract|login|_next/static|_next/image|favicon.ico|$).*)",
  ],
};

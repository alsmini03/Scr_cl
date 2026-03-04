import authConfig from "./auth.config";
import NextAuth from "next-auth";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/((?!api/extract|login|_next/static|_next/image|favicon.ico|$).*)",
  ],
};

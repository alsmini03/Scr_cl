import authConfig from "./auth.config";
import NextAuth from "next-auth";

const { auth } = NextAuth(authConfig);

export const proxy = auth;
export default auth;

export const config = {
  matcher: [
    "/((?!api/extract|login|_next/static|_next/image|favicon.ico|$).*)",
  ],
};

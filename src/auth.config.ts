import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

export default {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.isApproved = user.is_approved ?? false;
      }
      return token;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith('/login');
      const isApiAuth = nextUrl.pathname.startsWith('/api/auth');
      const isPublicAsset = nextUrl.pathname.startsWith('/_next') ||
                          nextUrl.pathname.startsWith('/favicon.ico') ||
                          nextUrl.pathname.startsWith('/icons/');
      const isHome = nextUrl.pathname === '/';

      if (isApiAuth || isPublicAsset) return true;
      if (isHome) return true;

      if (!isLoggedIn && !isAuthPage) {
        return Response.redirect(new URL('/login', nextUrl));
      }

      if (isLoggedIn && isAuthPage) {
        return Response.redirect(new URL('/', nextUrl));
      }

      return true;
    },
  },
  pages: {
    signIn: '/login',
  },
} satisfies NextAuthConfig;

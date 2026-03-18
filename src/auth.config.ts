import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

export default {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.send",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.email!; // Use email as user ID in JWT
        // user object might have isApproved or is_approved depending on how it's fetched
        token.isApproved = (user as any).isApproved || (user as any).is_approved || false;
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
      const isDev = process.env.NODE_ENV === 'development';

      if (isApiAuth || isPublicAsset) return true;
      if (isHome || (isDev && nextUrl.pathname.startsWith('/add'))) return true;

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

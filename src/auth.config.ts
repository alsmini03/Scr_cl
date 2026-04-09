import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

export default {
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
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
        token.id = user.id!; // Use actual database ID (UUID)
        token.email = user.email!;
        // Use more robust parsing for isApproved
        const rawApproved = (user as any).isApproved ?? (user as any).is_approved;
        token.isApproved = rawApproved === true || rawApproved === 'true' || user.email === 'alsmini03@gmail.com';
      }
      return token;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isApproved = (auth?.user as any)?.isApproved;
      const isAuthPage = nextUrl.pathname.startsWith('/login');
      const isApiAuth = nextUrl.pathname.startsWith('/api/auth');
      const isPublicAsset = nextUrl.pathname.startsWith('/_next') ||
                          nextUrl.pathname.startsWith('/favicon.ico') ||
                          nextUrl.pathname.startsWith('/icons/');

      if (isApiAuth || isPublicAsset) return true;

      if (!isLoggedIn && !isAuthPage) {
        return Response.redirect(new URL('/login', nextUrl));
      }

      if (isLoggedIn && isAuthPage) {
        return Response.redirect(new URL('/', nextUrl));
      }

      // If logged in but not approved, and not on login page, we should restrict
      // but standard authorized callback might not be the best place for "Approval" check
      // if we want to show a specific "unapproved" state.
      // For now, we strictly require isApproved for all non-auth pages if logged in.
      if (isLoggedIn && !isApproved && !isAuthPage) {
        // We could redirect to a /pending page, but per request "only approved can use",
        // so we treat unapproved as "unauthorized".
        return false;
      }

      return true;
    },
  },
  pages: {
    signIn: '/login',
  },
} satisfies NextAuthConfig;

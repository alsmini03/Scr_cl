import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PostgresAdapter } from "@auth/pg-adapter";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PostgresAdapter(pool),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith('/login');
      const isApiAuth = nextUrl.pathname.startsWith('/api/auth');
      const isPublicAsset = nextUrl.pathname.startsWith('/_next') || nextUrl.pathname.includes('.');

      if (isApiAuth || isPublicAsset) return true;

      if (!isLoggedIn && !isAuthPage) {
        return Response.redirect(new URL('/login', nextUrl));
      }

      if (isLoggedIn && isAuthPage) {
        return Response.redirect(new URL('/', nextUrl));
      }

      return true;
    },
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});

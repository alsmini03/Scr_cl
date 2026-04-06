import NextAuth from "next-auth";
import PostgresAdapter from "@auth/pg-adapter";
import pool from "./lib/pg";
import authConfig from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PostgresAdapter(pool),
  session: { strategy: "jwt" },
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.isApproved = !!token.isApproved;
      }
      return session;
    },
  },
});

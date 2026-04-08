import NextAuth from "next-auth";
import PostgresAdapter from "@auth/pg-adapter";
import pool from "./lib/pg";
import authConfig from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PostgresAdapter(pool),
  session: { strategy: "jwt" },
  ...authConfig,
  events: {
    async signIn({ user, account }) {
      if (account && user.id) {
        // Sync account tokens to database on every sign-in to ensure we have fresh tokens
        // especially when re-logging in to fix token issues.
        try {
          await pool.query(
            `UPDATE accounts
             SET access_token = $1, expires_at = $2, refresh_token = COALESCE($3, refresh_token)
             WHERE "userId" = $4 AND provider = $5`,
            [
              account.access_token,
              account.expires_at,
              account.refresh_token,
              user.id,
              account.provider
            ]
          );
        } catch (error) {
          console.error("Failed to sync account tokens on sign-in:", error);
        }
      }
    }
  },
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

import NextAuth from "next-auth";
import PostgresAdapter from "@auth/pg-adapter";
import { Pool } from "pg";
import authConfig from "./auth.config";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PostgresAdapter(pool),
  session: { strategy: "jwt" },
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isApproved = token.isApproved as boolean;
      }
      return session;
    },
  },
});

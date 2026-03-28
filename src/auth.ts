import NextAuth from "next-auth";
import { AirtableAdapter } from "./lib/airtable-adapter";
import authConfig from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: AirtableAdapter(),
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

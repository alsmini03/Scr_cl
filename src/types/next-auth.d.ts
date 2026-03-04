import "next-auth";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isApproved: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    is_approved?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    isApproved: boolean;
  }
}

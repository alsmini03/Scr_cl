import { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from "next-auth/adapters";
import { findRecord, findRecords, createRecord, updateRecord, deleteRecord } from "./airtable";

export function AirtableAdapter(): Adapter {
  return {
    async createUser(user) {
      const id = crypto.randomUUID();
      const record = await createRecord("users", {
        ...user,
        id,
        is_approved: user.email === 'alsmini03@gmail.com'
      });
      return { ...record, id: record.id } as AdapterUser;
    },
    async getUser(id) {
      const record = await findRecord("users", `{id} = '${id}'`);
      if (!record) return null;
      return { ...record, id: record.id } as AdapterUser;
    },
    async getUserByEmail(email) {
      const record = await findRecord("users", `{email} = '${email}'`);
      if (!record) return null;
      return { ...record, id: record.id } as AdapterUser;
    },
    async getUserByAccount({ providerAccountId, provider }) {
      const account = await findRecord("accounts", `AND({providerAccountId} = '${providerAccountId}', {provider} = '${provider}')`);
      if (!account) return null;
      const user = await findRecord("users", `{id} = '${account.userId}'`);
      if (!user) return null;
      return { ...user, id: user.id } as AdapterUser;
    },
    async updateUser(user) {
      const record = await updateRecord("users", user.id!, user);
      return { ...record, id: record.id } as AdapterUser;
    },
    async deleteUser(userId) {
      await deleteRecord("users", userId);
    },
    async linkAccount(account) {
      const id = crypto.randomUUID();
      await createRecord("accounts", { ...account, id });
      return account as AdapterAccount;
    },
    async unlinkAccount({ providerAccountId, provider }) {
      const account = await findRecord("accounts", `AND({providerAccountId} = '${providerAccountId}', {provider} = '${provider}')`);
      if (account) {
        await deleteRecord("accounts", account.id);
      }
    },
    async createSession({ sessionToken, userId, expires }) {
      const id = crypto.randomUUID();
      const record = await createRecord("sessions", {
        id,
        sessionToken,
        userId,
        expires: expires.toISOString()
      });
      return { ...record, expires: new Date(record.expires) } as AdapterSession;
    },
    async getSessionAndUser(sessionToken) {
      const sessionRecord = await findRecord("sessions", `{sessionToken} = '${sessionToken}'`);
      if (!sessionRecord) return null;
      const userRecord = await findRecord("users", `{id} = '${sessionRecord.userId}'`);
      if (!userRecord) return null;
      return {
        session: { ...sessionRecord, expires: new Date(sessionRecord.expires) } as AdapterSession,
        user: { ...userRecord, id: userRecord.id } as AdapterUser,
      };
    },
    async updateSession(session) {
      const record = await updateRecord("sessions", session.sessionToken, {
        ...session,
        expires: session.expires?.toISOString()
      });
      return { ...record, expires: new Date(record.expires) } as AdapterSession;
    },
    async deleteSession(sessionToken) {
      const session = await findRecord("sessions", `{sessionToken} = '${sessionToken}'`);
      if (session) {
        await deleteRecord("sessions", session.id);
      }
    },
    async createVerificationToken(verificationToken) {
      await createRecord("verification_tokens", {
        ...verificationToken,
        expires: verificationToken.expires.toISOString()
      });
      return verificationToken;
    },
    async useVerificationToken({ identifier, token }) {
      const record = await findRecord("verification_tokens", `AND({identifier} = '${identifier}', {token} = '${token}')`);
      if (!record) return null;
      await deleteRecord("verification_tokens", record.airtable_id);
      return { ...record, expires: new Date(record.expires) } as VerificationToken;
    },
  };
}

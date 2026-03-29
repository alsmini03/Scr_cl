import { getYes24Tabs, getBooks, batchDeleteBooksAction as batchDeleteBooks } from '@/lib/db';
import { auth } from '@/auth';
import BestClient from '@/components/BestClient';

export default async function BestPage() {
  const [session, tabs, books] = await Promise.all([
    auth(),
    getYes24Tabs(),
    getBooks()
  ]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <BestClient
      session={session}
      initialTabs={tabs}
      initialBooks={books}
      isDev={isDev}
      actions={{
        batchDeleteBooks
      }}
    />
  );
}

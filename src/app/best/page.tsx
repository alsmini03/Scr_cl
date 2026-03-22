import { getYes24Tabs } from '@/lib/db';
import { auth } from '@/auth';
import BestClient from '@/components/BestClient';

export default async function BestPage() {
  const [session, tabs] = await Promise.all([
    auth(),
    getYes24Tabs()
  ]);

  return (
    <BestClient
      session={session}
      initialTabs={tabs}
    />
  );
}

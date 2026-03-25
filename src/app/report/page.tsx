import { auth } from '@/auth';
import { getReportTabs } from '@/lib/db';
import ReportClient from '@/components/ReportClient';

export default async function ReportPage() {
  const [session, tabs] = await Promise.all([
    auth(),
    getReportTabs()
  ]);

  return (
    <ReportClient
      session={session}
      initialTabs={tabs}
    />
  );
}

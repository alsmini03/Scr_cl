import { auth } from '@/auth';
import { getReportTabs, getReports } from '@/lib/db';
import ReportClient from '@/components/ReportClient';

export default async function ReportPage() {
  const [session, tabs, savedReports] = await Promise.all([
    auth(),
    getReportTabs(),
    getReports()
  ]);

  return (
    <ReportClient
      session={session}
      initialTabs={tabs}
      initialSavedReports={savedReports}
    />
  );
}

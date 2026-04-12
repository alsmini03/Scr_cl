import { auth } from '@/auth';
import { getReportTabs, getReports } from '@/lib/db';
import ReportClient from '@/components/ReportClient';
import { Suspense } from 'react';

export default async function ReportPage() {
  const [session, tabs, savedReports] = await Promise.all([
    auth(),
    getReportTabs(),
    getReports()
  ]);

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
      <ReportClient
        session={session}
        initialTabs={tabs}
        initialSavedReports={savedReports}
      />
    </Suspense>
  );
}

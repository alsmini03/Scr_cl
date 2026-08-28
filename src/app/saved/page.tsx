import { getBlogs, getYoutubeVideos, getReports, getBooks, getQueueItems } from '@/lib/db';
import { auth } from '@/auth';
import SavedClient from '@/components/SavedClient';

export default async function SavedPage() {
  console.log('[SavedPage] Starting SavedPage request');
  let session = null;
  try {
    session = await auth();
  } catch (err: any) {
    console.error('[SavedPage] auth() error:', err.message, err.stack);
  }

  const user = session?.user;
  console.log('[SavedPage] Authenticated user:', user?.email || user?.id || 'anonymous');

  const [blogs, youtubeVideos, reports, books, queueResult] = await Promise.all([
    getBlogs(user, true).catch(err => {
      console.error('[SavedPage] getBlogs error:', err.message, err.stack);
      return [];
    }),
    getYoutubeVideos(user, true).catch(err => {
      console.error('[SavedPage] getYoutubeVideos error:', err.message, err.stack);
      return [];
    }),
    getReports(user, true).catch(err => {
      console.error('[SavedPage] getReports error:', err.message, err.stack);
      return [];
    }),
    getBooks(user, true).catch(err => {
      console.error('[SavedPage] getBooks error:', err.message, err.stack);
      return [];
    }),
    getQueueItems().catch(err => {
      console.error('[SavedPage] getQueueItems error:', err.message, err.stack);
      return { items: [], lastProcessedAt: null };
    })
  ]);

  const queueItems = queueResult?.items || [];

  // Transform and combine items
  const combinedItems = [
    ...blogs.map(item => ({ ...item, type: 'blog' })),
    ...youtubeVideos.map(item => ({ ...item, type: 'youtube' })),
    ...reports.map(item => ({ ...item, type: 'report' })),
    ...books.map(item => ({ ...item, type: 'book' }))
  ].sort((a, b) => {
    return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
  });

  return (
    <SavedClient
      session={session}
      initialItems={combinedItems}
      initialQueueItems={queueItems}
    />
  );
}

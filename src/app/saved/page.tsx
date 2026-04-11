import { getBlogs, getYoutubeVideos, getReports } from '@/lib/db';
import { auth } from '@/auth';
import SavedClient from '@/components/SavedClient';

export default async function SavedPage() {
  const [session, blogs, youtubeVideos, reports] = await Promise.all([
    auth(),
    getBlogs(),
    getYoutubeVideos(),
    getReports()
  ]);

  // Transform and combine items
  const combinedItems = [
    ...blogs.map(item => ({ ...item, type: 'blog' })),
    ...youtubeVideos.map(item => ({ ...item, type: 'youtube' })),
    ...reports.map(item => ({ ...item, type: 'report' }))
  ].sort((a, b) => {
    return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
  });

  return (
    <SavedClient
      session={session}
      initialItems={combinedItems}
    />
  );
}

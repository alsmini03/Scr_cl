import { getBlogs, getYoutubeVideos, getReports } from '@/lib/db';
import { auth } from '@/auth';
import SavedClient from '@/components/SavedClient';

export default async function SavedPage() {
  const session = await auth();
  const user = session?.user;

  const [blogs, youtubeVideos, reports] = await Promise.all([
    getBlogs(user),
    getYoutubeVideos(user),
    getReports(user)
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

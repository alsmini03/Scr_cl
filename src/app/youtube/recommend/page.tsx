import { getYoutubeVideos, getYoutubeTabs } from '@/lib/db';
import { auth } from '@/auth';
import YouTubeRecommendClient from '@/components/YouTubeRecommendClient';

export default async function YouTubeRecommendPage() {
  const [session, videos, tabs] = await Promise.all([
    auth(),
    getYoutubeVideos(),
    getYoutubeTabs()
  ]);

  return (
    <YouTubeRecommendClient
      session={session}
      initialVideos={videos}
      initialTabs={tabs}
    />
  );
}

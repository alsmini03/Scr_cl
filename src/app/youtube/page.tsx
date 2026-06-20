import { getYoutubeVideos } from '@/lib/db';
import { auth } from '@/auth';
import YoutubeRecordsClient from '@/components/YoutubeRecordsClient';

export default async function YoutubeListPage() {
  const session = await auth();
  const videos = await getYoutubeVideos();

  return (
    <YoutubeRecordsClient
      session={session}
      initialVideos={videos}
    />
  );
}

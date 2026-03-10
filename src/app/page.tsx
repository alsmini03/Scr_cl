import { getBooks, getYoutubeVideos, batchDeleteBooks, batchDeleteYoutubeVideos } from '@/lib/db';
import { auth } from '@/auth';
import ClientLibrary from '@/components/ClientLibrary';

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; view?: string }>;
}) {
  const sessionPromise = auth();
  const booksPromise = getBooks();
  const youtubePromise = getYoutubeVideos();
  const { mode: modeParam, view: viewParam } = await searchParams;

  const [session, books, youtubeVideos] = await Promise.all([
    sessionPromise,
    booksPromise,
    youtubePromise
  ]);

  const mode = modeParam || 'books';
  const youtubeView = viewParam || '1';

  // Bypass login for development if needed, but for visual verification we might need to mock it
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <ClientLibrary
      session={session}
      books={books}
      youtubeVideos={youtubeVideos}
      mode={mode}
      youtubeView={youtubeView}
      isDev={isDev}
      actions={{
        batchDeleteBooks,
        batchDeleteYoutubeVideos
      }}
    />
  );
}

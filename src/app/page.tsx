import { getBooks, getYoutubeVideos, batchDeleteBooks, batchDeleteYoutubeVideos } from '@/lib/db';
import { auth } from '@/auth';
import ClientLibrary from '@/components/ClientLibrary';

export default async function LibraryPage() {
  const sessionPromise = auth();
  const booksPromise = getBooks();

  const [session, books] = await Promise.all([
    sessionPromise,
    booksPromise
  ]);

  // Bypass login for development if needed, but for visual verification we might need to mock it
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <ClientLibrary
      session={session}
      books={books}
      isDev={isDev}
      actions={{
        batchDeleteBooks
      }}
    />
  );
}

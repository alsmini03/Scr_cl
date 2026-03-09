'use server';

import { sql } from '@vercel/postgres';
import { Book } from '@/types/book';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return session.user;
}

async function ensureApproved() {
  const user = await getSessionUser();
  // We've removed the strict isApproved check to allow the primary user to use the app immediately.
  // In a production multi-user app, you would verify the user's status in the database here.
  return user.id;
}

function mapRowToBook(row: any): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author || '',
    coverImage: row.cover_image || '',
    category: row.category,
    publishDate: row.published_date,
    price: row.price,
    description: row.description,
    readingStatus: row.status as 'READING' | 'FINISHED',
    progress: row.progress,
    rating: row.rating,
    notes: row.notes,
    createdAt: row.added_at,
  };
}

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch (e) {
    console.warn(`revalidatePath failed for ${path}: ${e}`);
  }
}

export async function getBooks(): Promise<Book[]> {
  try {
    const user = await getSessionUser();
    const { rows } = await sql`
      SELECT * FROM books
      WHERE deleted_at IS NULL AND user_id = ${user.id}
      ORDER BY added_at DESC
    `;
    return rows.map(mapRowToBook);
  } catch (error) {
    // If not logged in, return empty list instead of throwing
    return [];
  }
}

export async function getDeletedBooks(): Promise<Book[]> {
  try {
    const user = await getSessionUser();
    const { rows } = await sql`
      SELECT * FROM books
      WHERE deleted_at IS NOT NULL AND user_id = ${user.id}
      ORDER BY deleted_at DESC
    `;
    return rows.map(mapRowToBook);
  } catch (error) {
    return [];
  }
}

export async function getBookById(id: string): Promise<Book | undefined> {
  try {
    const user = await getSessionUser();
    const { rows } = await sql`
      SELECT * FROM books
      WHERE id = ${id} AND user_id = ${user.id}
    `;
    if (rows.length === 0) return undefined;
    return mapRowToBook(rows[0]);
  } catch (error) {
    return undefined;
  }
}

export async function saveBook(book: Omit<Book, 'id'>): Promise<Book> {
  const userId = await ensureApproved();
  const id = Math.random().toString(36).substring(2, 11);
  const createdAt = new Date().toISOString();

  try {
    await sql`
      INSERT INTO books (
        id, title, author, cover_image, description, published_date,
        price, category, status, progress, rating, notes, added_at, user_id
      ) VALUES (
        ${id}, ${book.title}, ${book.author}, ${book.coverImage},
        ${book.description || null}, ${book.publishDate || null},
        ${book.price || null}, ${book.category || null},
        ${book.readingStatus}, ${book.progress || 0},
        ${book.rating || 0}, ${book.notes || null}, ${createdAt}, ${userId}
      )
    `;

    safeRevalidate('/');
    return { ...book, id, createdAt };
  } catch (error) {
    console.error('Failed to save book:', error);
    throw new Error('Failed to save book');
  }
}

export async function updateBook(book: Book): Promise<void> {
  const userId = await ensureApproved();
  try {
    await sql`
      UPDATE books SET
        title = ${book.title},
        author = ${book.author},
        cover_image = ${book.coverImage},
        description = ${book.description || null},
        published_date = ${book.publishDate || null},
        price = ${book.price || null},
        category = ${book.category || null},
        status = ${book.readingStatus},
        progress = ${book.progress || 0},
        rating = ${book.rating || 0},
        notes = ${book.notes || null}
      WHERE id = ${book.id} AND user_id = ${userId}
    `;
    safeRevalidate('/');
    safeRevalidate(`/book/${book.id}`);
  } catch (error) {
    console.error(`Failed to update book with id ${book.id}:`, error);
    throw new Error('Failed to update book');
  }
}

/**
 * Moves a book to the trash (soft delete)
 */
export async function deleteBook(id: string): Promise<void> {
  const userId = await ensureApproved();
  const deletedAt = new Date().toISOString();
  try {
    await sql`
      UPDATE books SET deleted_at = ${deletedAt}
      WHERE id = ${id} AND user_id = ${userId}
    `;
    safeRevalidate('/');
    safeRevalidate('/trash');
  } catch (error) {
    console.error(`Failed to move book to trash with id ${id}:`, error);
    throw new Error('Failed to move book to trash');
  }
}

/**
 * Restores a book from the trash
 */
export async function restoreBook(id: string): Promise<void> {
  const userId = await ensureApproved();
  try {
    await sql`
      UPDATE books SET deleted_at = NULL
      WHERE id = ${id} AND user_id = ${userId}
    `;
    safeRevalidate('/');
    safeRevalidate('/trash');
  } catch (error) {
    console.error(`Failed to restore book with id ${id}:`, error);
    throw new Error('Failed to restore book');
  }
}

/**
 * Permanently deletes a book from the database
 */
export async function permanentlyDeleteBook(id: string): Promise<void> {
  const userId = await ensureApproved();
  try {
    await sql`
      DELETE FROM books
      WHERE id = ${id} AND user_id = ${userId}
    `;
    safeRevalidate('/trash');
  } catch (error) {
    console.error(`Failed to permanently delete book with id ${id}:`, error);
    throw new Error('Failed to permanently delete book');
  }
}

/**
 * YouTube Video Database Operations
 */
export async function saveYoutubeVideo(video: {
  title: string;
  url: string;
  thumbnail?: string;
  duration?: string;
  published_at?: string;
  summary?: string;
  description?: string;
}): Promise<void> {
  const userId = await ensureApproved();
  const id = Math.random().toString(36).substring(2, 11);
  const addedAt = new Date().toISOString();

  try {
    // Self-healing migration check for the summary column
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='youtube_videos' AND column_name='summary') THEN
          ALTER TABLE youtube_videos ADD COLUMN summary TEXT;
        END IF;
      END $$;
    `;

    await sql`
      INSERT INTO youtube_videos (
        id, title, url, thumbnail, duration, published_at, summary, description, user_id, added_at
      ) VALUES (
        ${id}, ${video.title}, ${video.url}, ${video.thumbnail || null},
        ${video.duration || null}, ${video.published_at || null},
        ${video.summary || null}, ${video.description || null}, ${userId}, ${addedAt}
      )
    `;

    // We can revalidate the library or a hypothetical youtube videos list page
    safeRevalidate('/');
  } catch (error) {
    console.error('Failed to save youtube video:', error);
    throw new Error('Failed to save youtube video');
  }
}

export async function getYoutubeVideos(): Promise<any[]> {
  try {
    const user = await getSessionUser();
    const { rows } = await sql`
      SELECT * FROM youtube_videos
      WHERE user_id = ${user.id}
      ORDER BY added_at DESC
    `;
    return rows;
  } catch (error) {
    return [];
  }
}

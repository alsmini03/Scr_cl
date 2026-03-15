'use server';

import { sql } from '@vercel/postgres';
import { Book } from '@/types/book';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) {
    if (process.env.NODE_ENV === 'development') {
      return { id: 'alsmini03@gmail.com', isApproved: true };
    }
    throw new Error('Unauthorized');
  }
  return session.user;
}

async function ensureApproved() {
  const user = await getSessionUser();

  // Strict isApproved check as per user requirements.
  // Only the primary user (admin) or approved users should be able to register books.
  if (!user.isApproved) {
    throw new Error('권한이 없습니다. 관리자의 승인이 필요합니다.');
  }

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
    intro: row.intro,
    toc: row.toc,
    authorIntro: row.author_intro,
    inside: row.inside,
    publisherReview: row.publisher_review,
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

export async function getBlogTabs(): Promise<any[]> {
  try {
    const user = await getSessionUser();
    const { rows } = await sql`
      SELECT * FROM blog_tabs
      WHERE user_id = ${user.id}
      ORDER BY position ASC, created_at ASC
    `;
    return rows;
  } catch (error) {
    return [];
  }
}

export async function addBlogTab(name: string, url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    const id = crypto.randomUUID();

    const { rows } = await sql`SELECT COALESCE(MAX(position), -1) as max_pos FROM blog_tabs WHERE user_id = ${userId}`;
    const nextPos = rows[0].max_pos + 1;

    await sql`
      INSERT INTO blog_tabs (id, user_id, name, url, position)
      VALUES (${id}, ${userId}, ${name}, ${url}, ${nextPos})
    `;
    safeRevalidate('/blog');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function batchDeleteBlogs(ids: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    if (ids.length === 0) return { success: true };

    await sql`
      DELETE FROM naver_blogs
      WHERE user_id = ${userId} AND id = ANY(${ids as any})
    `;

    safeRevalidate('/blog');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to batch delete blogs:', error);
    return { success: false, error: error.message || '다중 삭제 중 오류가 발생했습니다.' };
  }
}

/**
 * Yes24 Tabs
 */
export async function getYes24Tabs(): Promise<any[]> {
  try {
    const user = await getSessionUser();
    const { rows } = await sql`
      SELECT * FROM yes24_tabs
      WHERE user_id = ${user.id}
      ORDER BY position ASC, created_at ASC
    `;
    return rows;
  } catch (error) {
    return [];
  }
}

export async function addYes24Tab(name: string, url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    const id = crypto.randomUUID();

    const { rows } = await sql`SELECT COALESCE(MAX(position), -1) as max_pos FROM yes24_tabs WHERE user_id = ${userId}`;
    const nextPos = rows[0].max_pos + 1;

    await sql`
      INSERT INTO yes24_tabs (id, user_id, name, url, position)
      VALUES (${id}, ${userId}, ${name}, ${url}, ${nextPos})
    `;
    safeRevalidate('/best');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateYes24TabOrder(tabOrders: { id: string; position: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    for (const item of tabOrders) {
      await sql`
        UPDATE yes24_tabs
        SET position = ${item.position}
        WHERE id = ${item.id} AND user_id = ${userId}
      `;
    }
    safeRevalidate('/best');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteYes24Tab(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    await sql`
      DELETE FROM yes24_tabs
      WHERE id = ${id} AND user_id = ${userId}
    `;
    safeRevalidate('/best');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateBlogTabOrder(tabOrders: { id: string; position: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    for (const item of tabOrders) {
      await sql`
        UPDATE blog_tabs
        SET position = ${item.position}
        WHERE id = ${item.id} AND user_id = ${userId}
      `;
    }
    safeRevalidate('/blog');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteBlogTab(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    await sql`
      DELETE FROM blog_tabs
      WHERE id = ${id} AND user_id = ${userId}
    `;
    safeRevalidate('/blog');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Naver Blog Database Operations
 */
export async function saveBlog(blog: {
  title: string;
  author?: string;
  url: string;
  thumbnail?: string;
  content?: string;
  published_at?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    const id = crypto.randomUUID();
    const addedAt = new Date().toISOString();

    try {
      await sql`
        INSERT INTO naver_blogs (
          id, title, author, url, thumbnail, content, published_at, user_id, added_at
        ) VALUES (
          ${id}, ${blog.title}, ${blog.author || null}, ${blog.url}, ${blog.thumbnail || null},
          ${blog.content || null}, ${blog.published_at || null}, ${userId}, ${addedAt}
        )
      `;
    } catch (dbError: any) {
      // If column is missing, try to add it and retry once
      if (dbError.message.includes('column "author" does not exist')) {
        await sql`ALTER TABLE naver_blogs ADD COLUMN IF NOT EXISTS author TEXT`;
        // Retry
        await sql`
          INSERT INTO naver_blogs (
            id, title, author, url, thumbnail, content, published_at, user_id, added_at
          ) VALUES (
            ${id}, ${blog.title}, ${blog.author || null}, ${blog.url}, ${blog.thumbnail || null},
            ${blog.content || null}, ${blog.published_at || null}, ${userId}, ${addedAt}
          )
        `;
      } else {
        throw dbError;
      }
    }

    safeRevalidate('/blog');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to save blog:', error);
    return { success: false, error: error.message || '블로그 정보를 저장하는 중 오류가 발생했습니다.' };
  }
}

export async function getBlogs(): Promise<any[]> {
  try {
    const user = await getSessionUser();
    let rows;
    try {
        const result = await sql`
            SELECT * FROM naver_blogs
            WHERE user_id = ${user.id}
            ORDER BY added_at DESC
        `;
        rows = result.rows;
    } catch (dbError: any) {
        if (dbError.message.includes('column "author" does not exist')) {
            await sql`ALTER TABLE naver_blogs ADD COLUMN IF NOT EXISTS author TEXT`;
            const result = await sql`
                SELECT * FROM naver_blogs
                WHERE user_id = ${user.id}
                ORDER BY added_at DESC
            `;
            rows = result.rows;
        } else {
            throw dbError;
        }
    }
    return rows || [];
  } catch (error) {
    console.error('getBlogs error:', error);
    return [];
  }
}

export async function getBlogById(id: string): Promise<any | undefined> {
  try {
    const user = await getSessionUser();
    const { rows } = await sql`
      SELECT * FROM naver_blogs
      WHERE id = ${id} AND user_id = ${user.id}
    `;
    if (rows.length === 0) return undefined;
    return rows[0];
  } catch (error) {
    return undefined;
  }
}

export async function deleteBlog(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    await sql`
      DELETE FROM naver_blogs
      WHERE id = ${id} AND user_id = ${userId}
    `;
    safeRevalidate('/blog');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateYoutubeVideo(id: string, video: {
  title: string;
  thumbnail?: string;
  duration?: string;
  published_at?: string;
  summary?: string;
  description?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    await sql`
      UPDATE youtube_videos SET
        title = ${video.title},
        thumbnail = ${video.thumbnail || null},
        duration = ${video.duration || null},
        published_at = ${video.published_at || null},
        summary = ${video.summary || null},
        description = ${video.description || null}
      WHERE id = ${id} AND user_id = ${userId}
    `;
    safeRevalidate('/');
    safeRevalidate(`/youtube/${id}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to update youtube video with id ${id}:`, error);
    return { success: false, error: error.message || '업데이트 중 오류가 발생했습니다.' };
  }
}

/**
 * Gemini Settings Database Operations
 */
export async function getGeminiModels(): Promise<any[]> {
  try {
    const user = await getSessionUser();
    const { rows } = await sql`
      SELECT * FROM gemini_models
      WHERE user_id = ${user.id}
      ORDER BY created_at ASC
    `;
    return rows;
  } catch (error) {
    return [];
  }
}

export async function addGeminiModel(name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO gemini_models (id, user_id, name)
      VALUES (${id}, ${userId}, ${name})
    `;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * YouTube Recommendation Tabs
 */
export async function getYoutubeTabs(): Promise<any[]> {
  try {
    const user = await getSessionUser();
    const { rows } = await sql`
      SELECT * FROM youtube_tabs
      WHERE user_id = ${user.id}
      ORDER BY position ASC, created_at ASC
    `;
    return rows;
  } catch (error) {
    return [];
  }
}

export async function addYoutubeTab(name: string, url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    const id = crypto.randomUUID();

    // Get max position
    const { rows } = await sql`SELECT COALESCE(MAX(position), -1) as max_pos FROM youtube_tabs WHERE user_id = ${userId}`;
    const nextPos = rows[0].max_pos + 1;

    await sql`
      INSERT INTO youtube_tabs (id, user_id, name, url, position)
      VALUES (${id}, ${userId}, ${name}, ${url}, ${nextPos})
    `;
    safeRevalidate('/youtube/recommend');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateYoutubeTabOrder(tabOrders: { id: string; position: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();

    // Perform updates in a loop (sequential for simplicity with @vercel/postgres)
    for (const item of tabOrders) {
      await sql`
        UPDATE youtube_tabs
        SET position = ${item.position}
        WHERE id = ${item.id} AND user_id = ${userId}
      `;
    }

    safeRevalidate('/youtube/recommend');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteYoutubeTab(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    await sql`
      DELETE FROM youtube_tabs
      WHERE id = ${id} AND user_id = ${userId}
    `;
    safeRevalidate('/youtube/recommend');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateGeminiModel(id: string, name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    await sql`
      UPDATE gemini_models SET name = ${name}
      WHERE id = ${id} AND user_id = ${userId}
    `;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteGeminiModel(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    await sql`
      DELETE FROM gemini_models
      WHERE id = ${id} AND user_id = ${userId}
    `;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateGeminiPrompt(id: string, name: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    await sql`
      UPDATE gemini_prompts SET name = ${name}, content = ${content}
      WHERE id = ${id} AND user_id = ${userId}
    `;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function setDefaultGeminiModel(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    await sql`UPDATE gemini_models SET is_default = FALSE WHERE user_id = ${userId}`;
    await sql`UPDATE gemini_models SET is_default = TRUE WHERE id = ${id} AND user_id = ${userId}`;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getGeminiPrompts(): Promise<any[]> {
  try {
    const user = await getSessionUser();
    const { rows } = await sql`
      SELECT * FROM gemini_prompts
      WHERE user_id = ${user.id}
      ORDER BY created_at ASC
    `;
    return rows;
  } catch (error) {
    return [];
  }
}

export async function addGeminiPrompt(name: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO gemini_prompts (id, user_id, name, content)
      VALUES (${id}, ${userId}, ${name}, ${content})
    `;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteGeminiPrompt(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    await sql`
      DELETE FROM gemini_prompts
      WHERE id = ${id} AND user_id = ${userId}
    `;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function setDefaultGeminiPrompt(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    await sql`UPDATE gemini_prompts SET is_default = FALSE WHERE user_id = ${userId}`;
    await sql`UPDATE gemini_prompts SET is_default = TRUE WHERE id = ${id} AND user_id = ${userId}`;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteYoutubeVideo(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    await sql`
      DELETE FROM youtube_videos
      WHERE id = ${id} AND user_id = ${userId}
    `;
    safeRevalidate('/');
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to delete youtube video with id ${id}:`, error);
    return { success: false, error: error.message || '삭제 중 오류가 발생했습니다.' };
  }
}

export async function batchDeleteYoutubeVideos(ids: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    if (ids.length === 0) return { success: true };

    // Use an array of IDs for the query
    await sql`
      DELETE FROM youtube_videos
      WHERE user_id = ${userId} AND id = ANY(${ids as any})
    `;

    safeRevalidate('/');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to batch delete youtube videos:', error);
    return { success: false, error: error.message || '다중 삭제 중 오류가 발생했습니다.' };
  }
}

export async function getYoutubeVideoById(id: string): Promise<any | undefined> {
  try {
    const user = await getSessionUser();
    const { rows } = await sql`
      SELECT * FROM youtube_videos
      WHERE id = ${id} AND user_id = ${user.id}
    `;
    if (rows.length === 0) return undefined;
    return rows[0];
  } catch (error) {
    return undefined;
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

export async function saveBook(book: Omit<Book, 'id'>): Promise<{ success: boolean; data?: Book; error?: string }> {
  try {
    const userId = await ensureApproved();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await sql`
      INSERT INTO books (
        id, title, author, cover_image, description, published_date,
        price, category, status, progress, rating, notes, added_at, user_id,
        intro, toc, author_intro, inside, publisher_review
      ) VALUES (
        ${id}, ${book.title}, ${book.author}, ${book.coverImage},
        ${book.description || null}, ${book.publishDate || null},
        ${book.price || null}, ${book.category || null},
        ${book.readingStatus}, ${book.progress || 0},
        ${book.rating || 0}, ${book.notes || null}, ${createdAt}, ${userId},
        ${book.intro || null}, ${book.toc || null}, ${book.authorIntro || null}, ${book.inside || null}, ${book.publisherReview || null}
      )
    `;

    safeRevalidate('/');
    return { success: true, data: { ...book, id, createdAt } };
  } catch (error: any) {
    console.error('Failed to save book:', error);
    return {
      success: false,
      error: error.message || '도서를 저장하는 중 오류가 발생했습니다.'
    };
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
        notes = ${book.notes || null},
        intro = ${book.intro || null},
        toc = ${book.toc || null},
        author_intro = ${book.authorIntro || null},
        inside = ${book.inside || null},
        publisher_review = ${book.publisherReview || null}
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
export async function softDeleteBook(id: string): Promise<void> {
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

export async function batchDeleteBooks(ids: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    if (ids.length === 0) return { success: true };

    const deletedAt = new Date().toISOString();
    await sql`
      UPDATE books SET deleted_at = ${deletedAt}
      WHERE user_id = ${userId} AND id = ANY(${ids as any})
    `;

    safeRevalidate('/');
    safeRevalidate('/trash');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to batch delete books:', error);
    return { success: false, error: error.message || '다중 삭제 중 오류가 발생했습니다.' };
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
}): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await ensureApproved();
    const id = crypto.randomUUID();
    const addedAt = new Date().toISOString();

    await sql`
      INSERT INTO youtube_videos (
        id, title, url, thumbnail, duration, published_at, summary, description, user_id, added_at
      ) VALUES (
        ${id}, ${video.title}, ${video.url}, ${video.thumbnail || null},
        ${video.duration || null}, ${video.published_at || null},
        ${video.summary || null}, ${video.description || null}, ${userId}, ${addedAt}
      )
    `;

    safeRevalidate('/');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to save youtube video:', error);
    return {
      success: false,
      error: error.message || '유튜브 정보를 저장하는 중 오류가 발생했습니다.'
    };
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

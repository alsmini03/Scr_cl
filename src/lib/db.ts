'use server';

import { sql } from '@vercel/postgres';
import { Book } from '@/types/book';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { sendGmail } from './gmail';

async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) {
    if (process.env.NODE_ENV === 'development') {
      return { id: 'alsmini03@gmail.com', email: 'alsmini03@gmail.com', isApproved: true };
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

  return user;
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
      WHERE deleted_at IS NULL AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
      ORDER BY added_at DESC
    `;
    return rows.map(mapRowToBook);
  } catch (error) {
    // If not logged in, return empty list instead of throwing
    return [];
  }
}

/**
 * Gmail Integration Helpers
 */
export async function getUserAccount(userId: string) {
  // Try finding by userId directly
  let res = await sql`
    SELECT * FROM accounts
    WHERE "userId"::text = ${userId}::text AND provider = 'google'
    LIMIT 1
  `;

  if (res.rows.length > 0) return res.rows[0];

  // Fallback: If userId is an email, search accounts joining with users.
  res = await sql`
    SELECT a.* FROM accounts a
    JOIN users u ON a."userId"::text = u.id::text
    WHERE u.email = ${userId} AND a.provider = 'google'
    LIMIT 1
  `;

  return res.rows[0];
}

export async function updateAccountTokens(userId: string, tokens: { access_token: string, expires_at: number, refresh_token?: string }) {
  const expiresAtStr = tokens.expires_at.toString();

  // We search by original identifiers to ensure we update the correct record
  const account = await getUserAccount(userId);
  if (!account) throw new Error('Account not found for token update');

  if (tokens.refresh_token) {
    await sql`
      UPDATE accounts
      SET access_token = ${tokens.access_token},
          expires_at = ${expiresAtStr},
          refresh_token = ${tokens.refresh_token}
      WHERE id = ${account.id}
    `;
  } else {
    await sql`
      UPDATE accounts
      SET access_token = ${tokens.access_token},
          expires_at = ${expiresAtStr}
      WHERE id = ${account.id}
    `;
  }
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const account = await getUserAccount(userId);
  if (!account) {
    throw new Error('Google 계정 연결 정보를 찾을 수 없습니다. 다시 로그인해 주세요.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at > now + 60) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new Error('재인증이 필요합니다. 로그아웃 후 다시 로그인하여 Gmail 권한을 허용해 주세요.');
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
      }),
    });

    const tokens = await response.json();
    if (!response.ok) {
        console.error("Google Token Refresh Error:", tokens);
        throw new Error('토큰 갱신에 실패했습니다. 다시 로그인해 주세요.');
    }

    await updateAccountTokens(userId, {
      access_token: tokens.access_token,
      expires_at: Math.floor(Date.now() / 1000 + (tokens.expires_in || 3600)),
      refresh_token: tokens.refresh_token,
    });

    return tokens.access_token;
  } catch (error: any) {
    console.error("Error refreshing access token", error);
    throw error;
  }
}

export async function sendBlogEmailAction(blogId: string, toEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user.id) throw new Error('Unauthorized');

    const accessToken = await getValidAccessToken(user.id);

    const blog = await getBlogById(blogId);
    if (!blog) throw new Error('Blog post not found');

    const subject = `${blog.title}`;
    const body = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #1978e5;">${blog.title}</h2>
        <p><b>작성자:</b> ${blog.author || '알 수 없음'}</p>
        <p><b>원본 URL:</b> <a href="${blog.url}">${blog.url}</a></p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <div style="white-space: pre-wrap;">${blog.content}</div>
      </div>
    `;

    await sendGmail(accessToken, toEmail, subject, body);
    return { success: true };
  } catch (error: any) {
    console.error('sendBlogEmailAction error:', error);
    return { success: false, error: error.message || '이메일 발송에 실패했습니다.' };
  }
}

export async function sendYoutubeEmailAction(videoId: string, toEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user.id) throw new Error('Unauthorized');

    const accessToken = await getValidAccessToken(user.id);

    const video = await getYoutubeVideoById(videoId);
    if (!video) throw new Error('Video not found');

    const subject = `${video.title}`;
    const body = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #1978e5;">${video.title}</h2>
        <p><b>원본 URL:</b> <a href="${video.url}">${video.url}</a></p>
        <p><b>게시일:</b> ${video.published_at || '-'}</p>
        <p><b>재생시간:</b> ${video.duration || '-'}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <div style="white-space: pre-wrap; background: #f9f9f9; padding: 20px; border-radius: 10px;">
          <h3 style="margin-top: 0;">AI 요약 분석</h3>
          ${video.summary}
        </div>
      </div>
    `;

    await sendGmail(accessToken, toEmail, subject, body);
    return { success: true };
  } catch (error: any) {
    console.error('sendYoutubeEmailAction error:', error);
    return { success: false, error: error.message || '이메일 발송에 실패했습니다.' };
  }
}

export async function getBlogTabs(): Promise<any[]> {
  try {
    const user = await getSessionUser();
    const { rows } = await sql`
      SELECT * FROM blog_tabs
      WHERE user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text
      ORDER BY position ASC, created_at ASC
    `;
    return rows;
  } catch (error) {
    return [];
  }
}

export async function addBlogTab(name: string, url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = crypto.randomUUID();

    const { rows } = await sql`SELECT COALESCE(MAX(position), -1) as max_pos FROM blog_tabs WHERE user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text`;
    const nextPos = rows[0].max_pos + 1;

    await sql`
      INSERT INTO blog_tabs (id, user_id, name, url, position)
      VALUES (${id}, ${user.id}, ${name}, ${url}, ${nextPos})
    `;
    safeRevalidate('/blog');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function batchDeleteBlogs(ids: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    if (ids.length === 0) return { success: true };

    await sql`
      DELETE FROM naver_blogs
      WHERE (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text) AND id = ANY(${ids as any})
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
      WHERE user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text
      ORDER BY position ASC, created_at ASC
    `;
    return rows;
  } catch (error) {
    return [];
  }
}

export async function addYes24Tab(name: string, url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = crypto.randomUUID();

    const { rows } = await sql`SELECT COALESCE(MAX(position), -1) as max_pos FROM yes24_tabs WHERE user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text`;
    const nextPos = rows[0].max_pos + 1;

    await sql`
      INSERT INTO yes24_tabs (id, user_id, name, url, position)
      VALUES (${id}, ${user.id}, ${name}, ${url}, ${nextPos})
    `;
    safeRevalidate('/best');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateYes24TabOrder(tabOrders: { id: string; position: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    for (const item of tabOrders) {
      await sql`
        UPDATE yes24_tabs
        SET position = ${item.position}
        WHERE id = ${item.id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
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
    const user = await ensureApproved();
    await sql`
      DELETE FROM yes24_tabs
      WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
    `;
    safeRevalidate('/best');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateBlogTabOrder(tabOrders: { id: string; position: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    for (const item of tabOrders) {
      await sql`
        UPDATE blog_tabs
        SET position = ${item.position}
        WHERE id = ${item.id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
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
    const user = await ensureApproved();
    await sql`
      DELETE FROM blog_tabs
      WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
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
    const user = await ensureApproved();
    const id = crypto.randomUUID();
    const addedAt = new Date().toISOString();

    try {
      await sql`
        INSERT INTO naver_blogs (
          id, title, author, url, thumbnail, content, published_at, user_id, added_at
        ) VALUES (
          ${id}, ${blog.title}, ${blog.author || null}, ${blog.url}, ${blog.thumbnail || null},
          ${blog.content || null}, ${blog.published_at || null}, ${user.id}, ${addedAt}
        )
      `;
    } catch (dbError: any) {
      // If column is missing, try to add it and retry once
      // PostgreSQL error code 42703 is undefined_column
      if (dbError.code === '42703' || dbError.message.includes('column "author" does not exist')) {
        try {
            await sql`ALTER TABLE naver_blogs ADD COLUMN IF NOT EXISTS author TEXT`;
            // Retry
            await sql`
              INSERT INTO naver_blogs (
                id, title, author, url, thumbnail, content, published_at, user_id, added_at
              ) VALUES (
                ${id}, ${blog.title}, ${blog.author || null}, ${blog.url}, ${blog.thumbnail || null},
                ${blog.content || null}, ${blog.published_at || null}, ${user.id}, ${addedAt}
              )
            `;
        } catch (retryError) {
            console.error('Retry saveBlog failed:', retryError);
            throw dbError;
        }
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
            WHERE user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text
            ORDER BY added_at DESC
        `;
        rows = result.rows;
    } catch (dbError: any) {
        if (dbError.code === '42703' || dbError.message.includes('column "author" does not exist')) {
            try {
                await sql`ALTER TABLE naver_blogs ADD COLUMN IF NOT EXISTS author TEXT`;
                const result = await sql`
                    SELECT * FROM naver_blogs
                    WHERE user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text
                    ORDER BY added_at DESC
                `;
                rows = result.rows;
            } catch (retryError) {
                console.error('Retry getBlogs failed:', retryError);
                throw dbError;
            }
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
      WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
    `;
    if (rows.length === 0) return undefined;
    return rows[0];
  } catch (error) {
    return undefined;
  }
}

export async function deleteBlog(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await sql`
      DELETE FROM naver_blogs
      WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
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
    const user = await getSessionUser();
    await sql`
      UPDATE youtube_videos SET
        title = ${video.title},
        thumbnail = ${video.thumbnail || null},
        duration = ${video.duration || null},
        published_at = ${video.published_at || null},
        summary = ${video.summary || null},
        description = ${video.description || null}
      WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id = ${user.email})
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
      WHERE user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text
      ORDER BY created_at ASC
    `;
    return rows;
  } catch (error) {
    return [];
  }
}

export async function addGeminiModel(name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO gemini_models (id, user_id, name)
      VALUES (${id}, ${user.id}, ${name})
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
      WHERE user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text
      ORDER BY position ASC, created_at ASC
    `;
    return rows;
  } catch (error) {
    return [];
  }
}

export async function addYoutubeTab(name: string, url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = crypto.randomUUID();

    // Get max position
    const { rows } = await sql`SELECT COALESCE(MAX(position), -1) as max_pos FROM youtube_tabs WHERE user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text`;
    const nextPos = rows[0].max_pos + 1;

    await sql`
      INSERT INTO youtube_tabs (id, user_id, name, url, position)
      VALUES (${id}, ${user.id}, ${name}, ${url}, ${nextPos})
    `;
    safeRevalidate('/youtube/recommend');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateYoutubeTabOrder(tabOrders: { id: string; position: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();

    // Perform updates in a loop (sequential for simplicity with @vercel/postgres)
    for (const item of tabOrders) {
      await sql`
        UPDATE youtube_tabs
        SET position = ${item.position}
        WHERE id = ${item.id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
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
    const user = await ensureApproved();
    await sql`
      DELETE FROM youtube_tabs
      WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
    `;
    safeRevalidate('/youtube/recommend');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateGeminiModel(id: string, name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await sql`
      UPDATE gemini_models SET name = ${name}
      WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
    `;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteGeminiModel(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await sql`
      DELETE FROM gemini_models
      WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
    `;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateGeminiPrompt(id: string, name: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await sql`
      UPDATE gemini_prompts SET name = ${name}, content = ${content}
      WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
    `;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function setDefaultGeminiModel(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await sql`UPDATE gemini_models SET is_default = FALSE WHERE (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)`;
    await sql`UPDATE gemini_models SET is_default = TRUE WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)`;
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
      WHERE user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text
      ORDER BY created_at ASC
    `;
    return rows;
  } catch (error) {
    return [];
  }
}

export async function addGeminiPrompt(name: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO gemini_prompts (id, user_id, name, content)
      VALUES (${id}, ${user.id}, ${name}, ${content})
    `;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteGeminiPrompt(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await sql`
      DELETE FROM gemini_prompts
      WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
    `;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function setDefaultGeminiPrompt(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await sql`UPDATE gemini_prompts SET is_default = FALSE WHERE (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)`;
    await sql`UPDATE gemini_prompts SET is_default = TRUE WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)`;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteYoutubeVideo(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await sql`
      DELETE FROM youtube_videos
      WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
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
    const user = await ensureApproved();
    if (ids.length === 0) return { success: true };

    // Use an array of IDs for the query
    await sql`
      DELETE FROM youtube_videos
      WHERE (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text) AND id = ANY(${ids as any})
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
      WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
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
      WHERE deleted_at IS NOT NULL AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
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
      WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
    `;
    if (rows.length === 0) return undefined;
    return mapRowToBook(rows[0]);
  } catch (error) {
    return undefined;
  }
}

export async function saveBook(book: Omit<Book, 'id'>): Promise<{ success: boolean; data?: Book; error?: string }> {
  try {
    const user = await ensureApproved();
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
        ${book.rating || 0}, ${book.notes || null}, ${createdAt}, ${user.id},
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
  const user = await getSessionUser();
  await ensureApproved();
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
      WHERE id = ${book.id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
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
  const user = await getSessionUser();
  await ensureApproved();
  const deletedAt = new Date().toISOString();
  try {
    await sql`
      UPDATE books SET deleted_at = ${deletedAt}
      WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
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
    const user = await getSessionUser();
    await ensureApproved();
    if (ids.length === 0) return { success: true };

    const deletedAt = new Date().toISOString();
    await sql`
      UPDATE books SET deleted_at = ${deletedAt}
      WHERE (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text) AND id = ANY(${ids as any})
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
  const user = await getSessionUser();
  await ensureApproved();
  try {
    await sql`
      UPDATE books SET deleted_at = NULL
      WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
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
  const user = await getSessionUser();
  await ensureApproved();
  try {
    await sql`
      DELETE FROM books
      WHERE id = ${id} AND (user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text)
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
    const user = await ensureApproved();
    const id = crypto.randomUUID();
    const addedAt = new Date().toISOString();

    await sql`
      INSERT INTO youtube_videos (
        id, title, url, thumbnail, duration, published_at, summary, description, user_id, added_at
      ) VALUES (
        ${id}, ${video.title}, ${video.url}, ${video.thumbnail || null},
        ${video.duration || null}, ${video.published_at || null},
        ${video.summary || null}, ${video.description || null}, ${user.id}, ${addedAt}
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
      WHERE user_id::text = ${user.id}::text OR user_id::text = ${user.email}::text
      ORDER BY added_at DESC
    `;
    return rows;
  } catch (error) {
    return [];
  }
}

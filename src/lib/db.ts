'use server';

import { Book } from '@/types/book';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { sendGmail } from './gmail';
import { marked } from 'marked';
import { gfmHeadingId } from "marked-gfm-heading-id";
import { findRecord, findRecords, createRecord, updateRecord, deleteRecord, batchDeleteRecords, batchUpdateRecords, escapeFormula } from './airtable';

// Configure marked
marked.use(gfmHeadingId());
import { randomUUID } from "node:crypto";

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
  if (!user.isApproved) {
    throw new Error('권한이 없습니다. 관리자의 승인이 필요합니다.');
  }
  return user;
}

function mapRecordToBook(record: any): Book {
  return {
    id: record.id,
    title: record.title,
    author: record.author || '',
    coverImage: record.cover_image || '',
    category: record.category,
    publishDate: record.published_date,
    price: record.price,
    description: record.description,
    readingStatus: record.status as 'READING' | 'FINISHED',
    progress: record.progress,
    rating: record.rating,
    notes: record.notes,
    createdAt: record.added_at,
    intro: record.intro,
    toc: record.toc,
    authorIntro: record.author_intro,
    inside: record.inside,
    publisherReview: record.publisher_review,
    yes24Url: record.yes24_url,
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
    const records = await findRecords('books', {
      filterByFormula: `AND({deleted_at} = BLANK(), OR({user_id} = '${escapeFormula(user.id)}', {user_id} = '${escapeFormula(user.email)}'))`,
      sort: [{ field: 'added_at', direction: 'desc' }]
    });
    return records.map(mapRecordToBook);
  } catch (error) {
    return [];
  }
}

/**
 * Gmail Integration Helpers
 */
export async function getUserAccount(userId: string) {
  const escapedUserId = escapeFormula(userId);
  const account = await findRecord('accounts', `AND({userId} = '${escapedUserId}', {provider} = 'google')`);
  if (account) return account;

  const user = await findRecord('users', `{email} = '${escapedUserId}'`);
  if (user) {
    return await findRecord('accounts', `AND({userId} = '${escapeFormula(user.id)}', {provider} = 'google')`);
  }

  return null;
}

export async function updateAccountTokens(userId: string, tokens: { access_token: string, expires_at: number, refresh_token?: string }) {
  const account = await getUserAccount(userId);
  if (!account) throw new Error('Account not found for token update');

  const fields: any = {
    access_token: tokens.access_token,
    expires_at: tokens.expires_at
  };
  if (tokens.refresh_token) {
    fields.refresh_token = tokens.refresh_token;
  }

  await updateRecord('accounts', account.id, fields);
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
    const summaryHtml = await marked.parse(video.summary || '');
    const body = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1978e5; font-size: 20px; margin-bottom: 15px;">${video.title}</h2>
        <p style="margin: 5px 0;"><b>원본 URL:</b> <a href="${video.url}" style="color: #1978e5; text-decoration: none;">${video.url}</a></p>
        <p style="margin: 5px 0;"><b>게시일:</b> ${video.published_at || '-'}</p>
        <p style="margin: 5px 0;"><b>재생시간:</b> ${video.duration || '-'}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <div style="background: #f9f9f9; padding: 20px; border-radius: 12px; border: 1px solid #eee;">
          <h3 style="margin-top: 0; color: #444; font-size: 18px; border-bottom: 2px solid #1978e5; display: inline-block; padding-bottom: 5px; margin-bottom: 15px;">AI 요약 분석</h3>
          <div style="word-break: break-word; color: #444;">
            ${summaryHtml}
          </div>
        </div>
        <footer style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
          본 메일은 Book Journal 앱에서 발송되었습니다.
        </footer>
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
    return await findRecords('blog_tabs', {
      filterByFormula: `OR({user_id} = '${escapeFormula(user.id)}', {user_id} = '${escapeFormula(user.email)}')`,
      sort: [{ field: 'position', direction: 'asc' }, { field: 'created_at', direction: 'asc' }]
    });
  } catch (error) {
    return [];
  }
}

export async function addBlogTab(name: string, url: string): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();

    const tabs = await getBlogTabs();
    const nextPos = tabs.length > 0 ? Math.max(...tabs.map(t => t.position || 0)) + 1 : 0;

    await createRecord('blog_tabs', {
      id,
      user_id: user.id,
      name,
      url,
      position: nextPos,
      created_at: new Date().toISOString()
    });
    safeRevalidate('/blog');
    return { success: true, id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Report Tabs
 */
export async function getReportTabs(): Promise<any[]> {
  try {
    const user = await getSessionUser();
    return await findRecords('report_tabs', {
      filterByFormula: `OR({user_id} = '${escapeFormula(user.id)}', {user_id} = '${escapeFormula(user.email)}')`,
      sort: [{ field: 'position', direction: 'asc' }, { field: 'created_at', direction: 'asc' }]
    });
  } catch (error) {
    return [];
  }
}

export async function addReportTab(name: string, url: string): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();

    const tabs = await getReportTabs();
    const nextPos = tabs.length > 0 ? Math.max(...tabs.map(t => t.position || 0)) + 1 : 0;

    await createRecord('report_tabs', {
      id,
      user_id: user.id,
      name,
      url,
      position: nextPos,
      created_at: new Date().toISOString()
    });
    safeRevalidate('/report');
    return { success: true, id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateReportTabOrder(tabOrders: { id: string; position: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await batchUpdateRecords('report_tabs', tabOrders.map(item => ({ id: item.id, fields: { position: item.position } })));
    safeRevalidate('/report');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteReportTab(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await deleteRecord('report_tabs', id);
    safeRevalidate('/report');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function batchDeleteBlogsAction(ids: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    if (ids.length === 0) return { success: true };

    await batchDeleteRecords('naver_blogs', ids);

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
    return await findRecords('yes24_tabs', {
      filterByFormula: `OR({user_id} = '${escapeFormula(user.id)}', {user_id} = '${escapeFormula(user.email)}')`,
      sort: [{ field: 'position', direction: 'asc' }, { field: 'created_at', direction: 'asc' }]
    });
  } catch (error) {
    return [];
  }
}

export async function addYes24Tab(name: string, url: string): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();

    const tabs = await getYes24Tabs();
    const nextPos = tabs.length > 0 ? Math.max(...tabs.map(t => t.position || 0)) + 1 : 0;

    await createRecord('yes24_tabs', {
      id,
      user_id: user.id,
      name,
      url,
      position: nextPos,
      created_at: new Date().toISOString()
    });
    safeRevalidate('/best');
    return { success: true, id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateYes24TabOrder(tabOrders: { id: string; position: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await batchUpdateRecords('yes24_tabs', tabOrders.map(item => ({ id: item.id, fields: { position: item.position } })));
    safeRevalidate('/best');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteYes24Tab(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await deleteRecord('yes24_tabs', id);
    safeRevalidate('/best');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateBlogTabOrder(tabOrders: { id: string; position: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await batchUpdateRecords('blog_tabs', tabOrders.map(item => ({ id: item.id, fields: { position: item.position } })));
    safeRevalidate('/blog');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteBlogTab(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await deleteRecord('blog_tabs', id);
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
    const id = randomUUID();
    const addedAt = new Date().toISOString();

    await createRecord('naver_blogs', {
      id,
      title: blog.title,
      author: blog.author,
      url: blog.url,
      thumbnail: blog.thumbnail,
      content: blog.content,
      published_at: blog.published_at,
      user_id: user.id,
      added_at: addedAt
    });

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
    return await findRecords('naver_blogs', {
      filterByFormula: `OR({user_id} = '${escapeFormula(user.id)}', {user_id} = '${escapeFormula(user.email)}')`,
      sort: [{ field: 'added_at', direction: 'desc' }]
    });
  } catch (error) {
    console.error('getBlogs error:', error);
    return [];
  }
}

export async function getBlogById(id: string): Promise<any | undefined> {
  try {
    const user = await getSessionUser();
    return await findRecord('naver_blogs', `AND({id} = '${escapeFormula(id)}', OR({user_id} = '${escapeFormula(user.id)}', {user_id} = '${escapeFormula(user.email)}'))`);
  } catch (error) {
    return undefined;
  }
}

export async function deleteBlog(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await deleteRecord('naver_blogs', id);
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
    await updateRecord('youtube_videos', id, {
      title: video.title,
      thumbnail: video.thumbnail,
      duration: video.duration,
      published_at: video.published_at,
      summary: video.summary,
      description: video.description
    });
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
    return await findRecords('gemini_models', {
      filterByFormula: `OR({user_id} = '${escapeFormula(user.id)}', {user_id} = '${escapeFormula(user.email)}')`,
      sort: [{ field: 'created_at', direction: 'asc' }]
    });
  } catch (error) {
    return [];
  }
}

export async function addGeminiModel(name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();
    await createRecord('gemini_models', {
      id,
      user_id: user.id,
      name,
      created_at: new Date().toISOString()
    });
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
    return await findRecords('youtube_tabs', {
      filterByFormula: `OR({user_id} = '${escapeFormula(user.id)}', {user_id} = '${escapeFormula(user.email)}')`,
      sort: [{ field: 'position', direction: 'asc' }, { field: 'created_at', direction: 'asc' }]
    });
  } catch (error) {
    return [];
  }
}

export async function addYoutubeTab(name: string, url: string): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();

    const tabs = await getYoutubeTabs();
    const nextPos = tabs.length > 0 ? Math.max(...tabs.map(t => t.position || 0)) + 1 : 0;

    await createRecord('youtube_tabs', {
      id,
      user_id: user.id,
      name,
      url,
      position: nextPos,
      created_at: new Date().toISOString()
    });
    safeRevalidate('/youtube/recommend');
    return { success: true, id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateYoutubeTabOrder(tabOrders: { id: string; position: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await batchUpdateRecords('youtube_tabs', tabOrders.map(item => ({ id: item.id, fields: { position: item.position } })));
    safeRevalidate('/youtube/recommend');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteYoutubeTab(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await deleteRecord('youtube_tabs', id);
    safeRevalidate('/youtube/recommend');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateGeminiModel(id: string, name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await updateRecord('gemini_models', id, { name });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteGeminiModel(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await deleteRecord('gemini_models', id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateGeminiPrompt(id: string, name: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await updateRecord('gemini_prompts', id, { name, content });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function setDefaultGeminiModel(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    const models = await getGeminiModels();
    await batchUpdateRecords('gemini_models', models.map(m => ({ id: m.id, fields: { is_default: m.id === id } })));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getGeminiPrompts(): Promise<any[]> {
  try {
    const user = await getSessionUser();
    return await findRecords('gemini_prompts', {
      filterByFormula: `OR({user_id} = '${escapeFormula(user.id)}', {user_id} = '${escapeFormula(user.email)}')`,
      sort: [{ field: 'created_at', direction: 'asc' }]
    });
  } catch (error) {
    return [];
  }
}

export async function addGeminiPrompt(name: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();
    await createRecord('gemini_prompts', {
      id,
      user_id: user.id,
      name,
      content,
      created_at: new Date().toISOString()
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteGeminiPrompt(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await deleteRecord('gemini_prompts', id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function setDefaultGeminiPrompt(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    const prompts = await getGeminiPrompts();
    await batchUpdateRecords('gemini_prompts', prompts.map(p => ({ id: p.id, fields: { is_default: p.id === id } })));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteYoutubeVideo(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await deleteRecord('youtube_videos', id);
    safeRevalidate('/');
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to delete youtube video with id ${id}:`, error);
    return { success: false, error: error.message || '삭제 중 오류가 발생했습니다.' };
  }
}

export async function batchDeleteYoutubeVideosAction(ids: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    if (ids.length === 0) return { success: true };

    await batchDeleteRecords('youtube_videos', ids);

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
    return await findRecord('youtube_videos', `AND({id} = '${escapeFormula(id)}', OR({user_id} = '${escapeFormula(user.id)}', {user_id} = '${escapeFormula(user.email)}'))`);
  } catch (error) {
    return undefined;
  }
}

export async function getDeletedBooks(): Promise<Book[]> {
  try {
    const user = await getSessionUser();
    const records = await findRecords('books', {
      filterByFormula: `AND({deleted_at} != BLANK(), OR({user_id} = '${escapeFormula(user.id)}', {user_id} = '${escapeFormula(user.email)}'))`,
      sort: [{ field: 'deleted_at', direction: 'desc' }]
    });
    return records.map(mapRecordToBook);
  } catch (error) {
    return [];
  }
}

export async function getBookById(id: string): Promise<Book | undefined> {
  try {
    const user = await getSessionUser();
    const record = await findRecord('books', `AND({id} = '${escapeFormula(id)}', OR({user_id} = '${escapeFormula(user.id)}', {user_id} = '${escapeFormula(user.email)}'))`);
    if (!record) return undefined;
    return mapRecordToBook(record);
  } catch (error) {
    return undefined;
  }
}

export async function saveBook(book: Omit<Book, 'id'>): Promise<{ success: boolean; data?: Book; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    await createRecord('books', {
      id,
      title: book.title,
      author: book.author,
      cover_image: book.coverImage,
      description: book.description,
      published_date: book.publishDate,
      price: book.price,
      category: book.category,
      status: book.readingStatus,
      progress: book.progress || 0,
      rating: book.rating || 0,
      notes: book.notes,
      added_at: createdAt,
      user_id: user.id,
      intro: book.intro,
      toc: book.toc,
      author_intro: book.authorIntro,
      inside: book.inside,
      publisher_review: book.publisherReview,
      yes24_url: book.yes24Url
    });

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
    await updateRecord('books', book.id, {
      title: book.title,
      author: book.author,
      cover_image: book.coverImage,
      description: book.description,
      published_date: book.publishDate,
      price: book.price,
      category: book.category,
      status: book.readingStatus,
      progress: book.progress || 0,
      rating: book.rating || 0,
      notes: book.notes,
      intro: book.intro,
      toc: book.toc,
      author_intro: book.authorIntro,
      inside: book.inside,
      publisher_review: book.publisherReview,
      yes24_url: book.yes24Url
    });
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
    await updateRecord('books', id, { deleted_at: deletedAt });
    safeRevalidate('/');
    safeRevalidate('/trash');
  } catch (error) {
    console.error(`Failed to move book to trash with id ${id}:`, error);
    throw new Error('Failed to move book to trash');
  }
}

export async function batchDeleteBooksAction(ids: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSessionUser();
    await ensureApproved();
    if (ids.length === 0) return { success: true };

    const deletedAt = new Date().toISOString();
    await batchUpdateRecords('books', ids.map(id => ({ id, fields: { deleted_at: deletedAt } })));

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
    await updateRecord('books', id, { deleted_at: null });
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
    await deleteRecord('books', id);
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
    const id = randomUUID();
    const addedAt = new Date().toISOString();

    await createRecord('youtube_videos', {
      id,
      title: video.title,
      url: video.url,
      thumbnail: video.thumbnail,
      duration: video.duration,
      published_at: video.published_at,
      summary: video.summary,
      description: video.description,
      user_id: user.id,
      added_at: addedAt
    });

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
    return await findRecords('youtube_videos', {
      filterByFormula: `OR({user_id} = '${escapeFormula(user.id)}', {user_id} = '${escapeFormula(user.email)}')`,
      sort: [{ field: 'added_at', direction: 'desc' }]
    });
  } catch (error) {
    return [];
  }
}

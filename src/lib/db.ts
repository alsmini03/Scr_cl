'use server';

import { Book } from '@/types/book';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { sendGmail } from './gmail';
import { marked } from 'marked';
import { gfmHeadingId } from "marked-gfm-heading-id";
import { query } from './pg';
import { randomUUID } from "node:crypto";
import { resolveBondwebPdfUrl } from './utils';
import { extractYoutube, extractReport } from './extract-service';

// Configure marked
marked.use(gfmHeadingId());

async function getSessionUser(prefetchedUser?: any) {
  if (prefetchedUser) return prefetchedUser;
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
    yes24Url: row.yes24_url,
    is_liked: row.is_liked,
  };
}

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch (e) {
    console.warn(`revalidatePath failed for ${path}: ${e}`);
  }
}

export async function getBooks(prefetchedUser?: any): Promise<Book[]> {
  try {
    const user = await getSessionUser(prefetchedUser);
    const res = await query(
      "SELECT id, title, author, cover_image, category, published_date, price, status, progress, rating, added_at, is_liked FROM books WHERE deleted_at IS NULL AND (user_id = $1 OR user_id = $2) ORDER BY added_at DESC",
      [user.id, user.email]
    );
    return res.rows.map(mapRowToBook);
  } catch (error) {
    console.error('getBooks error:', error);
    return [];
  }
}

/**
 * Report Database Operations
 */
export async function getReports(prefetchedUser?: any): Promise<any[]> {
  try {
    const user = await getSessionUser(prefetchedUser);
    const res = await query(
      "SELECT id, title, author, institution, date, url, summary, user_id, added_at, is_liked FROM reports WHERE user_id = $1 OR user_id = $2 ORDER BY added_at DESC",
      [user.id, user.email]
    );
    return res.rows;
  } catch (error) {
    console.error('getReports error:', error);
    return [];
  }
}

export async function saveReport(report: {
  title: string;
  author?: string;
  institution?: string;
  date?: string;
  url?: string;
  content?: string;
  summary?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();
    const addedAt = new Date().toISOString();

    await query(
      "INSERT INTO reports (id, title, author, institution, date, url, content, summary, user_id, added_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
      [id, report.title, report.author, report.institution, report.date, report.url, report.content, report.summary, user.email || user.id, addedAt]
    );

    safeRevalidate('/report');
    safeRevalidate('/saved');
    return { success: true, id };
  } catch (error: any) {
    console.error('Failed to save report:', {
        error: error.message,
        stack: error.stack,
        report: { ...report, content: report.content ? 'OMITTED' : undefined }
    });
    return { success: false, error: error.message || '리포트 정보를 저장하는 중 오류가 발생했습니다.' };
  }
}

export async function getReportById(id: string): Promise<any | undefined> {
  try {
    const user = await getSessionUser();
    const res = await query(
      "SELECT * FROM reports WHERE id = $1 AND (user_id = $2 OR user_id = $3)",
      [id, user.id, user.email]
    );
    return res.rows[0];
  } catch (error) {
    console.error('getReportById error:', error);
    return undefined;
  }
}

export async function deleteReport(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await query("DELETE FROM reports WHERE id = $1", [id]);
    safeRevalidate('/report');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getResolvedReportUrlAction(params: { fileId?: string, fileNum?: string, url?: string }): Promise<string | null> {
  try {
    if (params.fileId && params.fileNum) {
      const directUrl = await resolveBondwebPdfUrl(params.fileId, params.fileNum);
      if (directUrl) return directUrl;
    }

    if (params.url) {
      // If it's already a direct Data link
      if (params.url.includes('/Data/')) return params.url;

      // If it's a download proxy link
      if (params.url.includes('/api/report/download')) {
        const urlObj = new URL(params.url, 'http://localhost');
        const number = urlObj.searchParams.get('number');
        const gn = urlObj.searchParams.get('gn');
        const encodedUrl = urlObj.searchParams.get('url');

        if (number && gn) {
          const directUrl = await resolveBondwebPdfUrl(number, gn);
          if (directUrl) return directUrl;
        }

        if (encodedUrl) {
          return decodeURIComponent(encodedUrl);
        }
      }

      // If it's a standard Bondweb download link
      if (params.url.includes('DownloadPage.asp')) {
        const urlObj = new URL(params.url);
        const number = urlObj.searchParams.get('number');
        const gn = urlObj.searchParams.get('gn');
        if (number && gn) {
          const directUrl = await resolveBondwebPdfUrl(number, gn);
          if (directUrl) return directUrl;
        }
      }
    }

    return params.url || null;
  } catch (e) {
    console.error('getResolvedReportUrlAction error:', e);
    return params.url || null;
  }
}

export async function updateReport(id: string, report: {
  title: string;
  author?: string;
  institution?: string;
  date?: string;
  summary?: string;
  content?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await query(
      "UPDATE reports SET title = $1, author = $2, institution = $3, date = $4, summary = $5, content = $6 WHERE id = $7 AND (user_id = $8 OR user_id = $9)",
      [report.title, report.author, report.institution, report.date, report.summary, report.content, id, user.id, user.email]
    );
    safeRevalidate('/report');
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to update report with id ${id}:`, error);
    return { success: false, error: error.message || '업데이트 중 오류가 발생했습니다.' };
  }
}

/**
 * Gmail Integration Helpers
 */
export async function getUserAccount(userId: string) {
  const res = await query(
    'SELECT * FROM accounts WHERE "userId" = $1 AND provider = $2',
    [userId, 'google']
  );
  if (res.rows.length > 0) return res.rows[0];

  const userRes = await query('SELECT * FROM users WHERE email = $1', [userId]);
  if (userRes.rows.length > 0) {
    const accountRes = await query(
      'SELECT * FROM accounts WHERE "userId" = $1 AND provider = $2',
      [userRes.rows[0].id, 'google']
    );
    return accountRes.rows[0] || null;
  }

  return null;
}

export async function updateAccountTokens(userId: string, tokens: { access_token: string, expires_at: number, refresh_token?: string }) {
  const account = await getUserAccount(userId);
  if (!account) throw new Error('Account not found for token update');

  if (tokens.refresh_token) {
    await query(
      'UPDATE accounts SET access_token = $1, expires_at = $2, refresh_token = $3 WHERE id = $4',
      [tokens.access_token, tokens.expires_at, tokens.refresh_token, account.id]
    );
  } else {
    await query(
      'UPDATE accounts SET access_token = $1, expires_at = $2 WHERE id = $3',
      [tokens.access_token, tokens.expires_at, account.id]
    );
  }
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const account = await getUserAccount(userId);
  if (!account) {
    throw new Error('Google 계정 연결 정보를 찾을 수 없습니다. 다시 로그인해 주세요.');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = account.expires_at ? Number(account.expires_at) : 0;

  if (expiresAt > now + 60) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new Error('재인증이 필요합니다. 로그아웃 후 다시 로그인하여 Gmail 권한을 허용해 주세요. (Refresh Token 누락)');
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
        throw new Error(`토큰 갱신 실패 (${tokens.error || 'unknown'}): ${tokens.error_description || '다시 로그인해 주세요.'}`);
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
  return sendBatchEmailAction([{ type: 'blog', id: blogId }], toEmail);
}

export async function sendYoutubeEmailAction(videoId: string, toEmail: string): Promise<{ success: boolean; error?: string }> {
  return sendBatchEmailAction([{ type: 'youtube', id: videoId }], toEmail);
}

export async function sendBatchEmailAction(items: { type: 'youtube' | 'blog' | 'report' | 'book', id: string }[], toEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user.id) throw new Error('Unauthorized');

    const accessToken = await getValidAccessToken(user.id);

    let htmlContent = '';
    let subject = '';

    // Set subject based on the first item and total count
    if (items.length > 0) {
      const firstItem = items[0];
      let firstTitle = '';
      if (firstItem.type === 'youtube') {
        const video = await getYoutubeVideoById(firstItem.id);
        firstTitle = video?.title || 'YouTube 영상';
      } else if (firstItem.type === 'blog') {
        const blog = await getBlogById(firstItem.id);
        firstTitle = blog?.title || '블로그 글';
      } else if (firstItem.type === 'report') {
        const report = await getReportById(firstItem.id);
        firstTitle = report?.title || '리포트';
      }

      subject = `${firstTitle} (${items.length}개)`;
    } else {
      subject = '[Scrap] 공유된 항목';
    }

    let tocHtml = '';
    const showToc = items.length > 1;

    if (showToc) {
      tocHtml = `
        <div style="margin-bottom: 40px; padding: 20px; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #1e293b; border-bottom: 2px solid #1978e5; display: inline-block; padding-bottom: 4px;">목차</h3>
          <ul style="margin: 0; padding: 0; list-style: none;">
      `;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = `item-${i}`;

      if (item.type === 'youtube') {
        const video = await getYoutubeVideoById(item.id);
        if (!video) continue;

        if (showToc) {
          tocHtml += `<li style="margin-bottom: 8px;"><a href="#${itemId}" style="color: #1978e5; text-decoration: none; font-size: 14px;">${i + 1}. [YouTube] ${video.title}</a></li>`;
        }

        const summaryHtml = await marked.parse(video.summary || '');
        htmlContent += `
          <div id="${itemId}" style="margin-bottom: 40px; border: 1px solid #eee; border-radius: 12px; overflow: hidden; background: #fff;">
            <div style="background: #f8fafc; padding: 15px 20px; border-bottom: 1px solid #eee;">
              <span style="display: inline-block; background: #ff0000; color: #fff; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; margin-bottom: 8px;">YOUTUBE</span>
              <h2 style="margin: 0; font-size: 18px; color: #111;">${video.title}</h2>
            </div>
            <div style="padding: 20px;">
              ${video.thumbnail ? `<div style="margin-bottom: 20px;"><img src="${video.thumbnail.replace('maxresdefault.jpg', 'mqdefault.jpg')}" referrerpolicy="no-referrer" style="border-radius: 8px; display: block;"></div>` : ''}
              <p style="margin: 0 0 10px 0; font-size: 13px; color: #666;">
                <b>원본 URL:</b> <a href="${video.url}" style="color: #1978e5; text-decoration: none;">${video.url}</a><br>
                <b>게시일:</b> ${video.published_at || '-'} | <b>재생시간:</b> ${video.duration || '-'}
              </p>
              <div style="padding: 15px; border-radius: 8px;">
                <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1978e5;">AI 요약 분석</h3>
                <div style="font-size: 14px; color: #444; line-height: 1.6;">${summaryHtml}</div>
              </div>
            </div>
          </div>
        `;
      } else if (item.type === 'blog') {
        const blog = await getBlogById(item.id);
        if (!blog) continue;

        if (showToc) {
          tocHtml += `<li style="margin-bottom: 8px;"><a href="#${itemId}" style="color: #1978e5; text-decoration: none; font-size: 14px;">${i + 1}. [Blog] ${blog.title}</a></li>`;
        }

        htmlContent += `
          <div id="${itemId}" style="margin-bottom: 40px; border: 1px solid #eee; border-radius: 12px; overflow: hidden; background: #fff;">
            <div style="background: #f8fafc; padding: 15px 20px; border-bottom: 1px solid #eee;">
              <span style="display: inline-block; background: #19ce60; color: #fff; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; margin-bottom: 8px;">BLOG</span>
              <h2 style="margin: 0; font-size: 18px; color: #111;">${blog.title}</h2>
            </div>
            <div style="padding: 20px;">
              <p style="margin: 0 0 15px 0; font-size: 13px; color: #666;">
                <b>작성자:</b> ${blog.author || '알 수 없음'} | <b>원본 URL:</b> <a href="${blog.url}" style="color: #1978e5; text-decoration: none;">${blog.url}</a>
              </p>
              <div style="font-size: 14px; color: #333; line-height: 1.7; white-space: pre-wrap;">${blog.content}</div>
            </div>
          </div>
        `;
      } else if (item.type === 'report') {
        const report = await getReportById(item.id);
        if (!report) continue;

        if (showToc) {
          tocHtml += `<li style="margin-bottom: 8px;"><a href="#${itemId}" style="color: #1978e5; text-decoration: none; font-size: 14px;">${i + 1}. [Report] ${report.title}</a></li>`;
        }

        const summaryHtml = report.summary ? await marked.parse(report.summary) : '';
        htmlContent += `
          <div id="${itemId}" style="margin-bottom: 40px; border: 1px solid #eee; border-radius: 12px; overflow: hidden; background: #fff;">
            <div style="background: #f8fafc; padding: 15px 20px; border-bottom: 1px solid #eee;">
              <span style="display: inline-block; background: #6366f1; color: #fff; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; margin-bottom: 8px;">REPORT</span>
              <h2 style="margin: 0; font-size: 18px; color: #111;">${report.title}</h2>
            </div>
            <div style="padding: 20px;">
              <p style="margin: 0 0 10px 0; font-size: 13px; color: #666;">
                <b>기관:</b> ${report.institution || '-'} | <b>작성자:</b> ${report.author || '-'} | <b>날짜:</b> ${report.date || '-'}
              </p>
              ${report.url ? await (async () => {
                const displayUrl = await getResolvedReportUrlAction({ url: report.url });
                return `<p style="margin: 0 0 15px 0; font-size: 13px; color: #666;"><b>PDF:</b> <a href="${displayUrl}" style="color: #1978e5; text-decoration: none;">원본 파일 링크</a></p>`;
              })() : ''}

              ${summaryHtml ? `
              <div style="padding: 15px; border-radius: 8px;">
                <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1978e5;">AI 요약 분석</h3>
                <div style="font-size: 14px; color: #444; line-height: 1.6;">${summaryHtml}</div>
              </div>
              ` : ''}

              ${report.content ? `
              <div style="margin-top: 20px; font-size: 13px; color: #555; line-height: 1.6; border-top: 1px dashed #eee; padding-top: 15px;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #666;">추출된 텍스트 내용</h3>
                <div style="max-height: 300px; overflow-y: auto; background: #fcfcfc; padding: 10px;">${report.content}</div>
              </div>
              ` : ''}
            </div>
          </div>
        `;
      }
    }

    if (showToc) {
      tocHtml += `
          </ul>
        </div>
      `;
    }

    const body = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 20px;">
        <meta name="referrer" content="no-referrer">
        ${tocHtml}
        ${htmlContent}
      </div>
    `;

    await sendGmail(accessToken, toEmail, subject, body);
    return { success: true };
  } catch (error: any) {
    console.error('sendBatchEmailAction error:', error);
    return { success: false, error: error.message || '이메일 발송에 실패했습니다.' };
  }
}

export async function getBlogTabs(): Promise<any[]> {
  try {
    const user = await getSessionUser();
    const res = await query(
      "SELECT * FROM blog_tabs WHERE user_id = $1 OR user_id = $2 ORDER BY position ASC, created_at ASC",
      [user.id, user.email]
    );
    return res.rows;
  } catch (error) {
    console.error('getBlogTabs error:', error);
    return [];
  }
}

export async function addBlogTab(name: string, url: string): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();

    const tabs = await getBlogTabs();
    const nextPos = tabs.length > 0 ? Math.max(...tabs.map(t => t.position || 0)) + 1 : 0;

    await query(
      "INSERT INTO blog_tabs (id, user_id, name, url, position, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, user.email || user.id, name, url, nextPos, new Date().toISOString()]
    );
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
    const res = await query(
      "SELECT * FROM report_tabs WHERE user_id = $1 OR user_id = $2 ORDER BY position ASC, created_at ASC",
      [user.id, user.email]
    );
    return res.rows;
  } catch (error) {
    console.error('getReportTabs error:', error);
    return [];
  }
}

export async function addReportTab(name: string, url: string): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();

    const tabs = await getReportTabs();
    const nextPos = tabs.length > 0 ? Math.max(...tabs.map(t => t.position || 0)) + 1 : 0;

    await query(
      "INSERT INTO report_tabs (id, user_id, name, url, position, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, user.email || user.id, name, url, nextPos, new Date().toISOString()]
    );
    safeRevalidate('/report');
    return { success: true, id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateReportTabOrder(tabOrders: { id: string; position: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    for (const item of tabOrders) {
      await query("UPDATE report_tabs SET position = $1 WHERE id = $2", [item.position, item.id]);
    }
    safeRevalidate('/report');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteReportTab(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await query("DELETE FROM report_tabs WHERE id = $1", [id]);
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

    await query("DELETE FROM naver_blogs WHERE id = ANY($1)", [ids]);

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
    const res = await query(
      "SELECT * FROM yes24_tabs WHERE user_id = $1 OR user_id = $2 ORDER BY position ASC, created_at ASC",
      [user.id, user.email]
    );
    return res.rows;
  } catch (error) {
    console.error('getYes24Tabs error:', error);
    return [];
  }
}

export async function addYes24Tab(name: string, url: string): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();

    const tabs = await getYes24Tabs();
    const nextPos = tabs.length > 0 ? Math.max(...tabs.map(t => t.position || 0)) + 1 : 0;

    await query(
      "INSERT INTO yes24_tabs (id, user_id, name, url, position, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, user.email || user.id, name, url, nextPos, new Date().toISOString()]
    );
    safeRevalidate('/best');
    return { success: true, id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateYes24TabOrder(tabOrders: { id: string; position: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    for (const item of tabOrders) {
      await query("UPDATE yes24_tabs SET position = $1 WHERE id = $2", [item.position, item.id]);
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
    await query("DELETE FROM yes24_tabs WHERE id = $1", [id]);
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
      await query("UPDATE blog_tabs SET position = $1 WHERE id = $2", [item.position, item.id]);
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
    await query("DELETE FROM blog_tabs WHERE id = $1", [id]);
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
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();
    const addedAt = new Date().toISOString();

    await query(
      "INSERT INTO naver_blogs (id, title, author, url, thumbnail, content, published_at, user_id, added_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [id, blog.title, blog.author, blog.url, blog.thumbnail, blog.content, blog.published_at, user.email || user.id, addedAt]
    );

    safeRevalidate('/blog');
    safeRevalidate('/saved');
    return { success: true, id };
  } catch (error: any) {
    console.error('Failed to save blog:', error);
    return { success: false, error: error.message || '블로그 정보를 저장하는 중 오류가 발생했습니다.' };
  }
}

export async function getBlogs(prefetchedUser?: any): Promise<any[]> {
  try {
    const user = await getSessionUser(prefetchedUser);
    const res = await query(
      "SELECT id, title, author, url, thumbnail, published_at, user_id, added_at, is_liked FROM naver_blogs WHERE user_id = $1 OR user_id = $2 ORDER BY added_at DESC",
      [user.id, user.email]
    );
    return res.rows;
  } catch (error) {
    console.error('getBlogs error:', error);
    return [];
  }
}

export async function getBlogById(id: string): Promise<any | undefined> {
  try {
    const user = await getSessionUser();
    const res = await query(
      "SELECT * FROM naver_blogs WHERE id = $1 AND (user_id = $2 OR user_id = $3)",
      [id, user.id, user.email]
    );
    return res.rows[0];
  } catch (error) {
    console.error('getBlogById error:', error);
    return undefined;
  }
}

export async function deleteBlog(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await query("DELETE FROM naver_blogs WHERE id = $1", [id]);
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
    await query(
      "UPDATE youtube_videos SET title = $1, thumbnail = $2, duration = $3, published_at = $4, summary = $5, description = $6 WHERE id = $7",
      [video.title, video.thumbnail, video.duration, video.published_at, video.summary, video.description, id]
    );
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
    const res = await query(
      "SELECT * FROM gemini_models WHERE (user_id = $1 OR user_id = $2) ORDER BY created_at ASC",
      [user.id, user.email]
    );
    return res.rows;
  } catch (error) {
    console.error('getGeminiModels error:', error);
    return [];
  }
}

export async function addGeminiModel(name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();
    await query(
      "INSERT INTO gemini_models (id, user_id, name, created_at) VALUES ($1, $2, $3, $4)",
      [id, user.email || user.id, name, new Date().toISOString()]
    );
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
    const res = await query(
      "SELECT * FROM youtube_tabs WHERE user_id = $1 OR user_id = $2 ORDER BY position ASC, created_at ASC",
      [user.id, user.email]
    );
    return res.rows;
  } catch (error) {
    console.error('getYoutubeTabs error:', error);
    return [];
  }
}

export async function addYoutubeTab(name: string, url: string): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();

    const tabs = await getYoutubeTabs();
    const nextPos = tabs.length > 0 ? Math.max(...tabs.map(t => t.position || 0)) + 1 : 0;

    await query(
      "INSERT INTO youtube_tabs (id, user_id, name, url, position, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, user.email || user.id, name, url, nextPos, new Date().toISOString()]
    );
    safeRevalidate('/youtube/recommend');
    return { success: true, id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateYoutubeTabOrder(tabOrders: { id: string; position: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    for (const item of tabOrders) {
      await query("UPDATE youtube_tabs SET position = $1 WHERE id = $2", [item.position, item.id]);
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
    await query("DELETE FROM youtube_tabs WHERE id = $1", [id]);
    safeRevalidate('/youtube/recommend');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateGeminiModel(id: string, name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await query("UPDATE gemini_models SET name = $1 WHERE id = $2 AND (user_id = $3 OR user_id = $4)", [name, id, user.id, user.email]);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteGeminiModel(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await query("DELETE FROM gemini_models WHERE id = $1", [id]);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateGeminiPrompt(id: string, name: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await query("UPDATE gemini_prompts SET name = $1, content = $2 WHERE id = $3 AND (user_id = $4 OR user_id = $5)", [name, content, id, user.id, user.email]);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function setDefaultGeminiModel(id: string, category: string = 'youtube'): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    const column = category === 'report' ? 'report_default' : 'youtube_default';
    await query(`UPDATE gemini_models SET ${column} = (id = $1) WHERE (user_id = $2 OR user_id = $3)`, [id, user.id, user.email]);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getGeminiPrompts(): Promise<any[]> {
  try {
    const user = await getSessionUser();
    const res = await query(
      "SELECT * FROM gemini_prompts WHERE (user_id = $1 OR user_id = $2) ORDER BY created_at ASC",
      [user.id, user.email]
    );
    return res.rows;
  } catch (error) {
    console.error('getGeminiPrompts error:', error);
    return [];
  }
}

export async function addGeminiPrompt(name: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();
    await query(
      "INSERT INTO gemini_prompts (id, user_id, name, content, created_at) VALUES ($1, $2, $3, $4, $5)",
      [id, user.email || user.id, name, content, new Date().toISOString()]
    );
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteGeminiPrompt(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await query("DELETE FROM gemini_prompts WHERE id = $1", [id]);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function setDefaultGeminiPrompt(id: string, category: string = 'youtube'): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    const column = category === 'report' ? 'report_default' : 'youtube_default';
    await query(`UPDATE gemini_prompts SET ${column} = (id = $1) WHERE (user_id = $2 OR user_id = $3)`, [id, user.id, user.email]);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteYoutubeVideo(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    await query("DELETE FROM youtube_videos WHERE id = $1", [id]);
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

    await query("DELETE FROM youtube_videos WHERE id = ANY($1)", [ids]);

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
    const res = await query(
      "SELECT * FROM youtube_videos WHERE id = $1 AND (user_id = $2 OR user_id = $3)",
      [id, user.id, user.email]
    );
    return res.rows[0];
  } catch (error) {
    console.error('getYoutubeVideoById error:', error);
    return undefined;
  }
}

export async function getDeletedBooks(): Promise<Book[]> {
  try {
    const user = await getSessionUser();
    const res = await query(
      "SELECT * FROM books WHERE deleted_at IS NOT NULL AND (user_id = $1 OR user_id = $2) ORDER BY deleted_at DESC",
      [user.id, user.email]
    );
    return res.rows.map(mapRowToBook);
  } catch (error) {
    console.error('getDeletedBooks error:', error);
    return [];
  }
}

export async function getBookById(id: string): Promise<Book | undefined> {
  try {
    const user = await getSessionUser();
    const res = await query(
      "SELECT * FROM books WHERE id = $1 AND (user_id = $2 OR user_id = $3)",
      [id, user.id, user.email]
    );
    if (res.rows.length === 0) return undefined;
    return mapRowToBook(res.rows[0]);
  } catch (error) {
    console.error('getBookById error:', error);
    return undefined;
  }
}

export async function saveBook(book: Omit<Book, 'id'>): Promise<{ success: boolean; data?: Book; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    await query(
      "INSERT INTO books (id, title, author, cover_image, description, published_date, price, category, status, progress, rating, notes, added_at, user_id, intro, toc, author_intro, inside, publisher_review, yes24_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)",
      [id, book.title, book.author, book.coverImage, book.description, book.publishDate, book.price, book.category, book.readingStatus, book.progress || 0, book.rating || 0, book.notes, createdAt, user.email || user.id, book.intro, book.toc, book.authorIntro, book.inside, book.publisherReview, book.yes24Url]
    );

    safeRevalidate('/');
    safeRevalidate('/saved');
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
    await query(
      "UPDATE books SET title = $1, author = $2, cover_image = $3, description = $4, published_date = $5, price = $6, category = $7, status = $8, progress = $9, rating = $10, notes = $11, intro = $12, toc = $13, author_intro = $14, inside = $15, publisher_review = $16, yes24_url = $17 WHERE id = $18",
      [book.title, book.author, book.coverImage, book.description, book.publishDate, book.price, book.category, book.readingStatus, book.progress || 0, book.rating || 0, book.notes, book.intro, book.toc, book.authorIntro, book.inside, book.publisherReview, book.yes24Url, book.id]
    );
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
    await query("UPDATE books SET deleted_at = $1 WHERE id = $2", [deletedAt, id]);
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
    await query("UPDATE books SET deleted_at = $1 WHERE id = ANY($2)", [deletedAt, ids]);

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
    await query("UPDATE books SET deleted_at = NULL WHERE id = $1", [id]);
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
    await query("DELETE FROM books WHERE id = $1", [id]);
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
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await ensureApproved();
    const id = randomUUID();
    const addedAt = new Date().toISOString();

    await query(
      "INSERT INTO youtube_videos (id, title, url, thumbnail, duration, published_at, summary, description, user_id, added_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
      [id, video.title, video.url, video.thumbnail, video.duration, video.published_at, video.summary, video.description, user.email || user.id, addedAt]
    );

    safeRevalidate('/');
    safeRevalidate('/saved');
    return { success: true, id };
  } catch (error: any) {
    console.error('Failed to save youtube video:', error);
    return {
      success: false,
      error: error.message || '유튜브 정보를 저장하는 중 오류가 발생했습니다.'
    };
  }
}

export async function getYoutubeVideos(prefetchedUser?: any): Promise<any[]> {
  try {
    const user = await getSessionUser(prefetchedUser);
    const res = await query(
      "SELECT id, title, url, thumbnail, duration, published_at, user_id, added_at, is_liked FROM youtube_videos WHERE user_id = $1 OR user_id = $2 ORDER BY added_at DESC",
      [user.id, user.email]
    );
    return res.rows;
  } catch (error) {
    console.error('getYoutubeVideos error:', error);
    return [];
  }
}

export async function getAdjacentYoutubeVideoIdsAction(id: string): Promise<{ prevId?: string; nextId?: string }> {
  try {
    const user = await getSessionUser();
    const currentVideo = await getYoutubeVideoById(id);
    if (!currentVideo) return {};

    const addedAt = currentVideo.added_at;

    // Prev (Newer in list)
    const prevRes = await query(
      "SELECT id FROM youtube_videos WHERE (user_id = $1 OR user_id = $2) AND added_at > $3 ORDER BY added_at ASC LIMIT 1",
      [user.id, user.email, addedAt]
    );

    // Next (Older in list)
    const nextRes = await query(
      "SELECT id FROM youtube_videos WHERE (user_id = $1 OR user_id = $2) AND added_at < $3 ORDER BY added_at DESC LIMIT 1",
      [user.id, user.email, addedAt]
    );

    return {
      prevId: prevRes.rows[0]?.id,
      nextId: nextRes.rows[0]?.id
    };
  } catch (error) {
    console.error('getAdjacentYoutubeVideoIdsAction error:', error);
    return {};
  }
}

export async function toggleLikeAction(type: 'youtube' | 'blog' | 'report' | 'book', id: string, isLiked: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await ensureApproved();
    const tableMap: Record<string, string> = {
      youtube: 'youtube_videos',
      blog: 'naver_blogs',
      report: 'reports',
      book: 'books'
    };
    const table = tableMap[type];
    if (!table) throw new Error('Invalid type');

    await query(
      `UPDATE ${table} SET is_liked = $1 WHERE id = $2 AND (user_id = $3 OR user_id = $4)`,
      [isLiked, id, user.id, user.email]
    );

    const revalidatePathMap: Record<string, string> = {
      youtube: `/youtube/${id}`,
      blog: `/blog/${id}`,
      report: '/report',
      book: `/book/${id}`
    };
    if (revalidatePathMap[type]) {
      safeRevalidate(revalidatePathMap[type]);
    }
    safeRevalidate('/saved');

    return { success: true };
  } catch (error: any) {
    console.error('toggleLikeAction error:', error);
    return { success: false, error: error.message };
  }
}

export async function getAdjacentBlogIdsAction(id: string): Promise<{ prevId?: string; nextId?: string }> {
  try {
    const user = await getSessionUser();
    const current = await getBlogById(id);
    if (!current) return {};

    const addedAt = current.added_at;

    // Prev (Newer)
    const prevRes = await query(
      "SELECT id FROM naver_blogs WHERE (user_id = $1 OR user_id = $2) AND added_at > $3 ORDER BY added_at ASC LIMIT 1",
      [user.id, user.email, addedAt]
    );

    // Next (Older)
    const nextRes = await query(
      "SELECT id FROM naver_blogs WHERE (user_id = $1 OR user_id = $2) AND added_at < $3 ORDER BY added_at DESC LIMIT 1",
      [user.id, user.email, addedAt]
    );

    return {
      prevId: prevRes.rows[0]?.id,
      nextId: nextRes.rows[0]?.id
    };
  } catch (error) {
    console.error('getAdjacentBlogIdsAction error:', error);
    return {};
  }
}

export async function getAdjacentReportIdsAction(id: string): Promise<{ prevId?: string; nextId?: string }> {
  try {
    const user = await getSessionUser();
    const current = await getReportById(id);
    if (!current) return {};

    const addedAt = current.added_at;

    // Prev (Newer)
    const prevRes = await query(
      "SELECT id FROM reports WHERE (user_id = $1 OR user_id = $2) AND added_at > $3 ORDER BY added_at ASC LIMIT 1",
      [user.id, user.email, addedAt]
    );

    // Next (Older)
    const nextRes = await query(
      "SELECT id FROM reports WHERE (user_id = $1 OR user_id = $2) AND added_at < $3 ORDER BY added_at DESC LIMIT 1",
      [user.id, user.email, addedAt]
    );

    return {
      prevId: prevRes.rows[0]?.id,
      nextId: nextRes.rows[0]?.id
    };
  } catch (error) {
    console.error('getAdjacentReportIdsAction error:', error);
    return {};
  }
}

// Gemini Queue Actions
export async function addToQueue(type: 'youtube' | 'report', targetId: string, payload: any) {
  try {
    const user = await ensureApproved();
    const id = randomUUID();
    await query(
      "INSERT INTO gemini_queue (id, user_id, type, target_id, payload) VALUES ($1, $2, $3, $4, $5)",
      [id, user.email || user.id, type, targetId, JSON.stringify(payload)]
    );
    safeRevalidate('/youtube');
    safeRevalidate('/report');
    return { success: true, id };
  } catch (error: any) {
    console.error('addToQueue error:', error);
    return { success: false, error: error.message };
  }
}

export async function getQueueItems(): Promise<any[]> {
  try {
    const user = await getSessionUser();
    const res = await query(
      "SELECT * FROM gemini_queue WHERE (user_id = $1 OR user_id = $2) AND status IN ('pending', 'processing', 'failed') AND retry_count < 3 ORDER BY created_at ASC",
      [user.id, user.email]
    );
    return res.rows;
  } catch (error) {
    console.error('getQueueItems error:', error);
    return [];
  }
}

export async function processNextQueueItemAction() {
  try {
    const user = await ensureApproved();

    // Check if any item is already processing for this user
    const processingRes = await query(
      "SELECT id FROM gemini_queue WHERE (user_id = $1 OR user_id = $2) AND status = 'processing'",
      [user.id, user.email]
    );

    if (processingRes.rows.length > 0) {
      return { success: false, message: 'Processing in progress' };
    }

    // Get the next item to process
    const nextRes = await query(
      "SELECT * FROM gemini_queue WHERE (user_id = $1 OR user_id = $2) AND status IN ('pending', 'failed') AND retry_count < 3 ORDER BY created_at ASC LIMIT 1",
      [user.id, user.email]
    );

    const item = nextRes.rows[0];
    if (!item) return { success: false, message: 'No items in queue' };

    // Check 1 minute interval from the most recently processed item for this user
    const lastProcessedRes = await query(
      "SELECT last_processed_at FROM gemini_queue WHERE (user_id = $1 OR user_id = $2) AND last_processed_at IS NOT NULL ORDER BY last_processed_at DESC LIMIT 1",
      [user.id, user.email]
    );

    if (lastProcessedRes.rows.length > 0) {
      const lastProcessed = new Date(lastProcessedRes.rows[0].last_processed_at).getTime();
      const now = Date.now();
      if (now - lastProcessed < 60000) {
        return { success: false, message: 'Wait for 1 minute interval' };
      }
    }

    // Mark as processing
    await query(
      "UPDATE gemini_queue SET status = 'processing', last_processed_at = CURRENT_TIMESTAMP WHERE id = $1",
      [item.id]
    );

    let result;
    try {
      const { type, target_id, payload } = item;
      let summary = '';

      if (type === 'youtube') {
          const data = await extractYoutube(payload.url, payload.model, payload.prompt);
          summary = data.summary;
      } else {
          summary = await extractReport(payload.url, payload.model, payload.prompt);
      }

      // Update target table
      if (type === 'youtube') {
        await query("UPDATE youtube_videos SET summary = $1 WHERE id = $2", [summary, target_id]);
        safeRevalidate('/youtube');
        safeRevalidate(`/youtube/${target_id}`);
      } else {
        await query("UPDATE reports SET summary = $1 WHERE id = $2", [summary, target_id]);
        safeRevalidate('/report');
        safeRevalidate('/saved');
      }

      // Mark as completed
      await query(
        "UPDATE gemini_queue SET status = 'completed' WHERE id = $1",
        [item.id]
      );
      result = { success: true };
    } catch (err: any) {
      console.error('Queue processing error:', err);
      // Mark as failed and increment retry count
      await query(
        "UPDATE gemini_queue SET status = 'failed', retry_count = retry_count + 1, error_message = $1 WHERE id = $2",
        [err.message, item.id]
      );
      result = { success: false, error: err.message };
    }

    safeRevalidate('/youtube');
    safeRevalidate('/report');
    return result;
  } catch (error: any) {
    console.error('processNextQueueItemAction error:', error);
    return { success: false, error: error.message };
  }
}

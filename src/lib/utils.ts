import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Checks if a thumbnail URL is likely the same as one of the images in the content.
 * Handles Naver's different hostnames and transformation query params.
 */
export function isThumbnailInContent(thumbnail?: string, content?: string): boolean {
  if (!thumbnail || !content) return false;

  // Extract common part of Naver images (the path after the hostname)
  const getNaverPath = (url: string) => {
    const match = url.match(/pstatic\.net\/(.+?)(\?|$)/);
    return match ? match[1] : url;
  };

  const thumbPath = getNaverPath(thumbnail);

  // Check if thumbPath exists in any <img> src in the content
  // We look for the path because Naver often uses different subdomains (mblogthumb-phinf vs postfiles)
  // or different type parameters (w800 vs original) for the same image asset.
  return content.includes(thumbPath);
}

/**
 * Parses various date formats and returns a simple YYYY-MM-DD string.
 */
export function formatDateToYMD(dateStr?: string): string {
  if (!dateStr) return '';

  let cleanDate = dateStr.trim();

  // Handle ISO-like strings with time (e.g., 2024-07-19T23:58:34+09:00)
  if (cleanDate.includes('T')) {
    return cleanDate.split('T')[0];
  }

  // Support "YYYY. MM. DD."
  if (/^\d{4}\.\s?\d{1,2}\.\s?\d{1,2}/.test(cleanDate)) {
    cleanDate = cleanDate.replace(/\.\s?/g, '-').replace(/-$/, '');
  }

  const d = new Date(cleanDate);
  if (isNaN(d.getTime())) {
    // Last ditch effort: try to match YYYY-MM-DD pattern directly
    const match = cleanDate.match(/(\d{4}-\d{1,2}-\d{1,2})/);
    return match ? match[1] : cleanDate;
  }

  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Long press handler logic
 * Prevents action if user moves more than moveThreshold
 */
export function getLongPressHandlers(callback: () => void, threshold = 600, moveThreshold = 10) {
    let timer: NodeJS.Timeout;
    let startX = 0;
    let startY = 0;

    const start = (e: any) => {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startX = clientX;
        startY = clientY;
        timer = setTimeout(callback, threshold);
    };

    const move = (e: any) => {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        if (Math.abs(clientX - startX) > moveThreshold || Math.abs(clientY - startY) > moveThreshold) {
            clearTimeout(timer);
        }
    };

    const end = () => {
        clearTimeout(timer);
    };

    return {
        onTouchStart: start,
        onTouchMove: move,
        onTouchEnd: end,
        onMouseDown: start,
        onMouseMove: move,
        onMouseUp: end,
        onMouseLeave: end
    };
}

/**
 * Resolves the direct PDF URL from Bondweb download parameters.
 */
export async function resolveBondwebPdfUrl(number: string, gn: string): Promise<string | null> {
    const endpoints = [
        'https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/DownloadPage.asp',
        'https://www.bondweb.co.kr/prime_web/menu01/research/DownloadPage.asp'
    ];

    for (const url of endpoints) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
                body: `number=${number}&gn=${gn}`,
                redirect: 'manual'
            });

            let fileUrl = '';
            if (res.status === 302 || res.status === 301) {
                fileUrl = res.headers.get('location') || '';
            } else {
                const cd = res.headers.get('content-disposition');
                if (cd && cd.includes('filename=')) {
                    const match = cd.match(/filename=([^;]*)/i);
                    if (match) fileUrl = match[1].trim().replace(/['"]/g, '');
                }
            }

            if (fileUrl) {
                return fileUrl.startsWith('http') ? fileUrl : 'https://www.bondweb.co.kr' + (fileUrl.startsWith('/') ? '' : '/') + fileUrl;
            }
        } catch (e) {
            // continue
        }
    }
    return null;
}

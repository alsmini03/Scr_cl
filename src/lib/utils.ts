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
export function formatDateToYMD(date: any): string {
  if (!date) return '';

  try {
    // 1. Handle string inputs with specific formats
    if (typeof date === 'string') {
      const clean = date.trim();

      // ISO Date part only: YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

      // Dot separated: YYYY. MM. DD. or YYYY.MM.DD
      const dotMatch = clean.match(/^(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})/);
      if (dotMatch) {
        return `${dotMatch[1]}-${dotMatch[2].padStart(2, '0')}-${dotMatch[3].padStart(2, '0')}`;
      }
    }

    // 2. Use Date object for everything else (ISO strings, Date objects, timestamps)
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      // Last ditch regex effort if Date parsing fails
      if (typeof date === 'string') {
        const match = date.match(/(\d{4}-\d{1,2}-\d{1,2})/);
        if (match) return match[1];
      }
      return String(date);
    }

    // Use local time components for consistent display and filtering
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return String(date);
  }
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

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

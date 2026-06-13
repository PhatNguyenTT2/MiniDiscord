import { api } from "@/lib/api";

type CachedUrl = {
  url: string;
  expiresAt: number;
};

// Global in-memory cache for resolved B2 view URLs
const urlCache = new Map<string, CachedUrl>();

// Global map tracking active fetch requests/promises (Request Deduping)
const activeRequests = new Map<string, Promise<string>>();

/**
 * Resolves a B2 file key to a pre-signed GET view URL with background caching & request deduping.
 * Prevents N+1 query storm where multiple StatusAvatar components reload the same key concurrently.
 */
export async function getResolvedFileUrl(fileKey: string): Promise<string> {
  if (!fileKey) return "";

  // 1. If key is already a full URL (Http/Https/Data URI), return it immediately
  if (
    fileKey.startsWith("http://") ||
    fileKey.startsWith("https://") ||
    fileKey.startsWith("data:") ||
    fileKey.startsWith("/")
  ) {
    return fileKey;
  }

  // 2. Check memory cache (deducting 15 mins safety buffer before URL expiration)
  const cached = urlCache.get(fileKey);
  if (cached && Date.now() < cached.expiresAt - 15 * 60 * 1000) {
    return cached.url;
  }

  // 3. Check if there is already an active fetch request for this file key
  let promise = activeRequests.get(fileKey);
  if (!promise) {
    promise = (async () => {
      try {
        const res = await api.get<{ data: { url: string; expiresIn: number } }>(
          `/files/url?key=${encodeURIComponent(fileKey)}`,
          { timeout: 5000 }
        );
        const { url, expiresIn } = res.data.data;
        if (url) {
          urlCache.set(fileKey, {
            url,
            expiresAt: Date.now() + expiresIn * 1000,
          });
          return url;
        }
        return "";
      } catch (err) {
        return "";
      } finally {
        activeRequests.delete(fileKey);
      }
    })();
    activeRequests.set(fileKey, promise);
  }

  return promise;
}

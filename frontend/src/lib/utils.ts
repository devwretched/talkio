export function cn(...parts: (string | undefined | false | null)[]) {
  return parts.filter(Boolean).join(" ");
}

export function resolveAssetUrl(url?: string | null) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith("/") ? url : `/${url}`;
}

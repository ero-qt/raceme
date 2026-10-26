/** Gives the start page's path, which is the base path without its trailing slash or `/` at the root. */
export function homePath(base: string): string {
  return base.replace(/\/$/, "") || "/";
}

/** Gives the path below the base path, so `/apps/raceme` and `/apps/raceme/` both give `/`. */
export function pagePath(pathname: string, base: string): string {
  return pathname === homePath(base) ? "/" : pathname.slice(base.length - 1);
}

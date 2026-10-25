const segment = /^[a-z0-9][a-z0-9._-]*$/i;

/**
 * Turns a configured base path like `apps/raceme/` into a URL prefix like `/apps/raceme`,
 * with root as `""`.
 */
export function normalizeBasePath(raw: string): string {
  const parts = raw.split("/").filter((part) => part !== "");
  for (const part of parts) {
    if (!segment.test(part)) {
      throw new Error(`Invalid base path '${raw}'.`);
    }
  }
  return parts.length === 0 ? "" : `/${parts.join("/")}`;
}

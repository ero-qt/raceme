import { join, normalize } from "node:path";

/**
 * Serves a built client file from `staticDir`, falling back to `index.html` so the client router
 * can show `/<slug>`.
 */
export async function serveStatic(staticDir: string, path: string): Promise<Response> {
  const relative = normalize(path);
  const file = Bun.file(join(staticDir, relative));

  if (relative !== "/" && (await file.exists())) {
    // Vite puts a content hash in every file name under `assets/`, so those never change.
    const cacheControl = relative.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "no-cache";
    return new Response(file, { headers: { "cache-control": cacheControl } });
  }

  return new Response(Bun.file(join(staticDir, "index.html")), {
    headers: { "cache-control": "no-cache" },
  });
}

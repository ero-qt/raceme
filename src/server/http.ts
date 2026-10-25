const contentSecurityPolicy = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders: Record<string, string> = {
  "content-security-policy": contentSecurityPolicy,
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

/** Adds the security headers to a raceme response. */
export function withSecurityHeaders(response: Response): Response {
  for (const [name, value] of Object.entries(securityHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function status(code: number): Response {
  return new Response(null, { status: code });
}

/** Checks the `Origin` header, which browsers always send on POST and websocket requests. */
export function isAllowedOrigin(request: Request, allowedOrigin: string | null): boolean {
  if (allowedOrigin === null) {
    return true;
  }
  return request.headers.get("origin") === allowedOrigin;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";

  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      return value.join("=");
    }
  }
  return null;
}

export function cookie(
  name: string,
  value: string,
  options: { path: string; maxAgeSeconds: number; secure: boolean },
): string {
  const secure = options.secure ? "; Secure" : "";
  const attributes = `Path=${options.path}; Max-Age=${options.maxAgeSeconds}; HttpOnly${secure}`;
  return `${name}=${value}; ${attributes}; SameSite=Strict`;
}

/**
 * Picks the key rate limits count against: the address for IPv4 and the /64 prefix for IPv6,
 * because providers usually give one IPv6 customer a whole /64.
 */
export function rateLimitKey(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped?.[1]) {
    return mapped[1];
  }
  if (!ip.includes(":")) {
    return ip;
  }

  const [head = "", tail = ""] = ip.toLowerCase().split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const missing = Math.max(0, 8 - headGroups.length - tailGroups.length);
  const groups = [...headGroups, ...Array(missing).fill("0"), ...tailGroups];

  const prefix = groups.slice(0, 4).map((group) => Number.parseInt(group || "0", 16).toString(16));
  return `${prefix.join(":")}::/64`;
}

/**
 * Groups a rate limit key into its network, an IPv4 /24 or an IPv6 /48, the blocks one provider
 * usually hands to a single customer.
 */
export function networkKey(key: string): string {
  if (key.endsWith("::/64")) {
    return `${key.split(":").slice(0, 3).join(":")}::/48`;
  }

  return `${key.split(".").slice(0, 3).join(".")}.0/24`;
}

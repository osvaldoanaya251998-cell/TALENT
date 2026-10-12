export const POST_AUTH_REDIRECT_KEY = "momento_post_auth_redirect";

export type RegistrationRole = "candidate" | "company";

export type PostAuthRedirect = {
  next?: string;
  vacancy?: string;
};

const FALLBACK_PATH = "/profile";
const SAFE_ORIGIN = "https://momento.local";

export function sanitizeNextPath(value?: string | null, fallback = FALLBACK_PATH) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, SAFE_ORIGIN);
    if (url.origin !== SAFE_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}

export function buildPostAuthRedirectPath(redirect?: PostAuthRedirect | null, role?: unknown) {
  if (role === "company") {
    const next = sanitizeNextPath(redirect?.next, "/recruiter/dashboard");
    const url = new URL(next, SAFE_ORIGIN);
    return url.pathname === "/recruiter/candidates"
      ? `${url.pathname}${url.search}`
      : "/recruiter/dashboard";
  }

  const next = sanitizeNextPath(redirect?.next, FALLBACK_PATH);
  const url = new URL(next, SAFE_ORIGIN);
  if (url.pathname === "/apply" && redirect?.vacancy) {
    url.searchParams.set("vacancy", redirect.vacancy);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function savePostAuthRedirect(redirect: PostAuthRedirect) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, JSON.stringify(redirect));
}

export function readPostAuthRedirect(): PostAuthRedirect | null {
  if (typeof window === "undefined") return null;
  const stored = window.sessionStorage.getItem(POST_AUTH_REDIRECT_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as PostAuthRedirect;
  } catch {
    return null;
  }
}

export function clearPostAuthRedirect() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
}

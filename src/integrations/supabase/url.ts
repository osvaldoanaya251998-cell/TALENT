// The dashboard's Data API copy button includes /rest/v1. Auth needs the base URL.
export function normalizeSupabaseUrl(value: string): string {
  return value.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

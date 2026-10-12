export async function translateInterfaceBatch(
  sources: string[],
  language: string,
  signal?: AbortSignal,
): Promise<string[]> {
  // This public, anonymous endpoint has no API key or billing account.
  // Send only registered interface copy; never send user-created content.
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.search = new URLSearchParams({
    client: "gtx",
    sl: "es",
    tl: language,
    dt: "t",
    q: sources.join("\n"),
  }).toString();
  const response = await fetch(url, { signal, credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error("Translation unavailable");
  const body: unknown = await response.json();
  if (!Array.isArray(body) || !Array.isArray(body[0])) throw new Error("Invalid translation");
  const segments = body[0] as unknown[];
  if (segments.some((segment) => !Array.isArray(segment) || typeof segment[0] !== "string")) {
    throw new Error("Invalid translation");
  }
  const translated = segments
    .map((segment) => (segment as string[])[0])
    .join("")
    .replace(/\r/g, "");
  const lines = translated.split("\n");
  if (lines.length !== sources.length || lines.some((line) => !line.trim() || line.length > 6000)) {
    // Preserve the mapping between interface strings when the service merges lines.
    if (sources.length === 1) throw new Error("Incomplete translation");
    const result: string[] = [];
    for (const source of sources)
      result.push((await translateInterfaceBatch([source], language, signal))[0]);
    return result;
  }
  return lines;
}

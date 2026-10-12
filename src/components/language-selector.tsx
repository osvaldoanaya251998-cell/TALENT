import { Globe, Loader2, TriangleAlert } from "lucide-react";
import { useLanguage } from "@/lib/i18n/provider";
import { LANGUAGE_NAMES, LANGUAGE_DISPLAY_NAMES } from "@/lib/i18n/languages";

const preferred = ["es", "en", "pt", "fr", "de", "zh-cn", "ar", "hi", "ja", "ko"];
const names = Object.keys(LANGUAGE_NAMES)
  .map((code) => {
    const name = LANGUAGE_DISPLAY_NAMES[code] ?? LANGUAGE_NAMES[code];
    return { code, name };
  })
  .sort((a, b) => {
    const first = preferred.indexOf(a.code),
      second = preferred.indexOf(b.code);
    if (first >= 0 || second >= 0) return (first < 0 ? 999 : first) - (second < 0 ? 999 : second);
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });

export function LanguageSelector() {
  const { language, setLanguage, tr, translating, unavailable, ready } = useLanguage();
  const status = unavailable
    ? tr("Traducción no disponible. Se muestra el texto original.")
    : translating
      ? tr("Preparando traducción…")
      : tr("Cambiar idioma");
  return (
    <div
      className="relative inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground"
      title={status}
    >
      {translating ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
      ) : (
        <Globe className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      )}
      <select
        aria-label="Idioma / Language"
        value={language}
        disabled={!ready}
        onChange={(event) => setLanguage(event.target.value)}
        className="max-w-[130px] bg-transparent text-xs outline-none sm:text-sm"
      >
        {names.map(({ code, name }) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      {unavailable && <TriangleAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />}
      <span role="status" aria-live="polite" className="sr-only">
        {translating || unavailable ? status : ""}
      </span>
    </div>
  );
}

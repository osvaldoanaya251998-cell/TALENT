import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function useTheme() {
  // Start with "light" on both server and first client render to avoid hydration mismatch.
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    try { localStorage.setItem("momento_theme", theme); } catch { /* Storage can be unavailable in private browsing. */ }
  }, [theme, mounted]);

  return { theme, mounted, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

export function ThemeToggle() {
  const { theme, mounted, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!mounted}
      aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
      title={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
      suppressHydrationWarning
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground hover:border-primary/50"
    >
      <span suppressHydrationWarning>
        {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </span>
    </button>
  );
}

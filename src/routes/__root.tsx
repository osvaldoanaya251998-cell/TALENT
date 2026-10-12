import { useLanguage } from "@/lib/i18n/provider";
import { LanguageProvider } from "@/lib/i18n/provider";
import { LanguageSelector } from "@/components/language-selector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

const themeBootScript = `(() => { let saved; try { saved = localStorage.getItem('momento_theme'); } catch (_) {} const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; const dark = saved === 'dark' || (saved !== 'light' && prefersDark); document.documentElement.classList.toggle('dark', dark); document.documentElement.style.colorScheme = dark ? 'dark' : 'light'; })();`;

function NotFoundComponent() {
  const { tr } = useLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mb-6">
          <LanguageSelector />
        </div>
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{tr("Página no encontrada")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr("La página que buscas no existe o fue movida.")}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            {tr("Volver al inicio")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: import("@tanstack/react-router").ErrorComponentProps) {
  const { tr } = useLanguage();
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mb-6">
          <LanguageSelector />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {tr("Algo salió mal")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr("Intenta recargar la página o vuelve al inicio.")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {tr("Reintentar")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            {tr("Ir al inicio")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Trabaja en InsurTalent — Carreras" },
      {
        name: "description",
        content:
          "Únete a InsurTalent. Cultura startup, crecimiento profesional real y capacitación. Aplica en minutos.",
      },
      { property: "og:title", content: "Trabaja en InsurTalent — Carreras" },
      {
        property: "og:description",
        content:
          "Únete a InsurTalent. Cultura startup, crecimiento profesional real y capacitación. Aplica en minutos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Trabaja en InsurTalent — Carreras" },
      {
        name: "twitter:description",
        content:
          "Únete a InsurTalent. Cultura startup, crecimiento profesional real y capacitación. Aplica en minutos.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7e21c83e-4d02-413b-aefb-9709727cecff/id-preview-78be09a8--231686be-2162-4111-ae95-385ff6686933.lovable.app-1783036216425.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7e21c83e-4d02-413b-aefb-9709727cecff/id-preview-78be09a8--231686be-2162-4111-ae95-385ff6686933.lovable.app-1783036216425.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <RootDocument>{children}</RootDocument>
    </LanguageProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  const { language, direction, tr } = useLanguage();
  const originalTitle = useRouterState({
    select: (state) => {
      for (const match of [...state.matches].reverse()) {
        for (const meta of match.meta ?? []) {
          if (meta && "title" in meta && typeof meta.title === "string") return meta.title;
        }
      }
      return "Trabaja en InsurTalent — Carreras";
    },
  });
  useEffect(() => {
    document.title = tr(originalTitle);
  }, [originalTitle, language, tr]);
  return (
    <html lang={language} dir={direction} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}

import { LanguageSelector } from "@/components/language-selector";
import { useLanguage } from "@/lib/i18n/provider";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { z } from "zod";
import {
  buildPostAuthRedirectPath,
  clearPostAuthRedirect,
  readPostAuthRedirect,
} from "@/lib/auth-redirect";
import momentoLogo from "@/assets/insurtalent-logo.png";

export const Route = createFileRoute("/auth_/callback")({
  validateSearch: (search) => z.object({ next: z.string().optional() }).parse(search),
  head: () => ({
    meta: [
      { title: "Confirmando acceso — InsurTalent Careers" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const { tr } = useLanguage();
  const [failed, setFailed] = useState(false);
  const { next } = Route.useSearch();

  useEffect(() => {
    let active = true;
    let completed = false;

    const finish = (session: Session | null) => {
      if (!active || !session || completed) return;
      completed = true;
      const targetPath = buildPostAuthRedirectPath(
        readPostAuthRedirect() ?? { next },
        session.user.user_metadata.role,
      );
      clearPostAuthRedirect();
      window.location.replace(targetPath);
    };

    void supabase.auth.getSession().then(({ data }) => finish(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      finish(session);
    });

    const timeoutId = window.setTimeout(() => {
      if (active && !completed) setFailed(true);
    }, 7000);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      sub.subscription.unsubscribe();
    };
  }, [next]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-6 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
        <div className="mb-4 flex justify-end">
          <LanguageSelector />
        </div>
        <Link to="/" className="mb-6 inline-flex items-center justify-center gap-2">
          <img src={momentoLogo} alt="InsurTalent" className="h-6 w-6" />
          <span className="text-sm font-semibold">{tr("InsurTalent Careers")}</span>
        </Link>
        {failed ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight">
              {tr("No pudimos confirmar tu sesión")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {tr("Intenta iniciar sesión con Google nuevamente.")}
            </p>
            <Link
              to="/auth"
              className="mt-6 inline-flex text-sm font-medium text-primary hover:underline"
            >
              {tr("Volver a iniciar sesión")}
            </Link>
          </>
        ) : (
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            {tr("Confirmando acceso…")}
          </div>
        )}
      </div>
    </div>
  );
}

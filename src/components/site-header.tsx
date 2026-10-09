import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import logo from "@/assets/insurtalent-logo.svg";

export function useSessionRole() {
  const [state, setState] = useState<{ signedIn: boolean; recruiter: boolean } | null>(null);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (!u) return setState({ signedIn: false, recruiter: false });
      const [a, r] = await Promise.all([
        supabase.rpc("has_role", { _user_id: u.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: u.id, _role: "recruiter" }),
      ]);
      setState({ signedIn: true, recruiter: !!a.data || !!r.data });
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <img src={logo} alt="InsurTalent" className="h-8 w-8" />
      <span className={`text-lg font-bold tracking-tight ${light ? "text-navy-foreground" : "text-foreground"}`}>
        Insur<span className="text-primary">Talent</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const s = useSessionRole();
  const [open, setOpen] = useState(false);
  const links = (
    <>
      <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }} className="hover:text-foreground">Inicio</Link>
      <Link to="/jobs" activeProps={{ className: "text-foreground" }} className="hover:text-foreground">Buscar empleo</Link>
      <Link to={s?.recruiter ? "/recruiter/dashboard" : "/empresas"} activeProps={{ className: "text-foreground" }} className="hover:text-foreground">Para empresas</Link>
    </>
  );
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">{links}</nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {s?.signedIn ? (
            <>
              {s.recruiter && (
                <Link to="/recruiter/dashboard" className="hidden sm:block"><Button variant="outline" size="sm">Panel reclutador</Button></Link>
              )}
              <Link to="/profile"><Button size="sm">Mi perfil</Button></Link>
            </>
          ) : (
            <>
              <Link to="/auth" className="hidden sm:block"><Button variant="ghost" size="sm">Iniciar sesión</Button></Link>
              <Link to="/auth"><Button size="sm">Registrarme</Button></Link>
            </>
          )}
          <button className="md:hidden p-2" onClick={() => setOpen((o) => !o)} aria-label="Menú">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && <nav className="flex flex-col gap-3 border-t border-border px-6 py-4 text-sm text-muted-foreground md:hidden">{links}</nav>}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 md:flex-row">
        <Logo />
        <p className="text-center text-xs text-muted-foreground">
          El punto de encuentro entre el talento experto y las mejores firmas del sector seguros. © {new Date().getFullYear()}
        </p>
        <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground">Acceso reclutadores</Link>
      </div>
    </footer>
  );
}

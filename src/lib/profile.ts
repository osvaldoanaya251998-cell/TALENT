import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type ProfileCompletion = {
  percent: number;
  missing: string[];
  ready: boolean;
};

type Field = { key: keyof Profile; label: string; check?: (p: Profile) => boolean };

const REQUIRED_FOR_APPLY: Field[] = [
  { key: "nombre", label: "Nombre" },
  { key: "email", label: "Correo" },
  { key: "telefono", label: "Teléfono" },
  { key: "ciudad", label: "Ciudad" },
  { key: "cv_url", label: "CV en PDF" },
  { key: "accepted_privacy_policy", label: "Aviso de privacidad" },
];

const NICE_TO_HAVE: Field[] = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "experiencia", label: "Años de experiencia", check: (p) => (p.experiencia ?? 0) > 0 },
  { key: "skills", label: "Habilidades", check: (p) => Array.isArray(p.skills) && p.skills.length > 0 },
  { key: "video_url", label: "Video (opcional)" },
];

export function getCompletion(p: Profile | null): ProfileCompletion {
  if (!p) return { percent: 0, missing: REQUIRED_FOR_APPLY.map((r) => r.label), ready: false };
  const all = [...REQUIRED_FOR_APPLY, ...NICE_TO_HAVE];
  let done = 0;
  const missing: string[] = [];
  for (const f of all) {
    const val = p[f.key];
    const ok = f.check ? f.check(p) : Boolean(val && (typeof val !== "string" || val.trim() !== ""));
    if (ok) done += 1;
    else if (REQUIRED_FOR_APPLY.some((r) => r.key === f.key)) missing.push(f.label);
  }
  const percent = Math.round((done / all.length) * 100);
  const ready = REQUIRED_FOR_APPLY.every((f) => {
    const val = p[f.key];
    return f.key === "accepted_privacy_policy"
      ? val === true
      : Boolean(val && (typeof val !== "string" || val.trim() !== ""));
  });
  return { percent, missing, ready };
}

export async function fetchMyProfile(): Promise<Profile | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", u.user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

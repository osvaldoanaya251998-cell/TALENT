export const RAMOS = ["Vida", "GMM", "Autos", "Daños", "Fianzas", "Reaseguro"] as const;
export const PAY_SCHEMES = ["Mixto", "Solo Comisión", "Sueldo Base Fijo"] as const;
export const CEDULAS = ["Cédula A", "Cédula B", "Cédula C", "No requiere"] as const;
export const MODALITIES = [
  { v: "presencial", l: "Presencial" },
  { v: "hibrido", l: "Híbrido" },
  { v: "remoto", l: "Remoto" },
] as const;
export const CERTIFICACIONES = ["Cédula CNSF A", "Cédula CNSF B", "Cédula CNSF C", "AMIB", "AMASFAC", "CNSF Fianzas"] as const;

export function modalityLabel(m: string | null | undefined) {
  return MODALITIES.find((x) => x.v === m)?.l ?? "—";
}

export type Vacancy = {
  id: string; title: string; slug: string; description: string | null; is_active: boolean;
  company: string | null; ramos: string[]; pay_scheme: string | null; salary_text: string | null;
  cedula: string; location: string | null; modality: string | null;
  requirements: string | null; benefits: string | null; status: string; created_at: string; company_logo_url?: string | null;
};

export const VACANCY_COLUMNS =
  "id,title,slug,description,is_active,company,ramos,pay_scheme,salary_text,cedula,location,modality,requirements,benefits,status,created_at,company_logo_url";

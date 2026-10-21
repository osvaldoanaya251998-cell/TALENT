import { supabase } from "@/integrations/supabase/client";
import type { MetricApplication, MetricVacancy } from "./recruitment-metrics";

export async function collectPages<T>(
  fetchPage: (from: number, to: number) => Promise<{ rows: T[]; total: number | null }>,
) {
  const rows: T[] = [];
  for (let offset = 0; ;) {
    const page = await fetchPage(offset, offset + 999);
    rows.push(...page.rows);
    offset += page.rows.length;
    if (!page.rows.length || (page.total !== null ? offset >= page.total : page.rows.length < 1000))
      return rows;
  }
}

export async function loadRecruitmentMetrics(ownerId: string) {
  const vacancies = await collectPages<MetricVacancy>(async (from, to) => {
    const result = await supabase
      .from("vacancies")
      .select("id,title,is_active", { count: "exact" })
      .eq("created_by", ownerId)
      .order("id")
      .range(from, to);
    if (result.error) throw result.error;
    return { rows: result.data ?? [], total: result.count };
  });
  const applications: MetricApplication[] = [];
  // Keep URLs short even when one company has many vacancies. RLS still applies.
  for (let offset = 0; offset < vacancies.length; offset += 50) {
    const ids = vacancies.slice(offset, offset + 50).map((v) => v.id);
    applications.push(
      ...(await collectPages<MetricApplication>(async (from, to) => {
        const result = await supabase
          .from("applications")
          .select(
            "id,vacancy_id,candidate_id,user_id,status,created_at,candidate:candidates(nombre)",
            { count: "exact" },
          )
          .in("vacancy_id", ids)
          .order("id")
          .range(from, to);
        if (result.error) throw result.error;
        return { rows: (result.data ?? []) as unknown as MetricApplication[], total: result.count };
      })),
    );
  }
  return { vacancies, applications: [...new Map(applications.map((a) => [a.id, a])).values()] };
}

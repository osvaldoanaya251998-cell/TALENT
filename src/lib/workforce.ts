import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WorkforceInput = {
  owner_id: string;
  month: string;
  headcount_start: number;
  hires: number;
  departures: number;
  target_percent: number | null;
  notes: string | null;
};
export type WorkforcePeriod = WorkforceInput & {
  id: string;
  headcount_end: number;
  created_at: string;
  updated_at: string;
};
type WorkforceDatabase = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & {
      recruiter_workforce_periods: {
        Row: WorkforcePeriod;
        Insert: WorkforceInput;
        Update: Partial<WorkforceInput>;
        Relationships: [];
      };
    };
  };
};
export const workforceClient = supabase as unknown as SupabaseClient<WorkforceDatabase>;

export { calculateTurnover } from "./workforce-metrics";
export function turnoverStorageMissing(error: { code?: string } | null) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

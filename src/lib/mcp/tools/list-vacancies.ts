import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export default defineTool({
  name: "list_vacancies",
  title: "List active vacancies",
  description: "List active job vacancies (public careers listings) from InsurTalent.",
  inputSchema: {
    includeInactive: z
      .boolean()
      .optional()
      .describe("Include inactive vacancies (default: false)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ includeInactive }) => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let query = supabase
      .from("vacancies")
      .select("id, slug, title, description, is_active, created_at")
      .order("created_at", { ascending: false });
    if (!includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { vacancies: data ?? [] },
    };
  },
});

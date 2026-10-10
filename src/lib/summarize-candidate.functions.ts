import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({ application_id: z.string().uuid() });

export const summarizeCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Admin check
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Response("Forbidden", { status: 403 });

    // 2) Load application and candidate
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: app, error: appErr } = await supabaseAdmin
      .from("applications")
      .select(
        "id,respuestas,vacancy:vacancies(title,description),candidate:candidates(nombre,email,telefono,ciudad,linkedin,experiencia,uploads(cv_url))"
      )
      .eq("id", data.application_id)
      .maybeSingle();
    if (appErr || !app) throw new Response("Not found", { status: 404 });

    // 4) Attempt to download CV as base64
    const cvPath: string | undefined = (app as any).candidate?.uploads?.[0]?.cv_url;
    let cvPart: any = null;
    if (cvPath) {
      const { data: file } = await supabaseAdmin.storage.from("applications").download(cvPath);
      if (file) {
        const buf = new Uint8Array(await file.arrayBuffer());
        const MAX = 8 * 1024 * 1024; // 8MB safety cap
        if (buf.byteLength <= MAX) {
          // base64 encode
          let bin = "";
          for (let i = 0; i < buf.byteLength; i++) bin += String.fromCharCode(buf[i]);
          const b64 = btoa(bin);
          const mime = cvPath.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : file.type || "application/octet-stream";
          if (mime === "application/pdf") {
            cvPart = {
              type: "file",
              file: {
                filename: cvPath.split("/").pop() || "cv.pdf",
                file_data: `data:${mime};base64,${b64}`,
              },
            };
          } else if (mime.startsWith("image/")) {
            cvPart = {
              type: "image_url",
              image_url: { url: `data:${mime};base64,${b64}` },
            };
          }
        }
      }
    }

    // 5) Build prompt
    const cand = (app as any).candidate ?? {};
    const vac = (app as any).vacancy ?? {};
    const respuestasText = Object.entries(app.respuestas ?? {})
      .map(([k, v]) => `- ${k}: ${String(v)}`)
      .join("\n");

    const system = `Eres un reclutador senior del sector asegurador. Elabora un análisis profesional, directo y accionable del candidato. Sé conciso (máx. 240 palabras). Escribe en español neutro. NO inventes datos; si algo falta, dilo explícitamente.

Si se adjunta CV en PDF: LÉELO y extrae empresas, puestos, años, logros medibles y certificaciones. El "Perfil profesional" debe basarse principalmente en el CV, no sólo en los datos del formulario.

Devuelve SOLO Markdown con exactamente estas secciones y encabezados (usa ## para cada uno, sin texto antes ni después):

## Perfil profesional
2-3 líneas sobre trayectoria clave extraída del CV (empresas, roles, años, sector).

## Fortalezas
- 3-5 bullets muy breves.

## Áreas de oportunidad
- 2-4 bullets muy breves.

## Recomendación
Una sola línea: **Avanzar**, **Entrevistar** o **Descartar** — y por qué en máx. 15 palabras.`;

    const userParts: any[] = [
      {
        type: "text",
        text: `Vacante: ${vac.title ?? "—"}\n${vac.description ? `Descripción: ${vac.description}\n` : ""}
Candidato: ${cand.nombre ?? "—"}
Ciudad: ${cand.ciudad ?? "—"} · Experiencia: ${cand.experiencia ?? 0} años
LinkedIn: ${cand.linkedin ?? "—"}

Respuestas de postulación:
${respuestasText || "—"}

${cvPart ? "Adjunto el CV en PDF para que extraigas experiencia relevante." : "No se adjunta CV; basa el perfil sólo en los datos anteriores."}`,
      },
    ];
    if (cvPart) userParts.push(cvPart);

    // 6) Call Lovable AI Gateway
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Response("Missing LOVABLE_API_KEY", { status: 500 });

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userParts },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Response(`AI error: ${resp.status} ${text}`, { status: 500 });
    }
    const json: any = await resp.json();
    const summary: string =
      json?.choices?.[0]?.message?.content ?? "No se pudo generar el resumen.";

    return { summary, hasCv: !!cvPart };
  });

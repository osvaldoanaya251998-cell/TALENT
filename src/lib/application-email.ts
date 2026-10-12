export type ApplicationEmail = {
  notification_id: string;
  lease_token: string;
  application_id: string;
  vacancy_id: string;
  recruiter_email: string;
  vacancy_title: string;
  candidate_name: string;
  candidate_phone: string;
  candidate_email: string;
  attempts: number;
};

export function isEmailAddress(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value)
  );
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );

export function renderApplicationEmail(application: ApplicationEmail, siteOrigin: string) {
  const panel = new URL("/recruiter/candidates", siteOrigin);
  panel.searchParams.set("vacancy", application.vacancy_id);
  panel.searchParams.set("application", application.application_id);
  const title = application.vacancy_title || "Vacante";
  const name = application.candidate_name || "Candidato";
  const phone = application.candidate_phone || "No indicado";
  const email = application.candidate_email || "No indicado";
  const canReply = isEmailAddress(application.candidate_email);
  const text = [
    "Nuevo talento postulado 🎯",
    "",
    `• Vacante: ${title}`,
    `• Candidato: ${name}`,
    `• Contacto: ${phone} | ${email}`,
    "",
    "Revisa su perfil y CV completo en tu panel de InsurTalent.",
    panel.href,
    ...(canReply ? ["", "Puedes responder este correo para contactar al candidato."] : []),
  ].join("\n");
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f7f8f6;color:#16213b;font-family:Arial,sans-serif;padding:24px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:28px;overflow-wrap:anywhere"><p style="font-weight:bold;color:#007d68">InsurTalent</p><h1 style="font-size:24px">Nuevo talento postulado 🎯</h1><p><strong>Vacante:</strong> ${escapeHtml(title)}</p><p><strong>Candidato:</strong> ${escapeHtml(name)}</p><p><strong>Contacto:</strong> ${escapeHtml(phone)} | ${escapeHtml(email)}</p><p>Revisa su perfil y CV completo en tu panel de InsurTalent.</p><p style="margin:28px 0"><a href="${escapeHtml(panel.href)}" style="background:#007d68;color:#fff;border-radius:8px;padding:12px 18px;text-decoration:none;display:inline-block">Ver candidato y CV</a></p>${canReply ? '<p style="font-size:13px;color:#536078">Puedes responder este correo para contactar al candidato.</p>' : ""}</div></body></html>`;
  return {
    subject: "Nuevo talento postulado 🎯 | InsurTalent",
    textContent: text,
    htmlContent: html,
  };
}

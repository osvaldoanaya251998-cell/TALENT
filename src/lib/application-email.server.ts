import { isEmailAddress, renderApplicationEmail, type ApplicationEmail } from "./application-email";
import { normalizeSupabaseUrl } from "@/integrations/supabase/url";

type NotificationEnv = {
  APPLICATION_EMAILS_ENABLED?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  BREVO_API_KEY?: string;
  APPLICATION_EMAIL_FROM?: string;
  APP_PUBLIC_URL?: string;
};

class DeliveryError extends Error {
  constructor(
    public code: string,
    public review = false,
    public retrySeconds = 60,
  ) {
    super(code);
  }
}

function configuration(env: NotificationEnv) {
  if (env.APPLICATION_EMAILS_ENABLED !== "true") return null;
  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_SERVICE_ROLE_KEY ||
    !env.BREVO_API_KEY ||
    !isEmailAddress(env.APPLICATION_EMAIL_FROM) ||
    !env.APP_PUBLIC_URL
  )
    return null;
  try {
    const site = new URL(env.APP_PUBLIC_URL);
    const supabase = new URL(normalizeSupabaseUrl(env.SUPABASE_URL));
    if (
      site.protocol !== "https:" ||
      supabase.protocol !== "https:" ||
      site.username ||
      site.password ||
      supabase.username ||
      supabase.password
    )
      return null;
    return { env, siteOrigin: site.origin, supabaseOrigin: supabase.origin };
  } catch {
    return null;
  }
}

// Only the scheduled server plugin imports this file. No public sending endpoint.
export async function processApplicationEmails(
  env: NotificationEnv,
  request: typeof fetch = fetch,
) {
  const config = configuration(env);
  if (!config) return { enabled: false, sent: 0, deferred: 0 };
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = new Headers({ apikey: serviceKey, "content-type": "application/json" });
  if (!serviceKey.startsWith("sb_secret_")) headers.set("authorization", `Bearer ${serviceKey}`);
  async function rpc<T>(name: string, body: unknown): Promise<T> {
    const response = await request(`${config!.supabaseOrigin}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new DeliveryError(`queue_http_${response.status}`);
    return response.json() as Promise<T>;
  }
  const pending = await rpc<ApplicationEmail[]>("claim_application_emails", {});
  let sent = 0,
    deferred = 0;
  for (const application of pending) {
    let accepted = false;
    try {
      if (!isEmailAddress(application.recruiter_email))
        throw new DeliveryError("invalid_recipient", true);
      let response: Response;
      try {
        response = await request("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": env.BREVO_API_KEY!,
            "content-type": "application/json",
            accept: "application/json",
          },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            sender: { name: "InsurTalent", email: env.APPLICATION_EMAIL_FROM },
            to: [{ email: application.recruiter_email }],
            ...renderApplicationEmail(application, config.siteOrigin),
            ...(isEmailAddress(application.candidate_email)
              ? { replyTo: { email: application.candidate_email } }
              : {}),
            headers: { idempotencyKey: application.notification_id },
            tags: ["nueva-postulacion"],
          }),
        });
      } catch {
        throw new DeliveryError("delivery_confirmation_unknown", true);
      }
      if (!response.ok) {
        const delay =
          response.status === 429
            ? 86400
            : Math.min(21600, 60 * 2 ** Math.min(application.attempts - 1, 8));
        throw new DeliveryError(
          `brevo_http_${response.status}`,
          response.status === 400 || response.status === 422,
          delay,
        );
      }
      accepted = true;
      const body = (await response.json().catch(() => ({}))) as { messageId?: string };
      const finished = await rpc<boolean>("finish_application_email", {
        _notification_id: application.notification_id,
        _lease_token: application.lease_token,
        _provider_message_id: typeof body.messageId === "string" ? body.messageId : "accepted",
      });
      if (!finished) throw new DeliveryError("delivery_confirmation_unknown", true);
      sent++;
    } catch (error) {
      const failure =
        error instanceof DeliveryError ? error : new DeliveryError("delivery_error", true);
      await rpc("retry_application_email", {
        _notification_id: application.notification_id,
        _lease_token: application.lease_token,
        _error: accepted ? "delivery_confirmation_unknown" : failure.code,
        _retry_seconds: failure.retrySeconds,
        _needs_review: accepted || failure.review,
      }).catch(() => {
        /* Expired leases go to needs_review, never silently resend. */
      });
      deferred++;
    }
  }
  return { enabled: true, sent, deferred };
}

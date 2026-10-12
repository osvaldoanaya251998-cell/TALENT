import { definePlugin } from "nitro";
import { processApplicationEmails } from "../../lib/application-email.server";

export default definePlugin((nitro) => {
  nitro.hooks.hook("cloudflare:scheduled", async ({ env }) => {
    try {
      const result = await processApplicationEmails(
        env as Parameters<typeof processApplicationEmails>[0],
      );
      if (result.enabled) console.info("[application-emails]", result);
    } catch {
      // Never log credentials, candidate data or the mail provider's response body.
      console.error("[application-emails] queue_unavailable");
    }
  });
});

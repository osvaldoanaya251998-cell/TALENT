import { PGlite } from "@electric-sql/pglite";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const bundled = await build({
  entryPoints: [new URL("../src/lib/application-email.server.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { processApplicationEmails } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(301),
  otherOwner = id(302),
  candidate = id(303);
const vacancy = id(310),
  otherVacancy = id(311);
const migrate = await readFile(
  new URL(
    "../supabase/migrations/20261012000000_application_email_notifications.sql",
    import.meta.url,
  ),
  "utf8",
);
const rpc = async (name, values = []) =>
  (
    await db.query(
      `SELECT * FROM public.${name}(${values.map((_, i) => `$${i + 1}`).join(",")})`,
      values,
    )
  ).rows;

try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}',email_confirmed_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$SELECT string_to_array($1,'/')$$;
    GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon,service_role;`);
  await db.exec(
    await readFile(new URL("../supabase/setup/nuevo-proyecto.sql", import.meta.url), "utf8"),
  );
  await db.exec(migrate);
  for (const [uid, email, role] of [
    [owner, "recruiter@example.test", "company"],
    [otherOwner, "other@example.test", "company"],
    [candidate, "candidate@example.test", "candidate"],
  ]) {
    await db.query(
      "INSERT INTO auth.users(id,email,raw_user_meta_data,email_confirmed_at) VALUES($1,$2,$3,now())",
      [uid, email, JSON.stringify({ role })],
    );
  }
  await db.query(
    "UPDATE public.profiles SET nombre='Ana <script>alert(1)</script>',email='candidate@example.test',telefono='5551234567',ciudad='Puebla',cv_url='private/cv.pdf',accepted_privacy_policy=true WHERE user_id=$1",
    [candidate],
  );
  await db.query("UPDATE public.profiles SET email='spoofed@example.test' WHERE user_id=$1", [
    owner,
  ]);
  for (const [vid, uid] of [
    [vacancy, owner],
    [otherVacancy, otherOwner],
  ])
    await db.query(
      "INSERT INTO public.vacancies(id,title,slug,is_active,created_by) VALUES($1,'Vacante & seguros',$2,true,$3)",
      [vid, `email-${vid}`, uid],
    );
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [candidate]);
  await db.exec("SET ROLE authenticated;");
  const apply = async (vid) =>
    (await db.query("SELECT public.apply_to_vacancy($1) AS result", [vid])).rows[0].result;
  const first = await apply(vacancy),
    repeated = await apply(vacancy);
  assert.equal(repeated.application_id, first.application_id);
  assert.equal(repeated.reused, true);
  await apply(otherVacancy);
  await assert.rejects(
    db.query("SELECT * FROM public.application_email_notifications"),
    /permission denied/,
  );
  await assert.rejects(rpc("claim_application_emails"), /permission denied/);
  await assert.rejects(
    rpc("finish_application_email", [id(1), id(2), "fake"]),
    /permission denied/,
  );
  await db.exec("RESET ROLE;");
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM public.application_email_notifications"))
      .rows[0].n,
    2,
  );
  await db.query("UPDATE public.applications SET status='entrevista' WHERE id=$1", [
    first.application_id,
  ]);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM public.application_email_notifications"))
      .rows[0].n,
    2,
  );
  await db.exec(migrate); // Safe rerun preserves pending notices and doesn't backfill old applications.
  await db.exec("SET ROLE service_role;");
  const claimed = await rpc("claim_application_emails");
  assert.equal(claimed.length, 2);
  const notice = claimed.find((item) => item.vacancy_id === vacancy);
  assert.equal(notice.recruiter_email, "recruiter@example.test");
  assert.equal(
    claimed.find((item) => item.vacancy_id === otherVacancy).recruiter_email,
    "other@example.test",
  );
  assert.equal(notice.candidate_phone, "5551234567");
  assert.equal(notice.candidate_email, "candidate@example.test");
  assert.equal((await rpc("claim_application_emails")).length, 0); // No overlapping sends.
  assert.equal(
    (await rpc("finish_application_email", [notice.notification_id, id(999), "bad"]))[0]
      .finish_application_email,
    false,
  );
  assert.equal(
    (
      await rpc("retry_application_email", [
        notice.notification_id,
        notice.lease_token,
        "brevo_http_503",
        60,
        false,
      ])
    )[0].retry_application_email,
    true,
  );
  assert.equal((await rpc("claim_application_emails")).length, 0); // Backoff respected.
  await db.exec("RESET ROLE;");
  await db.query(
    "UPDATE public.application_email_notifications SET next_attempt_at=now() WHERE id=$1",
    [notice.notification_id],
  );
  await db.exec("SET ROLE service_role;");
  const retried = (await rpc("claim_application_emails"))[0];
  assert.equal(retried.attempts, 2);
  assert.notEqual(retried.lease_token, notice.lease_token);
  assert.equal(
    (
      await rpc("finish_application_email", [
        retried.notification_id,
        retried.lease_token,
        "provider-message",
      ])
    )[0].finish_application_email,
    true,
  );
  await db.exec("RESET ROLE;");
  await db.exec(
    "UPDATE public.application_email_notifications SET locked_until=now()-interval '1 minute' WHERE status='processing';",
  );
  await db.exec("SET ROLE service_role;");
  assert.equal((await rpc("claim_application_emails")).length, 0);
  await db.exec("RESET ROLE;");
  assert.equal(
    (
      await db.query(
        "SELECT status FROM public.application_email_notifications WHERE application_id <> $1",
        [first.application_id],
      )
    ).rows[0].status,
    "needs_review",
  );
  // A vacancy without a responsible recruiter never sends data to another company.
  const legacyVacancy = (
    await db.query("SELECT id FROM public.vacancies WHERE created_by IS NULL LIMIT 1")
  ).rows[0].id;
  await apply(legacyVacancy);
  await db.exec("SET ROLE service_role;");
  assert.equal((await rpc("claim_application_emails")).length, 0);
  await db.exec("RESET ROLE;");
  assert.ok(
    (
      await db.query(
        "SELECT last_error FROM public.application_email_notifications WHERE status='needs_review'",
      )
    ).rows.some((row) => row.last_error === "recruiter_unavailable"),
  );
  for (let n = 320; n < 324; n++) {
    await db.query(
      "INSERT INTO public.vacancies(id,title,slug,is_active,created_by) VALUES($1,'Vacante',$2,true,$3)",
      [id(n), `quota-${n}`, owner],
    );
    await apply(id(n));
  }
  await db.exec("UPDATE public.application_email_daily_usage SET attempts=98;");
  await db.exec("SET ROLE service_role;");
  assert.equal((await rpc("claim_application_emails")).length, 2);
  assert.equal((await rpc("claim_application_emails")).length, 0);
  await db.exec("RESET ROLE;");
  assert.equal(
    (await db.query("SELECT attempts FROM public.application_email_daily_usage")).rows[0].attempts,
    100,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM public.application_email_notifications WHERE status='pending'",
      )
    ).rows[0].n,
    2,
  );
  console.log(
    "Email queue: new applications, deduplication, correct recruiter, private permissions, leases, retry backoff, unknown delivery and hard daily cap verified.",
  );

  const env = {
    APPLICATION_EMAILS_ENABLED: "true",
    SUPABASE_URL: "https://project.supabase.co/rest/v1",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fixture",
    BREVO_API_KEY: "mail-fixture",
    APPLICATION_EMAIL_FROM: "sender@example.test",
    APP_PUBLIC_URL: "https://talent.insurtalentmx.workers.dev/",
  };
  for (const scenario of ["success", "quota", "invalid", "timeout", "confirmation-failure"]) {
    const calls = [];
    const request = async (input, options) => {
      const url = new URL(input),
        body = JSON.parse(options.body);
      calls.push({ url, body, headers: new Headers(options.headers) });
      const json = (value, status = 200) =>
        new Response(JSON.stringify(value), {
          status,
          headers: { "content-type": "application/json" },
        });
      if (url.pathname.endsWith("/claim_application_emails")) return json([notice]);
      if (url.hostname === "api.brevo.com") {
        if (scenario === "timeout") throw new Error("Connection lost");
        if (scenario === "quota") return json({}, 429);
        if (scenario === "invalid") return json({}, 400);
        return json({ messageId: "accepted" }, 201);
      }
      if (url.pathname.endsWith("/finish_application_email"))
        return json(scenario !== "confirmation-failure");
      if (url.pathname.endsWith("/retry_application_email")) return json(true);
      throw new Error("Unexpected request");
    };
    const result = await processApplicationEmails(env, request);
    const mail = calls.find((call) => call.url.hostname === "api.brevo.com");
    assert.equal(mail.body.to[0].email, "recruiter@example.test");
    assert.equal(mail.body.replyTo.email, "candidate@example.test");
    assert.ok(mail.body.textContent.includes("Nuevo talento postulado 🎯"));
    assert.ok(mail.body.textContent.includes("5551234567 | candidate@example.test"));
    assert.ok(mail.body.htmlContent.includes("&lt;script&gt;"));
    assert.ok(!mail.body.htmlContent.includes("<script>"));
    assert.ok(!/cédula|evaluaci[oó]n|private\/cv\.pdf/i.test(JSON.stringify(mail.body)));
    assert.ok(mail.body.textContent.includes(`application=${first.application_id}`));
    assert.equal(mail.body.headers.idempotencyKey, notice.notification_id);
    assert.equal(calls[0].headers.get("authorization"), null); // Opaque service keys are not JWTs.
    assert.equal(calls[0].headers.get("apikey"), "sb_secret_fixture");
    if (scenario === "success") {
      assert.equal(result.sent, 1);
      assert.equal(result.deferred, 0);
    } else {
      assert.equal(result.sent, 0);
      assert.equal(result.deferred, 1);
      const retry = calls.find((call) => call.url.pathname.endsWith("/retry_application_email"));
      assert.equal(retry.body._needs_review, scenario !== "quota");
      if (scenario === "quota") assert.equal(retry.body._retry_seconds, 86400);
    }
  }
  for (const broken of [
    {},
    { ...env, APPLICATION_EMAILS_ENABLED: "false" },
    { ...env, APPLICATION_EMAIL_FROM: "invalid" },
    { ...env, APP_PUBLIC_URL: "http://insecure.test" },
  ]) {
    assert.equal(
      (
        await processApplicationEmails(broken, async () => {
          throw new Error("Should not send");
        })
      ).enabled,
      false,
    );
  }
  console.log(
    "Mail delivery: template, escaped HTML, panel link, reply-to, provider errors, quota, ambiguous outcomes and disabled configuration verified with simulated services. No real email sent.",
  );
} finally {
  await db.close();
}

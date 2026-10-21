import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { PGlite } from "@electric-sql/pglite";

async function moduleFrom(path) {
  const output = await build({
    entryPoints: [new URL(path, import.meta.url).pathname],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`
  );
}
const { summarizeRecruitment, filterApplications, buildRecruitmentPivot, csvContent } =
  await moduleFrom("../src/lib/recruitment-metrics.ts");
const { calculateTurnover } = await moduleFrom("../src/lib/workforce-metrics.ts");
process.env.TZ = "UTC";
const apps = [
  {
    id: "1",
    vacancy_id: "a",
    candidate_id: "c1",
    user_id: "u1",
    status: "nuevo",
    created_at: "2026-08-01T12:00:00Z",
  },
  {
    id: "2",
    vacancy_id: "a",
    candidate_id: "c2",
    user_id: "u2",
    status: "entrevista",
    created_at: "2026-08-15T12:00:00Z",
  },
  {
    id: "3",
    vacancy_id: "b",
    candidate_id: "c1",
    user_id: "u1",
    status: "contratado",
    created_at: "2026-08-31T23:00:00Z",
  },
  {
    id: "4",
    vacancy_id: "b",
    candidate_id: "c3",
    user_id: "u3",
    status: "rechazado",
    created_at: "2026-09-01T00:00:00Z",
  },
];
const summary = summarizeRecruitment(apps);
assert.equal(summary.total, 4);
assert.equal(summary.people, 3);
assert.equal(summary.inProgress, 2);
assert.equal(summary.hiringRate, 25);
assert.equal(summary.rejectionRate, 25);
const cohort = filterApplications(apps, { from: "2026-08-01", to: "2026-08-31", vacancy: "" });
assert.equal(cohort.length, 3);
assert.ok(Math.abs(summarizeRecruitment(cohort).hiringRate - 100 / 3) < 1e-10);
assert.equal(filterApplications(apps, { from: "", to: "", vacancy: "a" }).length, 2);
assert.equal(
  summarizeRecruitment([
    ...apps,
    { ...apps[0], candidate_id: null },
    { ...apps[0], candidate_id: null, user_id: null },
  ]).people,
  3,
);
assert.equal(
  summarizeRecruitment([...apps, { ...apps[0], candidate_id: null, user_id: null }]).unidentified,
  1,
);
const pivot = buildRecruitmentPivot(
  apps,
  [
    { id: "a", title: "Vacante A" },
    { id: "b", title: "Vacante B" },
  ],
  "vacancy",
);
assert.equal(pivot.find((row) => row.key === "b").hiringRate, 50);
assert.equal(
  pivot.reduce((sum, row) => sum + row.total, 0),
  4,
);
assert.equal(
  buildRecruitmentPivot(apps, [], "month").find((row) => row.key === "2026-08").total,
  3,
);
assert.equal(
  buildRecruitmentPivot(apps, [], "stage").find((row) => row.key === "entrevista").total,
  1,
);
process.env.TZ = "America/Mexico_City";
assert.equal(
  filterApplications([{ ...apps[0], created_at: "2026-09-01T02:00:00Z" }], {
    from: "2026-08-31",
    to: "2026-08-31",
    vacancy: "",
  }).length,
  1,
);
assert.equal(
  filterApplications([{ ...apps[0], created_at: "2026-09-01T06:00:00Z" }], {
    from: "2026-08-31",
    to: "2026-08-31",
    vacancy: "",
  }).length,
  0,
);
const csv = csvContent([
  ['=HYPERLINK("evil")', "+SUM(1)", "@SUM(1)", "-SUM(1)", 'Ana "Pérez"', "Dos\nlíneas"],
]);
assert.ok(csv.startsWith("\uFEFF\"'=HYPERLINK"));
assert.ok(csv.includes('"\'+SUM(1)"'));
assert.ok(csv.includes('"\'@SUM(1)"'));
assert.ok(csv.includes('"\'-SUM(1)"'));
assert.ok(csv.includes('Ana ""Pérez""'));
assert.deepEqual(calculateTurnover(100, 10, 10), { end: 100, average: 100, rate: 10 });
assert.equal(calculateTurnover(100, 5, 10).end, 95);
assert.ok(Math.abs(calculateTurnover(100, 5, 10).rate - (10 / 97.5) * 100) < 1e-10);
assert.equal(calculateTurnover(0, 0, 0).rate, null);
assert.equal(calculateTurnover(0, 1, 1).rate, null);
assert.equal(calculateTurnover(1, 10, 10).rate, 1000);
for (const values of [
  [1, 0, 2],
  [-1, 0, 0],
  [1.5, 0, 0],
  [NaN, 0, 0],
  [Infinity, 0, 0],
  [1, 0, -1],
])
  assert.equal(calculateTurnover(...values), null);
console.log(
  "Recruitment/turnover calculations: cohorts, local date boundaries, duplicate people, current stages, pivots, CSV safety, zero denominator and rates above 100% verified.",
);

const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
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
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20261021000000_recruiter_workforce_metrics.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(migration);
  for (const [uid, role] of [
    [id(1), "company"],
    [id(2), "company"],
    [id(3), "candidate"],
    [id(4), "candidate"],
  ])
    await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)", [
      uid,
      `${uid}@example.test`,
      JSON.stringify({ role }),
    ]);
  await db.query("INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')", [id(4)]);
  async function as(uid, role = "authenticated") {
    await db.exec("RESET ROLE;");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid]);
    await db.exec(`SET ROLE ${role};`);
  }
  const insert = (owner, month = "2026-08-01") =>
    db.query(
      "INSERT INTO public.recruiter_workforce_periods(owner_id,month,headcount_start,hires,departures,target_percent,notes) VALUES($1,$2,100,5,10,8,'Privado') RETURNING *",
      [owner, month],
    );
  await as(id(1));
  const first = (await insert(id(1))).rows[0];
  assert.equal(first.headcount_end, 95);
  await db.query(
    "INSERT INTO public.recruiter_workforce_periods(owner_id,month,headcount_start,hires,departures) VALUES($1,'2026-08-01',100,10,10) ON CONFLICT(owner_id,month) DO UPDATE SET hires=excluded.hires RETURNING *",
    [id(1)],
  );
  assert.equal((await db.query("SELECT * FROM public.recruiter_workforce_periods")).rows.length, 1);
  assert.equal(
    (await db.query("SELECT id FROM public.recruiter_workforce_periods")).rows[0].id,
    first.id,
  );
  await assert.rejects(
    db.query("UPDATE public.recruiter_workforce_periods SET owner_id=$1", [id(2)]),
    /row-level security/,
  );
  await assert.rejects(
    db.query("UPDATE public.recruiter_workforce_periods SET headcount_end=200"),
    /generated|DEFAULT/,
  );
  for (const bad of [
    "departures=1000",
    "headcount_start=-1",
    "hires=-2",
    "target_percent=-1",
    "target_percent='NaN'",
    "month='2026-08-02'",
  ])
    await assert.rejects(
      db.exec(`UPDATE public.recruiter_workforce_periods SET ${bad}`),
      /constraint/,
    );
  await assert.rejects(
    db.exec("DELETE FROM public.recruiter_workforce_periods"),
    /permission denied/,
  );
  await as(id(2));
  assert.equal((await db.query("SELECT * FROM public.recruiter_workforce_periods")).rows.length, 0);
  assert.equal(
    (await db.query("UPDATE public.recruiter_workforce_periods SET notes='forbidden' RETURNING *"))
      .rows.length,
    0,
  );
  await assert.rejects(insert(id(1)), /row-level security/);
  await insert(id(2));
  await as(id(3));
  await assert.rejects(insert(id(3)), /row-level security/);
  assert.equal((await db.query("SELECT * FROM public.recruiter_workforce_periods")).rows.length, 0);
  await as(id(4));
  assert.equal((await db.query("SELECT * FROM public.recruiter_workforce_periods")).rows.length, 0);
  await insert(id(4));
  await as("", "anon");
  await assert.rejects(
    db.query("SELECT * FROM public.recruiter_workforce_periods"),
    /permission denied/,
  );
  await db.exec("RESET ROLE;");
  await db.exec(migration);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM public.recruiter_workforce_periods")).rows[0].n,
    3,
  );
  console.log(
    "Workforce PostgreSQL: per-company RLS, candidate/anonymous denial, admin isolation, monthly upsert, generated closing balance, input checks and repeatable migration verified.",
  );
} finally {
  await db.close();
}

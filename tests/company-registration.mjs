import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = id(1),
  B = id(2),
  C = id(3),
  ADMIN = id(4),
  D = id(5);
await db.exec(`
CREATE ROLE authenticated; CREATE ROLE anon;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon;
CREATE TYPE public.app_role AS ENUM ('admin','recruiter');
CREATE TABLE public.user_roles(id uuid DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),role public.app_role,UNIQUE(user_id,role));
CREATE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)$$;
CREATE TABLE public.vacancies(id uuid PRIMARY KEY,created_by uuid REFERENCES auth.users(id),is_active boolean DEFAULT true,title text);
CREATE TABLE public.candidates(id uuid PRIMARY KEY);
CREATE TABLE public.applications(id uuid PRIMARY KEY,user_id uuid,candidate_id uuid,vacancy_id uuid,evaluation_id uuid,respuestas jsonb DEFAULT '{}',status text DEFAULT 'nuevo');
CREATE TABLE public.evaluations(id uuid PRIMARY KEY,user_id uuid,vacancy_id uuid);
CREATE TABLE public.evaluation_results(id uuid PRIMARY KEY,evaluation_id uuid);
CREATE TABLE public.evaluation_answers(id uuid PRIMARY KEY,evaluation_id uuid);
CREATE TABLE public.questions(id uuid PRIMARY KEY,vacancy_id uuid);
CREATE TABLE public.profiles(user_id uuid PRIMARY KEY,candidate_id uuid,cv_url text,video_url text);
CREATE TABLE public.uploads(id uuid PRIMARY KEY,candidate_id uuid,cv_url text,video_url text);
CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.vacancies TO anon,authenticated;
ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads active vacancies" ON public.vacancies FOR SELECT TO anon,authenticated USING(is_active OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'));
CREATE POLICY "admin manages vacancies" ON public.vacancies FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
`);
for (const table of [
  "candidates",
  "applications",
  "evaluations",
  "evaluation_results",
  "evaluation_answers",
  "questions",
  "profiles",
  "uploads",
]) {
  await db.exec(
    `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY; GRANT ALL ON public.${table} TO authenticated; CREATE POLICY old_read ON public.${table} FOR SELECT TO authenticated USING(true);`,
  );
}
await db.exec(`CREATE POLICY old_update ON public.applications FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'recruiter') OR public.has_role(auth.uid(),'admin'));
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT SELECT ON storage.objects TO authenticated; CREATE POLICY old_read ON storage.objects FOR SELECT TO authenticated USING(true);
INSERT INTO auth.users VALUES('${A}','{"role":"company"}'),('${ADMIN}','{}');
INSERT INTO public.user_roles(user_id,role) VALUES('${ADMIN}','admin');`);
const migration = await readFile(
  new URL("../supabase/migrations/20261009000000_open_company_registration.sql", import.meta.url),
  "utf8",
);
await db.exec(migration);
await db.exec(migration); // Repeatable for manual SQL Editor use.
await db.exec(
  `INSERT INTO auth.users VALUES('${B}','{"role":"company"}'),('${C}','{"role":"candidate"}'),('${D}','{}');`,
);
assert.equal(
  (await db.query("SELECT count(*)::int AS n FROM public.user_roles WHERE role='recruiter'"))
    .rows[0].n,
  2,
);
assert.equal(
  (await db.query(`SELECT count(*)::int AS n FROM public.user_roles WHERE user_id='${C}'`)).rows[0]
    .n,
  0,
);
await db.exec(`UPDATE auth.users SET raw_user_meta_data='{"role":"company"}' WHERE id='${C}';`);
assert.equal(
  (await db.query(`SELECT count(*)::int AS n FROM public.user_roles WHERE user_id='${C}'`)).rows[0]
    .n,
  0,
);
await db.exec(`
INSERT INTO public.vacancies VALUES('${id(10)}','${A}',true,'A'),('${id(11)}','${B}',false,'B'),('${id(12)}',NULL,true,'Legacy');
INSERT INTO public.candidates VALUES('${id(20)}'),('${id(21)}');
INSERT INTO public.evaluations VALUES('${id(30)}','${C}','${id(10)}'),('${id(31)}','${D}','${id(11)}');
INSERT INTO public.applications(id,user_id,candidate_id,vacancy_id,evaluation_id) VALUES('${id(40)}','${C}','${id(20)}','${id(10)}','${id(30)}'),('${id(41)}','${D}','${id(21)}','${id(11)}','${id(31)}');
INSERT INTO public.profiles VALUES('${C}','${id(20)}','${C}/cv.pdf',NULL),('${D}','${id(21)}','${D}/cv.pdf',NULL);
INSERT INTO public.uploads VALUES('${id(50)}','${id(20)}','legacy-a/cv.pdf',NULL),('${id(51)}','${id(21)}','legacy-b/cv.pdf',NULL);
INSERT INTO public.evaluation_results VALUES('${id(60)}','${id(30)}'),('${id(61)}','${id(31)}');
INSERT INTO public.evaluation_answers VALUES('${id(70)}','${id(30)}'),('${id(71)}','${id(31)}');
INSERT INTO public.questions VALUES('${id(80)}','${id(10)}'),('${id(81)}','${id(11)}');
INSERT INTO storage.objects VALUES('${id(90)}','applications','${C}/cv.pdf'),('${id(91)}','applications','${D}/cv.pdf'),('${id(92)}','applications','legacy-a/cv.pdf'),('${id(93)}','applications','legacy-b/cv.pdf');
`);
async function asUser(user, role = "authenticated") {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${user ?? ""}',false); SET ROLE ${role};`,
  );
}
async function ids(table, column = "id") {
  return (await db.query(`SELECT ${column}::text AS id FROM ${table} ORDER BY ${column}`)).rows.map(
    (r) => r.id,
  );
}
let checks = 4;
for (const [user, offset] of [
  [A, 0],
  [B, 1],
]) {
  await asUser(user);
  for (const [table, first] of [
    ["applications", 40],
    ["candidates", 20],
    ["evaluations", 30],
    ["evaluation_results", 60],
    ["evaluation_answers", 70],
    ["questions", 80],
    ["uploads", 50],
  ]) {
    assert.deepEqual(await ids("public." + table), [id(first + offset)]);
    checks++;
  }
  assert.deepEqual(await ids("public.profiles", "user_id"), [offset === 0 ? C : D]);
  checks++;
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM storage.objects`)).rows[0].n, 2);
  checks++;
}
await asUser(A);
assert.equal(
  (await db.query(`UPDATE public.vacancies SET title='stolen' WHERE id='${id(11)}' RETURNING id`))
    .rows.length,
  0,
);
checks++;
assert.equal(
  (await db.query(`DELETE FROM public.vacancies WHERE id='${id(11)}' RETURNING id`)).rows.length,
  0,
);
checks++;
await assert.rejects(
  db.query(`INSERT INTO public.vacancies(id,created_by) VALUES('${id(99)}','${B}')`),
);
checks++;
await assert.rejects(
  db.query(`UPDATE public.vacancies SET created_by='${B}' WHERE id='${id(10)}'`),
);
checks++;
assert.equal(
  (
    await db.query(
      `INSERT INTO public.vacancies(id,title) VALUES('${id(98)}','New company job') RETURNING created_by`,
    )
  ).rows[0].created_by,
  A,
);
checks++;
assert.equal(
  (
    await db.query(
      `UPDATE public.applications SET status='entrevista' WHERE id='${id(40)}' RETURNING status`,
    )
  ).rows[0].status,
  "entrevista",
);
checks++;
assert.equal(
  (
    await db.query(
      `UPDATE public.applications SET status='entrevista' WHERE id='${id(41)}' RETURNING id`,
    )
  ).rows.length,
  0,
);
checks++;
await assert.rejects(
  db.query(`UPDATE public.applications SET user_id='${D}' WHERE id='${id(40)}'`),
);
checks++;
await asUser(C);
assert.deepEqual(await ids("public.applications"), [id(40)]);
checks++;
assert.deepEqual(await ids("public.profiles", "user_id"), [C]);
checks++;
await assert.rejects(
  db.query(`INSERT INTO public.vacancies(id,title) VALUES('${id(97)}','Candidate job')`),
);
checks++;
await assert.rejects(
  db.query(`INSERT INTO public.user_roles(user_id,role) VALUES('${C}','admin')`),
);
checks++;
await asUser(ADMIN);
assert.equal((await ids("public.applications")).length, 2);
checks++;
assert.equal((await ids("public.profiles", "user_id")).length, 2);
checks++;
assert.equal((await ids("storage.objects")).length, 4);
checks++;
await asUser(null, "anon");
assert.equal((await ids("public.vacancies")).length, 3);
checks++;
await db.exec(
  `RESET ROLE; INSERT INTO public.applications(id,user_id,candidate_id,vacancy_id,evaluation_id) VALUES('${id(42)}','${C}','${id(20)}','${id(11)}','${id(30)}');`,
);
await asUser(B);
assert.deepEqual(await ids("public.evaluations"), [id(30), id(31)]);
checks++;
await db.exec(`RESET ROLE;
  UPDATE public.applications SET candidate_id = NULL WHERE id = '${id(40)}';
  CREATE FUNCTION public.test_apply_repair() RETURNS void LANGUAGE sql SECURITY DEFINER
    SET search_path = public AS $$
      UPDATE public.applications SET candidate_id = '${id(20)}'
      WHERE id = '${id(40)}' AND user_id = auth.uid();
    $$;
  GRANT EXECUTE ON FUNCTION public.test_apply_repair() TO authenticated;`);
await asUser(C);
await db.query("SELECT public.test_apply_repair()");
await db.exec("RESET ROLE");
assert.equal(
  (await db.query(`SELECT candidate_id FROM public.applications WHERE id = '${id(40)}'`)).rows[0]
    .candidate_id,
  id(20),
);
checks++;
await db.close();
console.log(
  `${checks} PostgreSQL checks passed: signup/backfill, repeatability, company isolation, CVs, status updates, public jobs, candidate and admin access.`,
);

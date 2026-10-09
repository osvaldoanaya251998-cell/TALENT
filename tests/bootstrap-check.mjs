import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const db=new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}',email_confirmed_at timestamptz);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$SELECT string_to_array($1,'/')$$;`);
try{await db.exec(await readFile(new URL('../supabase/setup/nuevo-proyecto.sql',import.meta.url),'utf8')); await db.exec(`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000001','company@example.test','{"role":"company","full_name":"Empresa"}');`); const result=await db.query("SELECT role FROM public.user_roles"); if(result.rows.length!==1 || result.rows[0].role!=='recruiter') throw new Error('Company role missing or unexpected'); console.log('Bootstrap completed; company signup grants recruiter');}catch(e){console.error(e.message);process.exitCode=1;}
await db.close();

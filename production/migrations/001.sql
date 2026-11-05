-- Application records retain flexible workflow data in JSONB. Relational keys enforce core integrity.
CREATE TABLE IF NOT EXISTS ipm_meta (id boolean PRIMARY KEY DEFAULT true CHECK(id), data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS ipm_profiles (id text PRIMARY KEY, position integer NOT NULL, data jsonb NOT NULL CHECK(data->>'id'=id));
CREATE TABLE IF NOT EXISTS ipm_users (
 id text PRIMARY KEY, position integer NOT NULL, data jsonb NOT NULL CHECK(data->>'id'=id),
 profile_id text GENERATED ALWAYS AS (data->>'profileId') STORED REFERENCES ipm_profiles(id) DEFERRABLE INITIALLY DEFERRED,
 username text GENERATED ALWAYS AS (lower(btrim(data->>'username'))) STORED UNIQUE,
 user_code text GENERATED ALWAYS AS (data->>'userId') STORED UNIQUE
);
CREATE UNIQUE INDEX IF NOT EXISTS ipm_active_email ON ipm_users(lower(btrim(data->>'email'))) WHERE COALESCE((data->>'active')::boolean,true) AND COALESCE(data->>'email','')<>'';
CREATE TABLE IF NOT EXISTS ipm_projects (
 id text PRIMARY KEY, position integer NOT NULL, data jsonb NOT NULL CHECK(data->>'id'=id),
 wbs text GENERATED ALWAYS AS (data->>'wbs') STORED NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS ipm_tasks (
 id text PRIMARY KEY, position integer NOT NULL, data jsonb NOT NULL CHECK(data->>'id'=id),
 project_id text GENERATED ALWAYS AS (data->>'projectId') STORED NOT NULL REFERENCES ipm_projects(id) DEFERRABLE INITIALLY DEFERRED,
 wbs text GENERATED ALWAYS AS (data->>'wbs') STORED NOT NULL,
 UNIQUE(project_id,wbs),
 CHECK(COALESCE((data->>'mhEstimate')::numeric,0)>=0),
 CHECK(COALESCE((data->>'mhActual')::numeric,0)>=0)
);
CREATE TABLE IF NOT EXISTS ipm_workflows (project_id text PRIMARY KEY REFERENCES ipm_projects(id) DEFERRABLE INITIALLY DEFERRED, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS ipm_collections (kind text NOT NULL, id text NOT NULL, position integer NOT NULL, data jsonb NOT NULL, PRIMARY KEY(kind,id));
-- Not included in user exports or JSON migration. Session keys are SHA-256 hashes of cookie tokens.
CREATE TABLE IF NOT EXISTS ipm_security (id boolean PRIMARY KEY DEFAULT true CHECK(id), data jsonb NOT NULL);
INSERT INTO ipm_security(id,data) VALUES(true,'{"sessions":{},"failures":{}}') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS ipm_schema (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
INSERT INTO ipm_schema(version) VALUES(1) ON CONFLICT DO NOTHING;

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE engineers(id text PRIMARY KEY, name text NOT NULL, pin_hash text NOT NULL UNIQUE, active integer NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
CREATE TABLE devices(fingerprint text PRIMARY KEY, name text NOT NULL, active integer NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
CREATE TABLE sessions(token_hash text PRIMARY KEY, engineer_id text NOT NULL REFERENCES engineers(id), device text NOT NULL, expires bigint NOT NULL);
CREATE TABLE admin_sessions(token_hash text PRIMARY KEY, credential_version text NOT NULL, expires bigint NOT NULL);
CREATE TABLE attempts(key text PRIMARY KEY, count integer NOT NULL, until bigint NOT NULL);
CREATE TABLE nonces(nonce text PRIMARY KEY, expires bigint NOT NULL);
CREATE TABLE shifts(id text PRIMARY KEY, engineer_id text NOT NULL REFERENCES engineers(id), started_at bigint NOT NULL, ended_at bigint, device text NOT NULL, version integer NOT NULL DEFAULT 1,
 CONSTRAINT positive_shift CHECK(ended_at IS NULL OR ended_at>started_at),
 CONSTRAINT no_overlapping_shifts EXCLUDE USING gist(engineer_id WITH =, int8range(started_at,ended_at,'[)') WITH &&));
CREATE UNIQUE INDEX one_open_shift ON shifts(engineer_id) WHERE ended_at IS NULL;
CREATE INDEX shifts_engineer_start ON shifts(engineer_id,started_at);
CREATE TABLE audit(id serial PRIMARY KEY,entity text NOT NULL,entity_id text NOT NULL,actor text NOT NULL,at bigint NOT NULL,reason text NOT NULL,before text,after text);
CREATE INDEX audit_entity ON audit(entity_id,id);
CREATE FUNCTION record_original_shift() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO audit(entity,entity_id,actor,at,reason,before,after) VALUES('shift',NEW.id,'engineer:'||NEW.engineer_id,NEW.started_at,'Clock in',NULL,row_to_json(NEW)::text);
 RETURN NEW;
END; $$;
CREATE TRIGGER shifts_original AFTER INSERT ON shifts FOR EACH ROW EXECUTE FUNCTION record_original_shift();
CREATE FUNCTION reject_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit is immutable'; END; $$;
CREATE TRIGGER audit_no_change BEFORE UPDATE OR DELETE ON audit FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON audit FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_change();

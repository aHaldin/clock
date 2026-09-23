CREATE TABLE clock_locations (
 id text PRIMARY KEY,
 shift_id text NOT NULL REFERENCES shifts(id),
 action text NOT NULL CHECK(action IN ('in','out')),
 shift_version integer NOT NULL,
 recorded_at bigint NOT NULL,
 captured_at bigint NOT NULL,
 latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 accuracy double precision NOT NULL CHECK(accuracy>=0),
 UNIQUE(shift_id,action,shift_version)
);
CREATE INDEX clock_locations_shift ON clock_locations(shift_id,recorded_at);
CREATE TRIGGER locations_no_update BEFORE UPDATE ON clock_locations BEGIN SELECT RAISE(ABORT,'location is immutable'); END;
CREATE TRIGGER locations_no_delete BEFORE DELETE ON clock_locations BEGIN SELECT RAISE(ABORT,'location is immutable'); END;

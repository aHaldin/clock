CREATE TABLE `attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`until` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`actor` text NOT NULL,
	`at` integer NOT NULL,
	`reason` text NOT NULL,
	`before` text,
	`after` text
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`fingerprint` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `engineers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`pin_hash` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `engineers_pin_hash_unique` ON `engineers` (`pin_hash`);--> statement-breakpoint
CREATE TABLE `nonces` (
	`nonce` text PRIMARY KEY NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`engineer_id` text NOT NULL,
	`device` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`engineer_id`) REFERENCES `engineers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`engineer_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`device` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`engineer_id`) REFERENCES `engineers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "positive_shift" CHECK("shifts"."ended_at" IS NULL OR "shifts"."ended_at" > "shifts"."started_at")
);
--> statement-breakpoint
CREATE INDEX `idx_shifts_engineer_start` ON `shifts` (`engineer_id`,`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_open_shift` ON `shifts` (`engineer_id`) WHERE "shifts"."ended_at" IS NULL;--> statement-breakpoint
CREATE TRIGGER shifts_no_overlap_insert BEFORE INSERT ON shifts
WHEN EXISTS(SELECT 1 FROM shifts s WHERE s.engineer_id=NEW.engineer_id AND s.started_at<COALESCE(NEW.ended_at,9223372036854775807) AND COALESCE(s.ended_at,9223372036854775807)>NEW.started_at)
BEGIN SELECT RAISE(ABORT,'overlapping shift'); END;
--> statement-breakpoint
CREATE TRIGGER shifts_no_overlap_update BEFORE UPDATE ON shifts
WHEN EXISTS(SELECT 1 FROM shifts s WHERE s.id<>NEW.id AND s.engineer_id=NEW.engineer_id AND s.started_at<COALESCE(NEW.ended_at,9223372036854775807) AND COALESCE(s.ended_at,9223372036854775807)>NEW.started_at)
BEGIN SELECT RAISE(ABORT,'overlapping shift'); END;
--> statement-breakpoint
CREATE TRIGGER shifts_original AFTER INSERT ON shifts
BEGIN INSERT INTO audit(entity,entity_id,actor,at,reason,before,after) VALUES ('shift',NEW.id,'engineer:'||NEW.engineer_id,NEW.started_at,'Clock in',NULL,json_object('id',NEW.id,'engineer_id',NEW.engineer_id,'started_at',NEW.started_at,'ended_at',NEW.ended_at,'device',NEW.device,'version',NEW.version)); END;
--> statement-breakpoint
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'audit is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'audit is immutable'); END;

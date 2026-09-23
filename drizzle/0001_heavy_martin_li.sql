CREATE TABLE `admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`credential_version` text NOT NULL,
	`expires` integer NOT NULL
);

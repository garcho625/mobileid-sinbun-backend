CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`credential` text NOT NULL,
	`result` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);

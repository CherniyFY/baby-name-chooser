CREATE TABLE `leagues` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`name_ids` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`name_id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ratings` (
	`name_id` text NOT NULL,
	`person` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	PRIMARY KEY(`name_id`, `person`)
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`league_id` text NOT NULL,
	`person` text NOT NULL,
	`a` text NOT NULL,
	`b` text NOT NULL,
	`choice` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	PRIMARY KEY(`league_id`, `person`, `a`, `b`),
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE no action
);

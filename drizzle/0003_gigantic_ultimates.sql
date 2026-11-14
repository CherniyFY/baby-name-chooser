CREATE TABLE `filter_views` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`scope` text NOT NULL,
	`filters_json` text NOT NULL,
	`sort` text NOT NULL,
	`creation_json` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);

CREATE TABLE `attempt_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected_options` text NOT NULL,
	`is_correct` integer DEFAULT false NOT NULL,
	`points_awarded` real DEFAULT 0 NOT NULL,
	`answered_at` text NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `exam_attempts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exam_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`exam_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`submitted_at` text,
	`total_questions` integer NOT NULL,
	`correct_answers_count` integer DEFAULT 0 NOT NULL,
	`total_score` real DEFAULT 0 NOT NULL,
	`percentage_score` real DEFAULT 0 NOT NULL,
	`is_passed` integer DEFAULT false NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exams` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`total_questions` integer NOT NULL,
	`passing_score_percentage` real DEFAULT 70 NOT NULL,
	`is_published` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exams_code_unique` ON `exams` (`code`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`exam_id` text,
	`question_number` integer NOT NULL,
	`question_id_code` text NOT NULL,
	`question_text` text NOT NULL,
	`image_file` text,
	`question_type` text NOT NULL,
	`options` text NOT NULL,
	`correct_answer` text NOT NULL,
	`ai_explanation` text,
	`option_by_option_analysis` text,
	`community_stats` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`icon_url` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_code_unique` ON `subjects` (`code`);--> statement-breakpoint
CREATE TABLE `user_statistics` (
	`user_id` text PRIMARY KEY NOT NULL,
	`total_attempts_count` integer DEFAULT 0 NOT NULL,
	`total_exams_passed` integer DEFAULT 0 NOT NULL,
	`overall_pass_rate` real DEFAULT 0 NOT NULL,
	`overall_average_score` real DEFAULT 0 NOT NULL,
	`total_practice_seconds` integer DEFAULT 0 NOT NULL,
	`subject_breakdowns` text DEFAULT '{}' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`full_name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
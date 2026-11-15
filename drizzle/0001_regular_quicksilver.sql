CREATE TABLE `practice_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`is_unlimited` integer DEFAULT true NOT NULL,
	`duration_minutes` integer,
	`started_at` text NOT NULL,
	`completed_at` text,
	`total_cards` integer NOT NULL,
	`mastered_cards` integer DEFAULT 0 NOT NULL,
	`session_data` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_card_mastery` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`question_id` text NOT NULL,
	`cram_mastered` integer DEFAULT false NOT NULL,
	`learn_state` text DEFAULT 'not_yet_learned' NOT NULL,
	`consecutive_correct` integer DEFAULT 0 NOT NULL,
	`wrong_attempts` integer DEFAULT 0 NOT NULL,
	`total_attempts` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `exam_attempts` ADD COLUMN `is_unlimited` integer DEFAULT 0 NOT NULL;
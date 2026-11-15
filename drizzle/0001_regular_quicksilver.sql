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
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_exam_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`exam_id` text NOT NULL,
	`status` text NOT NULL,
	`is_unlimited` integer DEFAULT false NOT NULL,
	`started_at` text NOT NULL,
	`expires_at` text,
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
INSERT INTO `__new_exam_attempts`("id", "user_id", "exam_id", "status", "is_unlimited", "started_at", "expires_at", "submitted_at", "total_questions", "correct_answers_count", "total_score", "percentage_score", "is_passed", "duration_seconds") SELECT "id", "user_id", "exam_id", "status", 0, "started_at", "expires_at", "submitted_at", "total_questions", "correct_answers_count", "total_score", "percentage_score", "is_passed", "duration_seconds" FROM `exam_attempts`;--> statement-breakpoint
DROP TABLE `exam_attempts`;--> statement-breakpoint
ALTER TABLE `__new_exam_attempts` RENAME TO `exam_attempts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  full_name: text("full_name").notNull(),
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull()
});

export const subjects = sqliteTable("subjects", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  icon_url: text("icon_url"),
  created_at: text("created_at").notNull()
});

export const exams = sqliteTable("exams", {
  id: text("id").primaryKey(),
  subject_id: text("subject_id")
    .notNull()
    .references(() => subjects.id),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  duration_minutes: integer("duration_minutes").notNull().default(60),
  total_questions: integer("total_questions").notNull(),
  passing_score_percentage: real("passing_score_percentage").notNull().default(70.0),
  is_published: integer("is_published", { mode: "boolean" }).notNull().default(true),
  created_at: text("created_at").notNull()
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  subject_id: text("subject_id")
    .notNull()
    .references(() => subjects.id),
  exam_id: text("exam_id").references(() => exams.id),
  question_number: integer("question_number").notNull(),
  question_id_code: text("question_id_code").notNull(),
  question_text: text("question_text").notNull(),
  image_file: text("image_file"),
  question_type: text("question_type").notNull(),
  options: text("options", { mode: "json" }).notNull(),
  correct_answer: text("correct_answer").notNull(),
  ai_explanation: text("ai_explanation"),
  option_by_option_analysis: text("option_by_option_analysis", { mode: "json" }),
  community_stats: text("community_stats", { mode: "json" }),
  created_at: text("created_at").notNull()
});

export const exam_attempts = sqliteTable("exam_attempts", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id),
  exam_id: text("exam_id")
    .notNull()
    .references(() => exams.id),
  status: text("status").notNull(),
  started_at: text("started_at").notNull(),
  expires_at: text("expires_at").notNull(),
  submitted_at: text("submitted_at"),
  total_questions: integer("total_questions").notNull(),
  correct_answers_count: integer("correct_answers_count").notNull().default(0),
  total_score: real("total_score").notNull().default(0.0),
  percentage_score: real("percentage_score").notNull().default(0.0),
  is_passed: integer("is_passed", { mode: "boolean" }).notNull().default(false),
  duration_seconds: integer("duration_seconds").notNull().default(0)
});

export const attempt_answers = sqliteTable("attempt_answers", {
  id: text("id").primaryKey(),
  attempt_id: text("attempt_id")
    .notNull()
    .references(() => exam_attempts.id),
  question_id: text("question_id")
    .notNull()
    .references(() => questions.id),
  selected_options: text("selected_options").notNull(),
  is_correct: integer("is_correct", { mode: "boolean" }).notNull().default(false),
  points_awarded: real("points_awarded").notNull().default(0.0),
  answered_at: text("answered_at").notNull()
});

export const user_statistics = sqliteTable("user_statistics", {
  user_id: text("user_id")
    .primaryKey()
    .references(() => users.id),
  total_attempts_count: integer("total_attempts_count").notNull().default(0),
  total_exams_passed: integer("total_exams_passed").notNull().default(0),
  overall_pass_rate: real("overall_pass_rate").notNull().default(0.0),
  overall_average_score: real("overall_average_score").notNull().default(0.0),
  total_practice_seconds: integer("total_practice_seconds").notNull().default(0),
  subject_breakdowns: text("subject_breakdowns", { mode: "json" }).notNull().default("{}"),
  updated_at: text("updated_at").notNull()
});

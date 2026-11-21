-- Add secondary indexes for all hot foreign-key and filter lookups to prevent full table scans on D1
CREATE INDEX IF NOT EXISTS idx_exams_subject_id ON exams(subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_id ON exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_exam_status ON exam_attempts(user_id, exam_id, status);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt_id ON attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt_question ON attempt_answers(attempt_id, question_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_subject_mode_status ON practice_sessions(user_id, subject_id, mode, status);
CREATE INDEX IF NOT EXISTS idx_user_card_mastery_user_subject ON user_card_mastery(user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_user_card_mastery_user_question ON user_card_mastery(user_id, question_id);

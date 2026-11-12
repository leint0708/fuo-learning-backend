# Feature Specification: Exam Practice Backend API

**Feature Branch**: `001-exam-practice-api`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Build a backend for an exam practice app. This api should contain authentication, subjects, list of exams followed by a subject, questions bank, attempts, stats of user"

## Clarifications

### Session 2026-11-12

- Q: What question types and scoring rules should the backend exam evaluation engine support? → A: The backend supports both `single_choice` and `multiple_choice` questions adhering to the schema in the `exams/` dataset. Scoring is all-or-nothing (exact match of correct choices required for full points, zero points for incorrect or partial selections, no negative penalties).
- Q: How should the exam attempt timer and active session duration be enforced? → A: Continuous wall-clock countdown (non-pausable). The attempt expiration timestamp is fixed at start timestamp plus the exam's duration limit, ensuring tamper-proof time enforcement regardless of client disconnects or pauses.
- Q: How should the backend ingest and manage exam content from the exams/ directory? → A: Automated seeding from `exams/`. The backend ingests subjects, exams, questions, answer keys, explanations, and webp media assets directly from the repository's `exams/` directory into the database via an automated migration/seed process; client endpoints provide read-only access to this catalog.
- Q: How should repeat attempts (retakes) on the same exam be aggregated in the user statistics dashboard? → A: Best attempt model. The highest score achieved per exam determines exam pass status and subject proficiency score. Total attempts count, cumulative practice time, and attempt history reflect all sittings.
- Q: How should the backend persist and track answers submitted during topical question bank drills compared to formal exam attempts? → A: Ephemeral practice drills. Topical question bank drills return instant correctness and explanation feedback in the API response without persisting attempt records or altering formal exam pass/score statistics.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Authentication & Profile Access (Priority: P1)

As a student preparing for academic examinations, I want to register an account, securely sign in, and manage my user profile so that my exam practice history, ongoing attempts, and performance statistics are securely stored and tied to my personal account.

**Why this priority**: Authentication and account identity form the prerequisite foundation for recording personalized exam sessions, persisting answer states, and computing individual learner progress.

**Independent Test**: Can be fully tested by registering a new user account, authenticating with credentials, retrieving the authenticated user's profile details, and verifying that unauthenticated requests to protected endpoints are rejected.

**Acceptance Scenarios**:

1. **Given** a new user with a valid email address and password, **When** they submit a registration request, **Then** an account is created and an active authenticated session is established.
2. **Given** a registered user with valid credentials, **When** they sign in, **Then** the system authenticates the user and provides access to their protected resources.
3. **Given** an unauthenticated visitor, **When** they attempt to access protected endpoints such as creating an exam attempt or retrieving personal statistics, **Then** the system denies access with an authentication challenge.
4. **Given** an authenticated user, **When** they view their profile, **Then** their account details (name, email, registration date) are displayed.

---

### User Story 2 - Subject & Exam Catalog Browsing (Priority: P1)

As a student, I want to browse available academic subjects and view the list of exams categorized under each subject so that I can find and select specific mock or practice exams to prepare for my courses.

**Why this priority**: Discovering subjects and their corresponding exams is the primary navigation loop enabling students to find relevant study material.

**Independent Test**: Can be fully tested by creating subjects with associated exams, requesting the subject list, selecting a specific subject, and verifying that only exams belonging to that subject are returned along with key metadata (title, question count, time limit).

**Acceptance Scenarios**:

1. **Given** published subjects exist in the catalog, **When** a user requests the subject list, **Then** all active subjects are returned with title, subject code, description, and available exam counts.
2. **Given** a valid subject with associated exams, **When** a user requests exams for that subject, **Then** a list of exams specific to that subject is returned, showing exam title, duration allowance, total question count, and passing threshold.
3. **Given** a subject with no published exams, **When** a user requests exams for that subject, **Then** an empty list is returned with a descriptive status indicating no exams are currently available.

---

### User Story 3 - Taking an Exam Attempt & Auto-Grading (Priority: P1)

As a student, I want to start an exam attempt, navigate and answer questions, save my progress incrementally, and submit my answers for automatic scoring so that I can evaluate my test readiness.

**Why this priority**: Conducting an exam session and receiving an automated score represents the core functional deliverable of the practice application.

**Independent Test**: Can be fully tested by starting an exam attempt, recording responses for multiple questions, submitting the attempt, and verifying that the system calculates the final score, correct/incorrect totals, and marks the attempt completed.

**Acceptance Scenarios**:

1. **Given** an authenticated student and an active exam, **When** the student initiates a new attempt, **Then** an attempt session is created, the timer is started, and the exam's questions and options are loaded without exposing answer keys.
2. **Given** an ongoing attempt, **When** the student selects or modifies an answer for a question, **Then** the answer selection is saved immediately to prevent progress loss.
3. **Given** an ongoing attempt with recorded answers, **When** the student submits the attempt, **Then** the session is marked completed, answers are evaluated against the answer key, and an overall score with pass/fail status is returned.
4. **Given** a timed exam attempt where the time limit is reached, **When** the time expires, **Then** the system automatically finalizes the attempt, records the final timestamp, and grades all recorded answers up to that moment.

---

### User Story 4 - Detailed Attempt Review & Question Explanations (Priority: P2)

As a student who has finished an exam, I want to review my completed attempt question-by-question, comparing my selected answers against the correct answers and reading explanatory notes and diagrams, so that I can learn from my mistakes and master the material.

**Why this priority**: Reviewing mistakes and studying explanations converts raw testing into meaningful learning and knowledge retention.

**Independent Test**: Can be fully tested by opening a completed exam attempt and verifying that every question presents the student's submission, the correct answer, the correctness indicator, and full explanation text with any referenced diagrams.

**Acceptance Scenarios**:

1. **Given** a completed exam attempt, **When** the student requests the attempt review, **Then** each question displays the student's selected answer, whether it was correct, the correct answer option, and detailed explanation text.
2. **Given** a question that contains an explanatory diagram or image, **When** the question is reviewed, **Then** the associated visual media reference is provided alongside the textual explanation.
3. **Given** an attempt that is still in progress, **When** a student requests an answer key or review, **Then** the system refuses access until the attempt is officially finalized.

---

### User Story 5 - User Performance Statistics & Progress Tracking (Priority: P2)

As a student, I want to view my cumulative performance statistics and subject-by-subject breakdowns so that I can track my overall study progress, identify weak areas, and monitor improvement over time.

**Why this priority**: Performance metrics motivate learners, summarize study accomplishments, and guide future preparation toward areas that need improvement.

**Independent Test**: Can be fully tested by completing multiple attempts across different subjects and verifying that the user statistics endpoint accurately aggregates total attempts, overall pass rate, average percentage score, total practice time, and per-subject proficiency metrics.

**Acceptance Scenarios**:

1. **Given** a user who has completed several exam attempts across multiple subjects, **When** they view their statistics summary, **Then** the system reports total attempts, overall pass rate, average score, and total time spent practicing.
2. **Given** a user with completed attempts, **When** they view per-subject performance, **Then** each subject lists the number of attempts completed, highest score achieved, and average score.
3. **Given** a newly registered user with zero attempts, **When** they view their statistics, **Then** the system displays a clear zero-state with informational guidance encouraging them to take their first exam.

---

### User Story 6 - Question Bank Topical Exploration (Priority: P3)

As a student, I want to browse and practice isolated questions from the question bank for a selected subject without taking a full mock exam, so that I can focus on targeted topical drills.

**Why this priority**: Provides flexible, low-stress study options for quick revision sessions when students do not have time for a full-length timed exam.

**Independent Test**: Can be fully tested by querying the question bank by subject, attempting an individual question, and receiving instant correctness verification with explanations.

**Acceptance Scenarios**:

1. **Given** a subject with questions in the question bank, **When** a student requests topical practice questions, **Then** a filtered set of questions is returned without initiating a formal exam attempt session.
2. **Given** a student answering an individual practice question in topical drill mode, **When** they submit an answer, **Then** the system immediately reveals the correctness and explanation for that single question in the response without saving a persistent attempt record or altering user exam pass statistics.

---

### Edge Cases

- **Network Disconnection During Attempt**: If a student's network disconnects while taking an exam, previously saved answers remain stored on the server. The wall-clock timer continues to elapse during the disconnection; the student can resume upon reconnecting provided the fixed expiration timestamp (`start_time + duration`) has not passed. If reconnected after expiration, the attempt is finalized and graded with the answers recorded before disconnection.
- **Concurrent Attempts**: If a student attempts to start multiple simultaneous attempts on the same exam, the system prompts them to resume their existing active attempt rather than creating confusing redundant sessions.
- **Abandoned Attempts**: If a student leaves an exam session open and never submits, the system automatically closes and grades the attempt once the duration plus an expiration grace period has elapsed.
- **Question Content Updates**: If a question or its explanation is updated in the question bank while an attempt is actively ongoing, the active attempt must continue using the question snapshot captured when the attempt was initiated.
- **Unanswered Questions Upon Submission**: If a student submits an exam with blank or unselected questions, the system prompts for confirmation, scores unselected questions as incorrect, and completes the grading process without error.
- **Multi-Select Question Partial Selection**: When a question of type 'multiple_choice' is submitted with only a subset of the correct options, the question is evaluated as incorrect (0 points) under the all-or-nothing scoring rule.
- **Pagination and Data Volume**: Subject, exam, question bank, and attempt history listings must support pagination and sorting to maintain fast load times even with large volumes of data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to register an account using a unique email address and a secure password.
- **FR-002**: System MUST authenticate registered users and issue secure session credentials for authorized operations.
- **FR-003**: System MUST provide authenticated users with access to view and update their personal account profile details.
- **FR-004**: System MUST automatically discover, ingest, and organize educational content from the repository's `exams/` directory structure under distinct subjects, each identifiable by its subject code (e.g., MAD101, NWC204, OSG202, PRO192), title, and description.
- **FR-005**: System MUST allow users to list all active subjects with summary information including total available exams.
- **FR-006**: System MUST allow users to list all exams associated with a specific subject.
- **FR-007**: System MUST provide exam metadata including title, descriptive instructions, time allowance (or untimed indicator), question count, and passing score percentage.
- **FR-008**: System MUST maintain a central question bank seeded directly from `exams/` JSON datasets and webp media files, exposing read-only exploration and exam assembly endpoints to students.
- **FR-009**: System MUST support questions with both single-choice ('single_choice') and multi-select ('multiple_choice') types conforming to the dataset schema in exams/, including question text, option choices, designated correct answer keys, detailed explanations, and accompanying image/webp media attachments.
- **FR-010**: System MUST allow an authenticated user to initiate a new attempt for a selected exam, recording the start timestamp, establishing a fixed non-pausable expiration timestamp (`start_time + duration`), and freezing the question set for that attempt.
- **FR-011**: System MUST allow users to record and update answers for individual questions within an active attempt prior to submission.
- **FR-012**: System MUST automatically finalize and grade active attempts when the server-side wall-clock time reaches or exceeds the calculated expiration timestamp.
- **FR-013**: System MUST grade submitted attempts using deterministic all-or-nothing scoring (full points awarded only when the submitted answer exactly matches the question's answer key for both single-choice and multiple-choice questions; zero points for incorrect or partial matches; no negative penalty deductions).
- **FR-014**: System MUST prevent access to correct answers and explanations while an attempt is active, releasing review data only after attempt finalization.
- **FR-015**: System MUST allow users to review completed attempts, displaying question prompts, selected choices, correct answers, correctness status, and explanations.
- **FR-016**: System MUST track and persist formal user exam attempts with start times, submission times, scores, and per-question answer selections; topical question drills MUST operate ephemerally without persisting attempt records or altering exam score statistics.
- **FR-017**: System MUST calculate and provide aggregate user statistics based on the best attempt model: exam pass status and subject proficiency reflect the highest score achieved per exam, while total attempts and total practice duration track all sittings cumulatively.
- **FR-018**: System MUST provide per-subject performance analytics displaying the number of attempts completed, average score across all attempts, and highest score achieved per exam within the subject.
- **FR-019**: System MUST allow users to view their chronological history of past exam attempts with filtering by subject and date range.
- **FR-020**: System MUST enforce strict ownership authorization ensuring users can only view or modify their own attempts, answers, and statistics.

### Key Entities

- **User**: Represents a student or platform user. Key attributes include unique user identifier, email address, password credential (securely hashed), full name, account status, creation date, and last login date.
- **Subject**: Represents an academic domain or course of study (e.g., Mathematics, Computer Architecture, Programming). Key attributes include unique subject identifier, subject code, title, description, icon/thumbnail reference, and active status.
- **Exam**: Represents a curated test paper or mock examination associated with a subject. Key attributes include unique exam identifier, subject identifier, title, description, time limit (duration in minutes), passing score threshold, total question count, and publication status.
- **Question**: Represents an individual evaluation item in the question bank conforming to the `exams/` schema. Key attributes include unique question identifier, subject identifier, question text/prompt, media attachment reference (e.g., webp diagram or image), question type (`single_choice` or `multiple_choice`), list of options/choices, correct answer identifier (e.g., 'C' for single choice or 'ACD' for multiple choice), option-by-option analysis, and explanatory rationale text.
- **Attempt**: Represents an individual student's sitting for a specific exam. Key attributes include unique attempt identifier, user identifier, exam identifier, start timestamp, completion timestamp, status (in-progress, completed, timed-out, abandoned), raw score, percentage score, pass/fail result, and duration elapsed.
- **AttemptAnswer**: Represents a student's specific answer submission to a question within an attempt. Key attributes include unique attempt answer identifier, attempt identifier, question identifier, chosen option identifier(s), correctness flag, and submission timestamp.
- **UserStatistics**: Represents the aggregated performance summary of a student following the best attempt model. Key attributes include user identifier, total attempts count (across all sittings), total unique exams passed (based on highest score), overall pass rate, total practice duration, and a collection of subject-specific metrics (subject identifier, subject attempt count, subject average score, and highest score achieved per exam).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: New users can register and start an exam attempt in under 2 minutes.
- **SC-002**: Upon submitting an exam attempt, the final score and pass/fail outcome are presented to the user within 1 second.
- **SC-003**: 100% of user answer submissions during an active attempt are safely persisted so that no answers are lost upon browser refresh or temporary network disconnects.
- **SC-004**: Cumulative user statistics and per-subject analytics reflect newly submitted exam results within 2 seconds of attempt completion.
- **SC-005**: 95% of users can locate a target subject and initiate a relevant exam within 3 navigation steps.
- **SC-006**: The system supports at least 500 concurrent active exam-taking sessions without test session interruption or data loss.
- **SC-007**: 100% of question reviews for completed attempts display complete explanation notes and relevant diagrams without missing content.

## Assumptions

- Users access the application via modern web or mobile clients with standard internet connectivity.
- Authentication utilizes standard secure token-based sessions with industry-standard credential encryption.
- Subjects, exams, questions, and media assets are ingested and synchronized directly from the repository's `exams/` directory via an automated startup/seed routine; administrative authoring and upload endpoints are out of scope for v1.
- Initial question formats focus on objective single-choice and multiple-choice questions to support instantaneous, deterministic automated grading.
- Explanations are provided in structured text with optional static media references (e.g., diagrams, formula screenshots).
- Each student is allowed multiple attempts on any practice exam to support repeated practice and mastery learning.
- Topical question drills are stateless/ephemeral learning exercises, whereas full mock exam sittings create persistent attempt records that drive user performance metrics.
- Guest/unauthenticated users may browse the public catalog of subjects and exams, but starting an attempt, saving answers, reviewing history, and tracking statistics strictly requires authentication.

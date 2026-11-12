import * as fs from "node:fs";
import * as path from "node:path";
import { eq } from "drizzle-orm";
import type { Database } from "./db";
import { subjects, exams, questions } from "./db/schema";

const SUBJECT_METADATA: Record<string, { title: string; description: string }> = {
  MAD101: {
    title: "Discrete Mathematics",
    description: "Logic, sets, relations, combinatorics, graph theory, and mathematical proofs."
  },
  NWC204: {
    title: "Computer Networking",
    description: "OSI and TCP/IP models, routing, switching, IP addressing, and network protocols."
  },
  OSG202: {
    title: "Operating Systems",
    description: "Processes, threads, CPU scheduling, memory management, and file systems."
  },
  PRO192: {
    title: "Object-Oriented Programming (Java)",
    description: "OOP principles, classes, inheritance, polymorphism, encapsulation, and Java collections."
  }
};

export interface RawQuestionItem {
  question_number?: number;
  question_id?: string;
  image_file?: string;
  subject_domain?: string;
  question_text_extracted?: string;
  key_points_and_rules?: string;
  option_by_option_analysis?: Record<string, string>;
  question_type?: string;
  community_answer?: string | null;
  ai_answer?: string | null;
  ai_explanation?: string | null;
  comparison?: Record<string, unknown>;
  community_stats?: Record<string, unknown>;
}

export function extractOptions(q: any): Record<string, string> {
  const optionsDict: Record<string, string> = {};

  if (q.option_by_option_analysis) {
    for (const key of Object.keys(q.option_by_option_analysis)) {
      optionsDict[key] = `Option ${key}`;
    }
  }

  if (q.question_text_extracted) {
    const lines = q.question_text_extracted.split("\n");
    for (const line of lines) {
      const match = line.trim().match(/^([A-Z])[\.:\)]\s+(.*)$/);
      if (match) {
        optionsDict[match[1]] = match[2].trim();
      }
    }
  }

  if (Object.keys(optionsDict).length === 0) {
    optionsDict["A"] = "Option A";
    optionsDict["B"] = "Option B";
    optionsDict["C"] = "Option C";
    optionsDict["D"] = "Option D";
  }

  return optionsDict;
}

export async function seedExamsFromDirectory(db: Database, examsRootDir: string): Promise<{
  subjectsCount: number;
  examsCount: number;
  questionsCount: number;
}> {
  if (!fs.existsSync(examsRootDir)) {
    throw new Error(`Exams directory not found at: ${examsRootDir}`);
  }

  let totalSubjects = 0;
  let totalExams = 0;
  let totalQuestions = 0;

  const subjectEntries = fs.readdirSync(examsRootDir, { withFileTypes: true });

  for (const subjectEntry of subjectEntries) {
    if (!subjectEntry.isDirectory()) continue;
    const subjectCode = subjectEntry.name;
    const subjectPath = path.join(examsRootDir, subjectCode);

    const meta = SUBJECT_METADATA[subjectCode] || {
      title: subjectCode,
      description: `Course and practice exams for ${subjectCode}`
    };

    // Upsert Subject
    const existingSubject = await db
      .select()
      .from(subjects)
      .where(eq(subjects.code, subjectCode))
      .get();

    let subjectId: string;
    const nowIso = new Date().toISOString();

    if (existingSubject) {
      subjectId = existingSubject.id;
    } else {
      subjectId = crypto.randomUUID();
      await db.insert(subjects).values({
        id: subjectId,
        code: subjectCode,
        title: meta.title,
        description: meta.description,
        icon_url: `/static/exams/${subjectCode}/icon.png`,
        created_at: nowIso
      });
      totalSubjects++;
    }

    const examEntries = fs.readdirSync(subjectPath, { withFileTypes: true });

    for (const examEntry of examEntries) {
      if (!examEntry.isDirectory()) continue;
      const examDirName = examEntry.name; // e.g., "MAD101 - FA25 - FEB5"
      const examPath = path.join(subjectPath, examDirName);

      // Find answers JSON file
      const files = fs.readdirSync(examPath);
      const jsonFileName = files.find((f) => f.endsWith(".json"));
      if (!jsonFileName) continue;

      const jsonFilePath = path.join(examPath, jsonFileName);
      const rawContent = fs.readFileSync(jsonFilePath, "utf8");
      const questionItems: RawQuestionItem[] = JSON.parse(rawContent);

      const examCode = examDirName;
      const existingExam = await db
        .select()
        .from(exams)
        .where(eq(exams.code, examCode))
        .get();

      let examId: string;
      if (existingExam) {
        examId = existingExam.id;
      } else {
        examId = crypto.randomUUID();
        await db.insert(exams).values({
          id: examId,
          subject_id: subjectId,
          code: examCode,
          title: examCode,
          description: `Practice examination for ${meta.title} (${examCode})`,
          duration_minutes: 60,
          total_questions: questionItems.length,
          passing_score_percentage: 70.0,
          is_published: true,
          created_at: nowIso
        });
        totalExams++;
      }

      // Insert Questions
      for (let i = 0; i < questionItems.length; i++) {
        const q = questionItems[i];
        const qNumber = q.question_number || i + 1;
        const qCode = q.question_id || `Q${qNumber}`;
        const questionDbId = `${examId}-${qCode}`;

        const existingQuestion = await db
          .select()
          .from(questions)
          .where(eq(questions.id, questionDbId))
          .get();

        if (existingQuestion) continue;

        // Build options dictionary
        const optionsDict = extractOptions(q);

        const normalizedCorrectAnswer = (q.ai_answer || q.community_answer || "A")
          .trim()
          .toUpperCase();

        const imageRelPath = q.image_file
          ? `/static/exams/${encodeURIComponent(subjectCode)}/${encodeURIComponent(examDirName)}/${q.image_file}`
          : null;

        await db.insert(questions).values({
          id: questionDbId,
          subject_id: subjectId,
          exam_id: examId,
          question_number: qNumber,
          question_id_code: qCode,
          question_text: q.question_text_extracted || `Question ${qNumber} (${subjectCode})`,
          image_file: imageRelPath,
          question_type: q.question_type || "single_choice",
          options: JSON.stringify(optionsDict),
          correct_answer: normalizedCorrectAnswer,
          ai_explanation: q.ai_explanation || null,
          option_by_option_analysis: q.option_by_option_analysis
            ? JSON.stringify(q.option_by_option_analysis)
            : null,
          community_stats: q.community_stats ? JSON.stringify(q.community_stats) : null,
          created_at: nowIso
        });
        totalQuestions++;
      }
    }
  }

  return {
    subjectsCount: totalSubjects,
    examsCount: totalExams,
    questionsCount: totalQuestions
  };
}

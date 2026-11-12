import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { execSync } from "node:child_process";

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

function escapeSql(str: string | null | undefined): string {
  if (str === null || str === undefined) return "NULL";
  return `'${str.replace(/'/g, "''")}'`;
}

function extractOptions(q: any): Record<string, string> {
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

export function generateSeedSql(examsRootDir: string, outFile: string) {
  const sqlStatements: string[] = [
    "-- Seed data generated from exams/ directory",
    "BEGIN TRANSACTION;"
  ];
  const now = new Date().toISOString();

  const subjectEntries = fs.readdirSync(examsRootDir, { withFileTypes: true });

  for (const subjectEntry of subjectEntries) {
    if (!subjectEntry.isDirectory()) continue;
    const subjectCode = subjectEntry.name;
    const subjectPath = path.join(examsRootDir, subjectCode);

    const meta = SUBJECT_METADATA[subjectCode] || {
      title: subjectCode,
      description: `Course and practice exams for ${subjectCode}`
    };

    const subjectId = `subj-${subjectCode.toLowerCase()}`;

    const examEntries = fs.readdirSync(subjectPath, { withFileTypes: true });

    // Verify the subject has at least one valid exam with a .json answers file
    const hasValidExams = examEntries.some((examEntry) => {
      if (!examEntry.isDirectory()) return false;
      const examPath = path.join(subjectPath, examEntry.name);
      try {
        const files = fs.readdirSync(examPath);
        return files.some((f) => f.endsWith(".json"));
      } catch {
        return false;
      }
    });

    if (!hasValidExams) continue;

    sqlStatements.push(
      `INSERT INTO subjects (id, code, title, description, icon_url, created_at) VALUES (${escapeSql(subjectId)}, ${escapeSql(subjectCode)}, ${escapeSql(meta.title)}, ${escapeSql(meta.description)}, ${escapeSql(`/static/exams/${subjectCode}/icon.png`)}, ${escapeSql(now)}) ON CONFLICT(code) DO UPDATE SET title = excluded.title, description = excluded.description, icon_url = excluded.icon_url;`
    );

    for (const examEntry of examEntries) {
      if (!examEntry.isDirectory()) continue;
      const examDirName = examEntry.name;
      const examPath = path.join(subjectPath, examDirName);

      const files = fs.readdirSync(examPath);
      const jsonFileName = files.find((f) => f.endsWith(".json"));
      if (!jsonFileName) continue;

      const rawContent = fs.readFileSync(path.join(examPath, jsonFileName), "utf8");
      const questionItems: any[] = JSON.parse(rawContent);

      const examCode = examDirName;
      const hash = crypto.createHash("sha256").update(examCode).digest("hex").substring(0, 24);
      const examId = `exam-${hash}`;

      sqlStatements.push(
        `INSERT INTO exams (id, subject_id, code, title, description, duration_minutes, total_questions, passing_score_percentage, is_published, created_at) VALUES (${escapeSql(examId)}, ${escapeSql(subjectId)}, ${escapeSql(examCode)}, ${escapeSql(examCode)}, ${escapeSql(`Practice examination for ${meta.title} (${examCode})`)}, 60, ${questionItems.length}, 70.0, 1, ${escapeSql(now)}) ON CONFLICT(code) DO UPDATE SET total_questions = excluded.total_questions, title = excluded.title, description = excluded.description;`
      );

      for (let i = 0; i < questionItems.length; i++) {
        const q = questionItems[i];
        const qNumber = q.question_number || i + 1;
        const qCode = q.question_id || `Q${qNumber}`;
        const questionId = `${examId}-${qCode}`;

        const optionsDict = extractOptions(q);

        const normalizedCorrectAnswer = (q.ai_answer || q.community_answer || "A")
          .trim()
          .toUpperCase();

        const imageRelPath = q.image_file
          ? `/static/exams/${encodeURIComponent(subjectCode)}/${encodeURIComponent(examDirName)}/${q.image_file}`
          : null;

        const optionsJson = JSON.stringify(optionsDict);
        const optionAnalysisJson = q.option_by_option_analysis
          ? JSON.stringify(q.option_by_option_analysis)
          : null;
        const communityStatsJson = q.community_stats ? JSON.stringify(q.community_stats) : null;

        sqlStatements.push(
          `INSERT INTO questions (id, subject_id, exam_id, question_number, question_id_code, question_text, image_file, question_type, options, correct_answer, ai_explanation, option_by_option_analysis, community_stats, created_at) VALUES (${escapeSql(questionId)}, ${escapeSql(subjectId)}, ${escapeSql(examId)}, ${qNumber}, ${escapeSql(qCode)}, ${escapeSql(q.question_text_extracted || `Question ${qNumber}`)}, ${escapeSql(imageRelPath)}, ${escapeSql(q.question_type || "single_choice")}, ${escapeSql(optionsJson)}, ${escapeSql(normalizedCorrectAnswer)}, ${escapeSql(q.ai_explanation)}, ${escapeSql(optionAnalysisJson)}, ${escapeSql(communityStatsJson)}, ${escapeSql(now)}) ON CONFLICT(id) DO UPDATE SET question_text = excluded.question_text, image_file = excluded.image_file, question_type = excluded.question_type, options = excluded.options, correct_answer = excluded.correct_answer, ai_explanation = excluded.ai_explanation, option_by_option_analysis = excluded.option_by_option_analysis, community_stats = excluded.community_stats;`
        );
      }
    }
  }

  sqlStatements.push("COMMIT;");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, sqlStatements.join("\n"), "utf8");
  console.log(`Generated ${sqlStatements.length - 2} SQL seed statements to ${outFile}`);
}

async function main() {
  const isRemote = process.argv.includes("--remote");
  const examsDir = path.resolve(process.cwd(), "exams");
  const seedSqlFile = path.resolve(process.cwd(), "scripts", "seed.sql");

  console.log(`Scanning exams directory: ${examsDir}...`);
  generateSeedSql(examsDir, seedSqlFile);

  if (isRemote) {
    console.log("Executing seed against remote D1 database...");
    execSync(`npx wrangler d1 execute DB --remote --yes --file=scripts/seed.sql`, {
      stdio: "inherit"
    });
    console.log("✓ Remote D1 database successfully seeded!");
  } else {
    console.log("Executing seed against local D1 database...");
    try {
      execSync(
        `python -c "import sqlite3, glob; f = glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')[0]; con = sqlite3.connect(f); con.executescript(open('scripts/seed.sql', encoding='utf-8').read()); con.close();"`,
        { stdio: "inherit" }
      );
      console.log("✓ Local D1 database successfully seeded!");
    } catch {
      execSync(`npx wrangler d1 execute DB --local --yes --file=scripts/seed.sql`, {
        stdio: "inherit"
      });
      console.log("✓ Local D1 database successfully seeded via Wrangler!");
    }
  }
}

if (process.argv[1] && process.argv[1].includes("seed-d1")) {
  main();
}

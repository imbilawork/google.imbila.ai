// POST /api/assess — serves a human-vetted quiz for the Imbila.AI Google Academy.
// Questions come from the committed, reviewed quiz-bank.json (NOT generated live by AI),
// so the answer key is trustworthy and grading is deterministic. We serve a randomised
// subset per attempt and shuffle the options (remapping the correct index) for integrity.

import quizBank from "../../quiz-bank.json";

interface AssessRequest {
  module?: string;
  moduleId?: string | number;
}

type BankQuestion = { q: string; options: string[]; correct: number; explanation: string };

const QUESTIONS_PER_ATTEMPT = (quizBank as any)._meta?.questionsServedPerAttempt || 4;

const TITLE_TO_ID: Record<string, string> = {
  "introduction to google ai ecosystem": "1",
  "getting started with google ai studio": "2",
  "understanding gemini models": "3",
  "prompting with gemini": "4",
  "building your first ai application": "5",
  "multimodal ai": "6",
  "google cloud ai services": "7",
  "deploying ai applications to production": "8",
  "scaling and monitoring ai workloads": "9",
  "ai ethics and responsible development": "10",
};

function resolveId(body: AssessRequest): string | null {
  if (body.moduleId != null && (quizBank as any)[String(body.moduleId)]) return String(body.moduleId);
  if (body.module) {
    const t = body.module.replace(/&#8212;|&#8211;|—|–/g, "").replace(/&amp;/g, "&").toLowerCase().trim();
    if ((quizBank as any)[t]) return t;
    for (const [title, id] of Object.entries(TITLE_TO_ID)) {
      if (t.startsWith(title)) return id;
    }
  }
  return null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const onRequestPost: PagesFunction = async (context) => {
  let body: AssessRequest;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = resolveId(body);
  const pool: BankQuestion[] = id ? ((quizBank as any)[id] as BankQuestion[]) : [];

  if (!pool || pool.length === 0) {
    return Response.json(
      { questions: [], error: "No vetted quiz is available for this module yet." },
      { status: 200 }
    );
  }

  const picked = shuffle(pool).slice(0, Math.min(QUESTIONS_PER_ATTEMPT, pool.length));
  const questions = picked.map((item) => {
    const tagged = item.options.map((text, i) => ({ text, isCorrect: i === item.correct }));
    const shuffled = shuffle(tagged);
    return {
      question: item.q,
      options: shuffled.map((o) => o.text),
      correct: shuffled.findIndex((o) => o.isCorrect),
      explanation: item.explanation,
    };
  });

  return Response.json({ questions, source: "vetted" });
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};

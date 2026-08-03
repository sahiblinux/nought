export type Language = {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  blurb: string;
  glyph: string;
  accent: string;
  judge0_id: number;
  filename: string;
  difficulty: string;
  born: string;
  paradigm: string;
  sort_order: number;
  lesson_count?: number;
  module_count?: number;
  total_xp?: number;
};

export type Module = {
  id: number;
  language_slug: string;
  slug: string;
  title: string;
  summary: string;
  sort_order: number;
};

export type LessonStub = {
  id: number;
  language_slug: string;
  module_slug: string;
  slug: string;
  title: string;
  subtitle: string;
  kind: 'lesson' | 'quiz';
  xp: number;
  sort_order: number;
};

export type QuizQuestion = {
  q: string;
  options: string[];
  answer: number;
  explain: string;
};

export type Lesson = LessonStub & {
  concept: string;
  example_code: string;
  example_note: string;
  task: string;
  starter_code: string;
  solution_code: string;
  expected_output: string;
  check_mode: string;
  hints: string[] | null;
  quiz: { questions: QuizQuestion[] } | null;
};

export type Profile = {
  id: number;
  user_key: string;
  display_name: string;
  email: string | null;
  xp: number;
  streak: number;
  hearts: number;
  lessons_done: number;
  last_active: string | null;
  created_at: string | null;
};

export type ProgressRow = {
  id: number;
  user_key: string;
  lesson_id: number;
  language_slug: string;
  status: 'attempted' | 'completed';
  attempts: number;
  best_code: string | null;
  xp_earned: number;
  completed_at: string | null;
  updated_at: string | null;
};

export type Achievement = {
  id: number;
  slug: string;
  title: string;
  description: string;
  glyph: string;
  xp: number;
  sort_order: number;
  earned?: boolean;
  earned_at?: string | null;
};

export type RunResult = {
  statusId: number;
  status: string;
  stdout: string;
  stderr: string;
  compileOutput: string;
  message: string;
  time: string | null;
  memory: number | null;
};

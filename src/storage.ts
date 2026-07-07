import {
  MISTAKE_REASONS,
  PARTS,
  type ChoiceKey,
  type MistakeReason,
  type Part,
  type Question,
  type QuestionDraft,
  type StudySession,
} from './types'

const STORAGE_KEY = 'toeic-month-note.questions.v1'
const SESSION_STORAGE_KEY = 'toeic-month-note.sessions.v1'
const REVIEW_INTERVAL_DAYS = [1, 3]
const REVIEW_GRADUATION_LEVEL = REVIEW_INTERVAL_DAYS.length + 1

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isSupportedPart(part: unknown): part is Part {
  return typeof part === 'string' && PARTS.includes(part as Part)
}

function isSupportedMistakeReason(reason: unknown): reason is MistakeReason {
  return typeof reason === 'string' && MISTAKE_REASONS.includes(reason as MistakeReason)
}

function normalizeText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined
}

function addDays(date: Date, days: number): string {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next.toISOString()
}

export function isReviewDue(question: Question, now = new Date()): boolean {
  if (!question.needsReview) return false
  if (!question.nextReviewAt) return true
  return new Date(question.nextReviewAt).getTime() <= now.getTime()
}

function normalizeQuestion(question: Partial<Question>): Question | null {
  if (
    !isSupportedPart(question.part) ||
    !question.questionText ||
    !question.choices ||
    !question.correctAnswer
  ) {
    return null
  }

  const initialWrong = Boolean(question.myAnswer && question.myAnswer !== question.correctAnswer)
  const isMistake = question.isMistake ?? initialWrong
  const needsReview = question.needsReview ?? isMistake
  return {
    id: question.id ?? makeId(),
    part: question.part,
    passage: normalizeText(question.passage),
    groupId: normalizeText(question.groupId),
    questionNumber: normalizeText(question.questionNumber),
    questionText: question.questionText,
    choices: question.choices,
    correctAnswer: question.correctAnswer,
    myAnswer: question.myAnswer,
    explanation: question.explanation ?? '',
    tags: Array.isArray(question.tags) ? question.tags : [],
    mistakeReason: isSupportedMistakeReason(question.mistakeReason)
      ? question.mistakeReason
      : undefined,
    createdAt: question.createdAt ?? new Date().toISOString(),
    reviewedCount: question.reviewedCount ?? 0,
    attemptCount: question.attemptCount ?? (question.myAnswer ? 1 : 0),
    correctCount:
      question.correctCount ?? (question.myAnswer === question.correctAnswer ? 1 : 0),
    incorrectCount: question.incorrectCount ?? (initialWrong ? 1 : 0),
    isMistake,
    needsReview,
    reviewLevel: question.reviewLevel ?? 0,
    reviewAttemptCount: question.reviewAttemptCount ?? 0,
    timedAttemptCount: normalizeNumber(question.timedAttemptCount),
    totalSolveTimeMs: normalizeNumber(question.totalSolveTimeMs),
    lastSolveTimeMs: normalizeOptionalNumber(question.lastSolveTimeMs),
    fastestSolveTimeMs: normalizeOptionalNumber(question.fastestSolveTimeMs),
    slowestSolveTimeMs: normalizeOptionalNumber(question.slowestSolveTimeMs),
    nextReviewAt: question.nextReviewAt ?? (needsReview ? question.lastAnsweredAt : undefined),
    lastReviewedAt: question.lastReviewedAt,
    firstAttemptCorrect:
      question.firstAttemptCorrect ??
      (question.myAnswer ? question.myAnswer === question.correctAnswer : undefined),
    firstAnsweredAt: question.firstAnsweredAt ?? (question.myAnswer ? question.createdAt : undefined),
    lastAnsweredAt: question.lastAnsweredAt,
  }
}

export function loadQuestions(): Question[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => normalizeQuestion(item as Partial<Question>))
      .filter((item): item is Question => item !== null)
  } catch {
    return []
  }
}

export function saveQuestions(questions: Question[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(questions))
}

export function draftToQuestion(draft: QuestionDraft): Question {
  const isCorrect = draft.myAnswer === draft.correctAnswer
  const isMistake = Boolean(draft.myAnswer && !isCorrect)
  const createdAt = new Date().toISOString()
  return {
    ...draft,
    passage: normalizeText(draft.passage),
    groupId: normalizeText(draft.groupId),
    questionNumber: normalizeText(draft.questionNumber),
    id: makeId(),
    createdAt,
    reviewedCount: 0,
    attemptCount: draft.myAnswer ? 1 : 0,
    correctCount: draft.myAnswer && isCorrect ? 1 : 0,
    incorrectCount: isMistake ? 1 : 0,
    isMistake,
    needsReview: isMistake,
    reviewLevel: 0,
    reviewAttemptCount: 0,
    timedAttemptCount: 0,
    totalSolveTimeMs: 0,
    nextReviewAt: isMistake ? createdAt : undefined,
    firstAttemptCorrect: draft.myAnswer ? isCorrect : undefined,
    firstAnsweredAt: draft.myAnswer ? createdAt : undefined,
    lastAnsweredAt: draft.myAnswer ? createdAt : undefined,
  }
}

export function recordAnswer(
  question: Question,
  answer: ChoiceKey,
  mistakeReason: MistakeReason | undefined,
  isReview: boolean,
  solveTimeMs?: number,
): Question {
  const isCorrect = answer === question.correctAnswer
  const answeredAt = new Date()
  const answeredAtIso = answeredAt.toISOString()
  const normalizedSolveTimeMs = normalizeOptionalNumber(solveTimeMs)
  const timedAttemptCount =
    normalizedSolveTimeMs === undefined
      ? question.timedAttemptCount
      : question.timedAttemptCount + 1
  const totalSolveTimeMs =
    normalizedSolveTimeMs === undefined
      ? question.totalSolveTimeMs
      : question.totalSolveTimeMs + normalizedSolveTimeMs
  const fastestSolveTimeMs =
    normalizedSolveTimeMs === undefined
      ? question.fastestSolveTimeMs
      : question.fastestSolveTimeMs === undefined
        ? normalizedSolveTimeMs
        : Math.min(question.fastestSolveTimeMs, normalizedSolveTimeMs)
  const slowestSolveTimeMs =
    normalizedSolveTimeMs === undefined
      ? question.slowestSolveTimeMs
      : question.slowestSolveTimeMs === undefined
        ? normalizedSolveTimeMs
        : Math.max(question.slowestSolveTimeMs, normalizedSolveTimeMs)
  const nextReviewLevel = isReview && isCorrect ? question.reviewLevel + 1 : 0
  const graduated = isReview && isCorrect && nextReviewLevel >= REVIEW_GRADUATION_LEVEL
  const needsReview = isCorrect
    ? graduated
      ? false
      : question.needsReview
    : true
  const nextReviewAt =
    isCorrect && isReview && !graduated
      ? addDays(answeredAt, REVIEW_INTERVAL_DAYS[Math.max(nextReviewLevel - 1, 0)])
      : isCorrect
        ? question.nextReviewAt
        : answeredAtIso

  return {
    ...question,
    myAnswer: answer,
    mistakeReason: isCorrect ? question.mistakeReason : mistakeReason,
    attemptCount: question.attemptCount + 1,
    correctCount: question.correctCount + (isCorrect ? 1 : 0),
    incorrectCount: question.incorrectCount + (isCorrect ? 0 : 1),
    isMistake: question.isMistake || !isCorrect,
    needsReview,
    reviewLevel: isCorrect && isReview ? nextReviewLevel : isCorrect ? question.reviewLevel : 0,
    reviewAttemptCount: question.reviewAttemptCount + (isReview ? 1 : 0),
    timedAttemptCount,
    totalSolveTimeMs,
    lastSolveTimeMs: normalizedSolveTimeMs ?? question.lastSolveTimeMs,
    fastestSolveTimeMs,
    slowestSolveTimeMs,
    nextReviewAt: needsReview ? nextReviewAt : undefined,
    reviewedCount: question.reviewedCount + (isReview && isCorrect ? 1 : 0),
    lastReviewedAt: isReview ? answeredAtIso : question.lastReviewedAt,
    firstAttemptCorrect:
      question.firstAttemptCorrect ?? (question.attemptCount === 0 ? isCorrect : undefined),
    firstAnsweredAt:
      question.firstAnsweredAt ?? (question.attemptCount === 0 ? answeredAtIso : undefined),
    lastAnsweredAt: answeredAtIso,
  }
}

export function assignFreshIds(questions: Question[]): Question[] {
  return questions.map((question) => ({ ...question, id: makeId() }))
}

export function loadStudySessions(): StudySession[] {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is StudySession => {
      const session = item as Partial<StudySession>
      return (
        typeof session.id === 'string' &&
        session.mode === 'exam' &&
        (session.part === 'all' || isSupportedPart(session.part)) &&
        typeof session.questionCount === 'number' &&
        typeof session.correctCount === 'number' &&
        typeof session.startedAt === 'string' &&
        typeof session.endedAt === 'string' &&
        typeof session.durationMs === 'number'
      )
    })
  } catch {
    return []
  }
}

export function saveStudySessions(sessions: StudySession[]): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions.slice(0, 100)))
}

export function createStudySession(input: Omit<StudySession, 'id'>): StudySession {
  return {
    ...input,
    id: makeId(),
  }
}

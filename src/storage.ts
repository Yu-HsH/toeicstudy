import type { ChoiceKey, MistakeReason, Question, QuestionDraft } from './types'

const STORAGE_KEY = 'toeic-month-note.questions.v1'

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeQuestion(question: Partial<Question>): Question | null {
  if (!question.part || !question.questionText || !question.choices || !question.correctAnswer) {
    return null
  }

  const initialWrong = Boolean(question.myAnswer && question.myAnswer !== question.correctAnswer)
  return {
    id: question.id ?? makeId(),
    part: question.part,
    questionText: question.questionText,
    choices: question.choices,
    correctAnswer: question.correctAnswer,
    myAnswer: question.myAnswer,
    explanation: question.explanation ?? '',
    tags: Array.isArray(question.tags) ? question.tags : [],
    mistakeReason: question.mistakeReason,
    createdAt: question.createdAt ?? new Date().toISOString(),
    reviewedCount: question.reviewedCount ?? 0,
    attemptCount: question.attemptCount ?? (question.myAnswer ? 1 : 0),
    correctCount:
      question.correctCount ?? (question.myAnswer === question.correctAnswer ? 1 : 0),
    incorrectCount: question.incorrectCount ?? (initialWrong ? 1 : 0),
    isMistake: question.isMistake ?? initialWrong,
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
  return {
    ...draft,
    id: makeId(),
    createdAt: new Date().toISOString(),
    reviewedCount: 0,
    attemptCount: draft.myAnswer ? 1 : 0,
    correctCount: draft.myAnswer && isCorrect ? 1 : 0,
    incorrectCount: isMistake ? 1 : 0,
    isMistake,
  }
}

export function recordAnswer(
  question: Question,
  answer: ChoiceKey,
  mistakeReason: MistakeReason | undefined,
  isReview: boolean,
): Question {
  const isCorrect = answer === question.correctAnswer
  return {
    ...question,
    myAnswer: answer,
    mistakeReason: isCorrect ? question.mistakeReason : mistakeReason,
    attemptCount: question.attemptCount + 1,
    correctCount: question.correctCount + (isCorrect ? 1 : 0),
    incorrectCount: question.incorrectCount + (isCorrect ? 0 : 1),
    isMistake: question.isMistake || !isCorrect,
    reviewedCount: question.reviewedCount + (isReview && isCorrect ? 1 : 0),
    lastAnsweredAt: new Date().toISOString(),
  }
}

export function assignFreshIds(questions: Question[]): Question[] {
  return questions.map((question) => ({ ...question, id: makeId() }))
}

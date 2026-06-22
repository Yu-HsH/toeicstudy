import { MISTAKE_REASONS, PARTS, type Question } from '../types'

export function getQuestionStats(questions: Question[]) {
  const attemptCount = questions.reduce((sum, item) => sum + item.attemptCount, 0)
  const correctCount = questions.reduce((sum, item) => sum + item.correctCount, 0)
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  return {
    total: questions.length,
    accuracy: attemptCount === 0 ? 0 : Math.round((correctCount / attemptCount) * 100),
    attemptCount,
    recent: questions.filter((item) => new Date(item.createdAt).getTime() >= sevenDaysAgo)
      .length,
    partMistakes: PARTS.map((part) => ({
      label: part,
      value: questions.filter((item) => item.part === part && item.isMistake).length,
    })),
    reasonMistakes: MISTAKE_REASONS.map((reason) => ({
      label: reason,
      value: questions.filter((item) => item.isMistake && item.mistakeReason === reason)
        .length,
    })),
  }
}

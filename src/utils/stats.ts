import { isReviewDue } from '../storage'
import { MISTAKE_REASONS, PARTS, type Question, type StudySession } from '../types'
import { getQuestionAverageSolveTimeMs } from './time'

function getQuestionLabel(question: Question): string {
  const number = question.questionNumber ? ` #${question.questionNumber}` : ''
  return `${question.part}${number} ${question.questionText}`.slice(0, 34)
}

export function getQuestionStats(questions: Question[], sessions: StudySession[] = []) {
  const attemptCount = questions.reduce((sum, item) => sum + item.attemptCount, 0)
  const correctCount = questions.reduce((sum, item) => sum + item.correctCount, 0)
  const reviewAttemptCount = questions.reduce((sum, item) => sum + item.reviewAttemptCount, 0)
  const reviewCorrectCount = questions.reduce((sum, item) => sum + item.reviewedCount, 0)
  const timedAttemptCount = questions.reduce((sum, item) => sum + item.timedAttemptCount, 0)
  const totalSolveTimeMs = questions.reduce((sum, item) => sum + item.totalSolveTimeMs, 0)
  const firstAnswered = questions.filter((item) => item.firstAttemptCorrect !== undefined)
  const firstCorrect = firstAnswered.filter((item) => item.firstAttemptCorrect).length
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentSessions = sessions.filter(
    (session) => new Date(session.endedAt).getTime() >= sevenDaysAgo,
  )
  const recentSessionQuestions = recentSessions.reduce(
    (sum, session) => sum + session.questionCount,
    0,
  )
  const recentSessionCorrect = recentSessions.reduce(
    (sum, session) => sum + session.correctCount,
    0,
  )
  const tagMap = new Map<string, number>()
  questions
    .filter((item) => item.isMistake)
    .forEach((item) => {
      item.tags.forEach((tag) => tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1))
    })

  return {
    total: questions.length,
    accuracy: attemptCount === 0 ? 0 : Math.round((correctCount / attemptCount) * 100),
    firstAccuracy:
      firstAnswered.length === 0 ? 0 : Math.round((firstCorrect / firstAnswered.length) * 100),
    reviewAccuracy:
      reviewAttemptCount === 0
        ? 0
        : Math.round((reviewCorrectCount / reviewAttemptCount) * 100),
    averageSolveTimeMs:
      timedAttemptCount === 0 ? 0 : Math.round(totalSolveTimeMs / timedAttemptCount),
    timedAttemptCount,
    recentSessionAccuracy:
      recentSessionQuestions === 0
        ? 0
        : Math.round((recentSessionCorrect / recentSessionQuestions) * 100),
    attemptCount,
    reviewAttemptCount,
    dueReview: questions.filter((item) => isReviewDue(item)).length,
    waitingReview: questions.filter((item) => item.needsReview && !isReviewDue(item)).length,
    recent: questions.filter((item) => new Date(item.createdAt).getTime() >= sevenDaysAgo)
      .length,
    sessionCount: sessions.length,
    latestSessions: sessions.slice(0, 5),
    averageSessionDuration:
      sessions.length === 0
        ? 0
        : Math.round(
            sessions.reduce((sum, session) => sum + session.durationMs, 0) / sessions.length,
          ),
    partMistakes: PARTS.map((part) => ({
      label: part,
      value: questions.filter((item) => item.part === part && item.isMistake).length,
    })),
    reasonMistakes: MISTAKE_REASONS.map((reason) => ({
      label: reason,
      value: questions.filter((item) => item.isMistake && item.mistakeReason === reason)
        .length,
    })),
    tagMistakes: [...tagMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    slowQuestions: questions
      .map((question) => ({
        label: getQuestionLabel(question),
        value: getQuestionAverageSolveTimeMs(question) ?? 0,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  }
}

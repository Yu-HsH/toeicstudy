import type { Question } from '../types'

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function getQuestionAverageSolveTimeMs(question: Question): number | undefined {
  if (question.timedAttemptCount <= 0 || question.totalSolveTimeMs <= 0) return undefined
  return Math.round(question.totalSolveTimeMs / question.timedAttemptCount)
}

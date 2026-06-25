import seedProgressData from './data/toeicVocabularyProgress.json'
import vocabData from './data/toeicVocabulary.json'

export type VocabularyMode = 'word2meaning' | 'meaning2word'
export type VocabularyScore = 0 | 3 | 5

export interface VocabularyItem {
  id: string
  day: string
  word: string
  meaning: string
  sourceKnown: string | null
}

export interface VocabularyProgressItem {
  reps: number
  lapses: number
  intervalDays: number
  ease: number
  due: string
  lastReviewedAt: string | null
}

export interface VocabularyProgress {
  version: number
  createdAt: string
  updatedAt?: string
  items: Record<string, VocabularyProgressItem>
}

interface VocabularyData {
  version: number
  createdAt: string
  count: number
  items: VocabularyItem[]
}

const STORAGE_KEY = 'toeic-month-note.vocabulary-progress.v1'
const typedVocabData = vocabData as VocabularyData
const seededProgress = normalizeVocabularyProgress(seedProgressData)

export const vocabularyItems = typedVocabData.items
export const vocabularyDays = [...new Set(vocabularyItems.map((item) => item.day))].sort(
  (left, right) => getDayNumber(left) - getDayNumber(right),
)

function getDayNumber(day: string): number {
  return Number(day.replace(/\D/g, '')) || 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeProgressItem(value: unknown): VocabularyProgressItem | null {
  if (!isRecord(value)) return null
  const due = typeof value.due === 'string' ? value.due : new Date().toISOString()
  const lastReviewedAt =
    typeof value.lastReviewedAt === 'string' ? value.lastReviewedAt : null

  return {
    reps: normalizeNumber(value.reps, 0),
    lapses: normalizeNumber(value.lapses, 0),
    intervalDays: normalizeNumber(value.intervalDays, 0),
    ease: normalizeNumber(value.ease, 2.5),
    due,
    lastReviewedAt,
  }
}

function normalizeVocabularyProgress(value: unknown): VocabularyProgress {
  if (!isRecord(value)) return createEmptyProgress()
  const sourceItems = isRecord(value.items) ? value.items : {}
  const items: Record<string, VocabularyProgressItem> = {}

  Object.entries(sourceItems).forEach(([id, item]) => {
    const normalized = normalizeProgressItem(item)
    if (normalized) items[id] = normalized
  })

  return {
    version: normalizeNumber(value.version, 1),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
    items,
  }
}

function createEmptyProgress(): VocabularyProgress {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    items: {},
  }
}

function cloneProgress(progress: VocabularyProgress): VocabularyProgress {
  return {
    ...progress,
    items: Object.fromEntries(
      Object.entries(progress.items).map(([id, item]) => [id, { ...item }]),
    ),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export function loadVocabularyProgress(): VocabularyProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return cloneProgress(seededProgress)
    return normalizeVocabularyProgress(JSON.parse(raw))
  } catch {
    return cloneProgress(seededProgress)
  }
}

export function saveVocabularyProgress(progress: VocabularyProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

export function isVocabularyDue(
  state: VocabularyProgressItem | undefined,
  now = new Date(),
): boolean {
  if (!state?.due) return true
  return new Date(state.due).getTime() <= now.getTime()
}

export function scoreVocabularyItem(
  progress: VocabularyProgress,
  itemId: string,
  score: VocabularyScore,
  reviewedAt = new Date(),
): VocabularyProgress {
  const previous = progress.items[itemId]
  let reps = previous?.reps ?? 0
  let lapses = previous?.lapses ?? 0
  let intervalDays = previous?.intervalDays ?? 0
  let ease = previous?.ease ?? 2.5
  const grade = clamp(score, 0, 5)

  if (grade < 3) {
    lapses += 1
    reps = 0
    intervalDays = 1
  } else {
    if (reps === 0) intervalDays = 1
    else if (reps === 1) intervalDays = 6
    else intervalDays = Math.max(1, Math.round(intervalDays * ease))
    reps += 1
  }

  ease += 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)
  ease = Math.max(1.3, ease)

  const due = addDays(reviewedAt, intervalDays)

  return {
    ...progress,
    updatedAt: reviewedAt.toISOString(),
    items: {
      ...progress.items,
      [itemId]: {
        reps,
        lapses,
        intervalDays,
        ease: Number(ease.toFixed(2)),
        due: due.toISOString(),
        lastReviewedAt: reviewedAt.toISOString(),
      },
    },
  }
}

export function getVocabularySummary(progress: VocabularyProgress) {
  const now = new Date()
  const states = vocabularyItems.map((item) => progress.items[item.id])
  const reviewedCount = states.filter((state) => state?.lastReviewedAt).length
  const dueCount = vocabularyItems.filter((item) =>
    isVocabularyDue(progress.items[item.id], now),
  ).length
  const weakCount = states.filter(
    (state) => state && (state.lapses > 0 || state.ease < 2.2),
  ).length
  const masteredCount = states.filter(
    (state) => state && state.reps >= 3 && !isVocabularyDue(state, now),
  ).length

  return {
    total: vocabularyItems.length,
    reviewedCount,
    dueCount,
    weakCount,
    masteredCount,
    waitingCount: vocabularyItems.length - dueCount,
  }
}

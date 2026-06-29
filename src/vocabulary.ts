import vocabData from './data/toeicVocabulary.json'

export type VocabularyMode = 'word2meaning' | 'meaning2word'
export type VocabularyReviewGrade = 'again' | 'hard' | 'good' | 'easy'
export type VocabularyStatus = 'new' | 'learning' | 'review' | 'relearning'

export interface VocabularyItem {
  id: string
  day: string
  word: string
  meaning: string
  sourceKnown: string | null
}

export interface VocabularyProgressItem {
  status: VocabularyStatus
  reps: number
  lapses: number
  intervalDays: number
  ease: number
  due: string | null
  lastReviewedAt: string | null
  acceptedAnswers: string[]
}

export interface VocabularyProgress {
  version: number
  createdAt: string
  updatedAt?: string
  items: Record<string, VocabularyProgressItem>
}

export interface VocabularyStudySettings {
  batchSize: number
  reviewRatio: number
  includeNew: boolean
}

interface VocabularyData {
  version: number
  createdAt: string
  count: number
  items: VocabularyItem[]
}

const STORAGE_KEY = 'toeic-month-note.vocabulary-progress.v2'
const LEGACY_STORAGE_KEYS = ['toeic-month-note.vocabulary-progress.v1']
const SETTINGS_KEY = 'toeic-month-note.vocabulary-settings.v1'
const DEFAULT_EASE = 2.5
const MIN_EASE = 1.3
const MAX_EASE = 3.2
const AGAIN_INTERVAL_DAYS = 10 / (24 * 60)
const DAY_MS = 24 * 60 * 60 * 1000
const typedVocabData = vocabData as VocabularyData

export const vocabularyItems = typedVocabData.items
export const vocabularyDays = [...new Set(vocabularyItems.map((item) => item.day))].sort(
  (left, right) => getDayNumber(left) - getDayNumber(right),
)

export const DEFAULT_VOCABULARY_SETTINGS: VocabularyStudySettings = {
  batchSize: 20,
  reviewRatio: 40,
  includeNew: true,
}

function getDayNumber(day: string): number {
  return Number(day.replace(/\D/g, '')) || 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

function normalizeStatus(value: unknown, lastReviewedAt: string | null): VocabularyStatus {
  if (
    value === 'new' ||
    value === 'learning' ||
    value === 'review' ||
    value === 'relearning'
  ) {
    return value
  }

  if (!lastReviewedAt) return 'new'
  return 'review'
}

function normalizeAcceptedAnswers(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
}

function getDefaultProgressItem(): VocabularyProgressItem {
  return {
    status: 'new',
    reps: 0,
    lapses: 0,
    intervalDays: 0,
    ease: DEFAULT_EASE,
    due: null,
    lastReviewedAt: null,
    acceptedAnswers: [],
  }
}

function normalizeProgressItem(value: unknown): VocabularyProgressItem | null {
  if (!isRecord(value)) return null
  const lastReviewedAt = typeof value.lastReviewedAt === 'string' ? value.lastReviewedAt : null
  const status = normalizeStatus(value.status, lastReviewedAt)
  const due = typeof value.due === 'string' && status !== 'new' ? value.due : null

  return {
    status,
    reps: normalizeNumber(value.reps, 0),
    lapses: normalizeNumber(value.lapses, 0),
    intervalDays: normalizeNumber(value.intervalDays, 0),
    ease: clamp(normalizeNumber(value.ease, DEFAULT_EASE), MIN_EASE, MAX_EASE),
    due,
    lastReviewedAt,
    acceptedAnswers: normalizeAcceptedAnswers(value.acceptedAnswers),
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


function scheduleVocabularyItem(
  previous: VocabularyProgressItem | undefined,
  grade: VocabularyReviewGrade,
  reviewedAt: Date,
): VocabularyProgressItem {
  const base = previous ?? getDefaultProgressItem()
  const wasNew = isVocabularyNew(base)
  const currentInterval = Math.max(base.intervalDays, 1)
  let reps = base.reps
  let lapses = base.lapses
  let intervalDays = base.intervalDays
  let ease = base.ease
  let status: VocabularyStatus = 'review'

  if (grade === 'again') {
    lapses += 1
    reps = 0
    intervalDays = AGAIN_INTERVAL_DAYS
    ease -= 0.2
    status = wasNew ? 'learning' : 'relearning'
  } else {
    reps += 1

    if (grade === 'hard') {
      intervalDays = wasNew ? 1 : Math.max(1, Math.round(currentInterval * 1.2))
      ease -= 0.15
    }

    if (grade === 'good') {
      if (wasNew || base.status === 'learning' || base.status === 'relearning') {
        intervalDays = 1
      } else if (base.reps <= 1) {
        intervalDays = 3
      } else {
        intervalDays = Math.max(1, Math.round(currentInterval * ease))
      }
    }

    if (grade === 'easy') {
      intervalDays = wasNew ? 4 : Math.max(2, Math.round(currentInterval * ease * 1.3))
      ease += 0.15
    }
  }

  ease = clamp(ease, MIN_EASE, MAX_EASE)

  return {
    ...base,
    status,
    reps,
    lapses,
    intervalDays,
    ease: Number(ease.toFixed(2)),
    due: addDays(reviewedAt, intervalDays).toISOString(),
    lastReviewedAt: reviewedAt.toISOString(),
  }
}

function normalizeSettings(value: unknown): VocabularyStudySettings {
  if (!isRecord(value)) return DEFAULT_VOCABULARY_SETTINGS

  return {
    batchSize: clamp(Math.round(normalizeNumber(value.batchSize, 20)), 5, 60),
    reviewRatio: clamp(Math.round(normalizeNumber(value.reviewRatio, 40)), 0, 100),
    includeNew: typeof value.includeNew === 'boolean' ? value.includeNew : true,
  }
}

export function loadVocabularyProgress(): VocabularyProgress {
  try {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createEmptyProgress()
    return normalizeVocabularyProgress(JSON.parse(raw))
  } catch {
    return createEmptyProgress()
  }
}

export function saveVocabularyProgress(progress: VocabularyProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

export function loadVocabularyStudySettings(): VocabularyStudySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_VOCABULARY_SETTINGS
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return DEFAULT_VOCABULARY_SETTINGS
  }
}

export function saveVocabularyStudySettings(settings: VocabularyStudySettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)))
}

export function isVocabularyNew(state: VocabularyProgressItem | undefined): boolean {
  return !state || state.status === 'new' || !state.lastReviewedAt
}

export function isVocabularyDue(
  state: VocabularyProgressItem | undefined,
  now = new Date(),
): boolean {
  if (isVocabularyNew(state)) return false
  if (!state?.due) return true
  return new Date(state.due).getTime() <= now.getTime()
}

export function isVocabularyWeak(state: VocabularyProgressItem | undefined): boolean {
  return Boolean(
    state &&
      !isVocabularyNew(state) &&
      (state.status === 'relearning' || state.lapses > 0 || state.ease < 2.2),
  )
}

export function getVocabularyReviewPriority(
  state: VocabularyProgressItem | undefined,
  now = new Date(),
): number {
  if (isVocabularyNew(state)) return Number.NEGATIVE_INFINITY
  const dueTime = state?.due ? new Date(state.due).getTime() : now.getTime()
  const lastReviewedTime = state?.lastReviewedAt
    ? new Date(state.lastReviewedAt).getTime()
    : now.getTime()
  const overdueDays = Math.max(0, (now.getTime() - dueTime) / DAY_MS)
  const ageDays = Math.max(0, (now.getTime() - lastReviewedTime) / DAY_MS)
  let priority = 0

  if (isVocabularyDue(state, now)) priority += 1000
  if (state?.status === 'learning' || state?.status === 'relearning') priority += 250
  priority += overdueDays * 25
  priority += (state?.lapses ?? 0) * 40
  priority += Math.max(0, DEFAULT_EASE - (state?.ease ?? DEFAULT_EASE)) * 30
  priority += Math.min(ageDays, 60) * 0.8

  return priority
}

export function previewVocabularySchedule(
  state: VocabularyProgressItem | undefined,
  grade: VocabularyReviewGrade,
  reviewedAt = new Date(),
): VocabularyProgressItem {
  return scheduleVocabularyItem(state, grade, reviewedAt)
}

export function scoreVocabularyItem(
  progress: VocabularyProgress,
  itemId: string,
  grade: VocabularyReviewGrade,
  reviewedAt = new Date(),
): VocabularyProgress {
  const previous = progress.items[itemId]
  const next = scheduleVocabularyItem(previous, grade, reviewedAt)

  return {
    ...progress,
    updatedAt: reviewedAt.toISOString(),
    items: {
      ...progress.items,
      [itemId]: next,
    },
  }
}

export function addVocabularyAcceptedAnswer(
  progress: VocabularyProgress,
  itemId: string,
  answer: string,
  savedAt = new Date(),
): VocabularyProgress {
  const trimmed = answer.trim()
  if (!trimmed) return progress

  const previous = progress.items[itemId] ?? getDefaultProgressItem()
  const normalized = normalizeAnswerText(trimmed)
  const exists = previous.acceptedAnswers.some(
    (acceptedAnswer) => normalizeAnswerText(acceptedAnswer) === normalized,
  )

  if (exists) return progress

  return {
    ...progress,
    updatedAt: savedAt.toISOString(),
    items: {
      ...progress.items,
      [itemId]: {
        ...previous,
        acceptedAnswers: [...previous.acceptedAnswers, trimmed],
      },
    },
  }
}

export function normalizeAnswerText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()[\]{}"'`.,;:!?/\\|~·•]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getVocabularySummary(progress: VocabularyProgress) {
  const now = new Date()
  let reviewedCount = 0
  let dueCount = 0
  let newCount = 0
  let learningCount = 0
  let weakCount = 0
  let masteredCount = 0
  let waitingCount = 0

  vocabularyItems.forEach((item) => {
    const state = progress.items[item.id]

    if (isVocabularyNew(state)) {
      newCount += 1
      return
    }

    reviewedCount += 1
    if (isVocabularyDue(state, now)) dueCount += 1
    else waitingCount += 1

    if (state.status === 'learning' || state.status === 'relearning') learningCount += 1
    if (isVocabularyWeak(state)) weakCount += 1
    if (state.status === 'review' && state.reps >= 3 && !isVocabularyDue(state, now)) {
      masteredCount += 1
    }
  })

  return {
    total: vocabularyItems.length,
    reviewedCount,
    dueCount,
    newCount,
    learningCount,
    weakCount,
    masteredCount,
    waitingCount,
  }
}

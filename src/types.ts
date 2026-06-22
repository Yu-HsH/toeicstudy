export const PARTS = [
  'Part 1',
  'Part 2',
  'Part 3',
  'Part 4',
  'Part 5',
  'Part 6',
  'Part 7',
] as const

export const CHOICE_KEYS = ['A', 'B', 'C', 'D'] as const

export const MISTAKE_REASONS = [
  '단어',
  '품사',
  '문법',
  '전치사/접속사',
  '해석',
  '시간부족',
  'LC못들음',
  '기타',
] as const

export type Part = (typeof PARTS)[number]
export type ChoiceKey = (typeof CHOICE_KEYS)[number]
export type MistakeReason = (typeof MISTAKE_REASONS)[number]

export type Choices = Record<ChoiceKey, string>

export interface Question {
  id: string
  part: Part
  questionText: string
  choices: Choices
  correctAnswer: ChoiceKey
  myAnswer?: ChoiceKey
  explanation: string
  tags: string[]
  mistakeReason?: MistakeReason
  createdAt: string
  reviewedCount: number
  attemptCount: number
  correctCount: number
  incorrectCount: number
  isMistake: boolean
  lastAnsweredAt?: string
}

export interface QuestionDraft {
  part: Part
  questionText: string
  choices: Choices
  correctAnswer: ChoiceKey
  myAnswer?: ChoiceKey
  explanation: string
  tags: string[]
  mistakeReason?: MistakeReason
}

export type TabId = 'solve' | 'register' | 'review' | 'stats' | 'list'

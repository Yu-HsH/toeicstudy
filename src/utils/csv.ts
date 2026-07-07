import { draftToQuestion } from '../storage'
import {
  CHOICE_KEYS,
  MISTAKE_REASONS,
  PARTS,
  type ChoiceKey,
  type MistakeReason,
  type Part,
  type Question,
} from '../types'

const CSV_REQUIRED_HEADERS = [
  'part',
  'questionText',
  'choiceA',
  'choiceB',
  'choiceC',
  'choiceD',
  'correctAnswer',
  'myAnswer',
  'explanation',
  'tags',
  'mistakeReason',
] as const

const CSV_OPTIONAL_HEADERS = [
  'passage',
  'groupId',
  'questionNumber',
  'timedAttemptCount',
  'totalSolveTimeMs',
  'lastSolveTimeMs',
  'fastestSolveTimeMs',
  'slowestSolveTimeMs',
] as const
const CSV_HEADERS = [...CSV_REQUIRED_HEADERS, ...CSV_OPTIONAL_HEADERS] as const

function escapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

export function questionsToCsv(questions: Question[]): string {
  const rows = questions.map((question) => [
    question.part,
    question.questionText,
    question.choices.A,
    question.choices.B,
    question.choices.C,
    question.choices.D,
    question.correctAnswer,
    question.myAnswer ?? '',
    question.explanation,
    question.tags.join('|'),
    question.mistakeReason ?? '',
    question.passage ?? '',
    question.groupId ?? '',
    question.questionNumber ?? '',
    String(question.timedAttemptCount),
    String(question.totalSolveTimeMs),
    question.lastSolveTimeMs === undefined ? '' : String(question.lastSolveTimeMs),
    question.fastestSolveTimeMs === undefined ? '' : String(question.fastestSolveTimeMs),
    question.slowestSolveTimeMs === undefined ? '' : String(question.slowestSolveTimeMs),
  ])
  return `\uFEFF${[CSV_HEADERS, ...rows]
    .map((row) => row.map((cell) => escapeCell(cell)).join(','))
    .join('\r\n')}`
}

export function downloadQuestionsCsv(questions: Question[]): void {
  const blob = new Blob([questionsToCsv(questions)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  anchor.href = url
  anchor.download = `toeic-questions-${date}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function parseRows(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    const next = csv[index + 1]
    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)
  return rows
}

export interface CsvImportResult {
  questions: Question[]
  skipped: number
  skippedRows: {
    rowNumber: number
    reason: string
  }[]
}

function getRowError({
  part,
  correctAnswer,
  myAnswerValue,
  mistakeReasonValue,
  questionText,
  choices,
}: {
  part: string
  correctAnswer: string
  myAnswerValue: string
  mistakeReasonValue: string
  questionText: string
  choices: string[]
}): string | null {
  if (!PARTS.includes(part as Part)) return '지원하지 않는 파트입니다.'
  if (!CHOICE_KEYS.includes(correctAnswer as ChoiceKey)) return '정답 값이 A~D가 아닙니다.'
  if (!questionText) return '문제 내용이 비어 있습니다.'
  if (choices.some((choice) => !choice)) return '선택지 A~D 중 빈 값이 있습니다.'
  if (myAnswerValue && !CHOICE_KEYS.includes(myAnswerValue as ChoiceKey)) {
    return '내 답 값이 A~D가 아닙니다.'
  }
  if (
    mistakeReasonValue &&
    !MISTAKE_REASONS.includes(mistakeReasonValue as MistakeReason)
  ) {
    return '틀린 이유 값이 지원 목록에 없습니다.'
  }
  return null
}

function parseOptionalNonNegativeInteger(value: string): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : undefined
}

export function parseQuestionsCsv(csv: string): CsvImportResult {
  const rows = parseRows(csv.replace(/^\uFEFF/, ''))
  if (rows.length === 0) return { questions: [], skipped: 0, skippedRows: [] }

  const headers = rows[0].map((header) => header.trim())
  const indexes = Object.fromEntries(headers.map((header, index) => [header, index]))
  const hasHeaders = CSV_REQUIRED_HEADERS.every((header) => indexes[header] !== undefined)
  if (!hasHeaders) {
    throw new Error('CSV 헤더 형식이 올바르지 않습니다.')
  }

  const imported: Question[] = []
  const skippedRows: CsvImportResult['skippedRows'] = []
  for (const [rowIndex, row] of rows.slice(1).entries()) {
    const get = (header: (typeof CSV_HEADERS)[number]): string =>
      (row[indexes[header]] ?? '').trim()
    const part = get('part') as Part
    const correctAnswer = get('correctAnswer') as ChoiceKey
    const myAnswerValue = get('myAnswer')
    const mistakeReasonValue = get('mistakeReason')
    const choices = [
      get('choiceA'),
      get('choiceB'),
      get('choiceC'),
      get('choiceD'),
    ]
    const rowError = getRowError({
      part,
      correctAnswer,
      myAnswerValue,
      mistakeReasonValue,
      questionText: get('questionText'),
      choices,
    })

    if (rowError) {
      skippedRows.push({ rowNumber: rowIndex + 2, reason: rowError })
      continue
    }

    const question = draftToQuestion({
      part,
      passage: get('passage') || undefined,
      groupId: get('groupId') || undefined,
      questionNumber: get('questionNumber') || undefined,
      questionText: get('questionText'),
      choices: {
        A: get('choiceA'),
        B: get('choiceB'),
        C: get('choiceC'),
        D: get('choiceD'),
      },
      correctAnswer,
      myAnswer: myAnswerValue ? (myAnswerValue as ChoiceKey) : undefined,
      explanation: get('explanation'),
      tags: get('tags')
        .split('|')
        .map((tag) => tag.trim())
        .filter(Boolean),
      mistakeReason: mistakeReasonValue ? (mistakeReasonValue as MistakeReason) : undefined,
    })
    const timedAttemptCount = parseOptionalNonNegativeInteger(get('timedAttemptCount'))
    const totalSolveTimeMs = parseOptionalNonNegativeInteger(get('totalSolveTimeMs'))
    const lastSolveTimeMs = parseOptionalNonNegativeInteger(get('lastSolveTimeMs'))
    const fastestSolveTimeMs = parseOptionalNonNegativeInteger(get('fastestSolveTimeMs'))
    const slowestSolveTimeMs = parseOptionalNonNegativeInteger(get('slowestSolveTimeMs'))

    imported.push({
      ...question,
      timedAttemptCount: timedAttemptCount ?? question.timedAttemptCount,
      totalSolveTimeMs: totalSolveTimeMs ?? question.totalSolveTimeMs,
      lastSolveTimeMs,
      fastestSolveTimeMs,
      slowestSolveTimeMs,
    })
  }
  return { questions: imported, skipped: skippedRows.length, skippedRows }
}

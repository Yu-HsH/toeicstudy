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

const CSV_HEADERS = [
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
  anchor.click()
  URL.revokeObjectURL(url)
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
}

export function parseQuestionsCsv(csv: string): CsvImportResult {
  const rows = parseRows(csv.replace(/^\uFEFF/, ''))
  if (rows.length === 0) return { questions: [], skipped: 0 }

  const headers = rows[0].map((header) => header.trim())
  const indexes = Object.fromEntries(headers.map((header, index) => [header, index]))
  const hasHeaders = CSV_HEADERS.every((header) => indexes[header] !== undefined)
  if (!hasHeaders) {
    throw new Error('CSV 헤더 형식이 올바르지 않습니다.')
  }

  const imported: Question[] = []
  let skipped = 0
  for (const row of rows.slice(1)) {
    const get = (header: (typeof CSV_HEADERS)[number]): string =>
      (row[indexes[header]] ?? '').trim()
    const part = get('part') as Part
    const correctAnswer = get('correctAnswer') as ChoiceKey
    const myAnswerValue = get('myAnswer')
    const mistakeReasonValue = get('mistakeReason')

    if (
      !PARTS.includes(part) ||
      !CHOICE_KEYS.includes(correctAnswer) ||
      !get('questionText') ||
      CHOICE_KEYS.some((key) => !get(`choice${key}` as 'choiceA')) ||
      (myAnswerValue && !CHOICE_KEYS.includes(myAnswerValue as ChoiceKey)) ||
      (mistakeReasonValue &&
        !MISTAKE_REASONS.includes(mistakeReasonValue as MistakeReason))
    ) {
      skipped += 1
      continue
    }

    imported.push(
      draftToQuestion({
        part,
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
        mistakeReason: mistakeReasonValue
          ? (mistakeReasonValue as MistakeReason)
          : undefined,
      }),
    )
  }
  return { questions: imported, skipped }
}

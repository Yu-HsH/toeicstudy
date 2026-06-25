import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { EmptyState } from '../components/EmptyState'
import { QuestionDetails } from '../components/QuestionDetails'
import {
  MISTAKE_REASONS,
  PARTS,
  type MistakeReason,
  type Part,
  type Question,
} from '../types'
import { downloadQuestionsCsv, parseQuestionsCsv, type CsvImportResult } from '../utils/csv'

interface ListPageProps {
  questions: Question[]
  onDelete: (id: string) => void
  onUpdate: (question: Question) => void
  onImport: (questions: Question[]) => void
}

interface ImportPreview {
  fileName: string
  result: CsvImportResult
  freshQuestions: Question[]
  duplicateCount: number
}

function getQuestionSignature(question: Question): string {
  return [
    question.part,
    question.passage ?? '',
    question.questionText,
    question.choices.A,
    question.choices.B,
    question.choices.C,
    question.choices.D,
    question.correctAnswer,
  ]
    .map((value) => value.trim().toLowerCase())
    .join('|')
}

export function ListPage({ questions, onDelete, onUpdate, onImport }: ListPageProps) {
  const [partFilter, setPartFilter] = useState<Part | 'all'>('all')
  const [reasonFilter, setReasonFilter] = useState<MistakeReason | 'all'>('all')
  const [wrongOnly, setWrongOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [dedupeImport, setDedupeImport] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const existingSignatures = useMemo(
    () => new Set(questions.map((question) => getQuestionSignature(question))),
    [questions],
  )

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return [...questions]
      .filter((question) => partFilter === 'all' || question.part === partFilter)
      .filter(
        (question) => reasonFilter === 'all' || question.mistakeReason === reasonFilter,
      )
      .filter((question) => !wrongOnly || question.isMistake)
      .filter(
        (question) =>
          !keyword ||
          question.questionText.toLowerCase().includes(keyword) ||
          question.tags.some((tag) => tag.toLowerCase().includes(keyword)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [partFilter, questions, reasonFilter, search, wrongOnly])


  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const result = parseQuestionsCsv(await file.text())
      const seen = new Set(existingSignatures)
      const freshQuestions: Question[] = []
      let duplicateCount = 0
      result.questions.forEach((question) => {
        const signature = getQuestionSignature(question)
        if (seen.has(signature)) {
          duplicateCount += 1
          return
        }
        seen.add(signature)
        freshQuestions.push(question)
      })
      setImportPreview({
        fileName: file.name,
        result,
        freshQuestions,
        duplicateCount,
      })
      setImportMessage(
        `${result.questions.length}\uBB38\uC81C \uBBF8\uB9AC\uBCF4\uAE30${
          result.skipped > 0 ? ` \u00B7 ${result.skipped}\uD589 \uAC74\uB108\uB700` : ''
        }`,
      )
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'CSV\uB97C \uC77D\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.')
    } finally {
      event.target.value = ''
      window.setTimeout(() => setImportMessage(''), 3000)
    }
  }

  const confirmImport = () => {
    if (!importPreview) return
    const targetQuestions = dedupeImport
      ? importPreview.freshQuestions
      : importPreview.result.questions
    if (targetQuestions.length > 0) onImport(targetQuestions)
    setImportMessage(`${targetQuestions.length}\uBB38\uC81C\uB97C \uAC00\uC838\uC654\uC2B5\uB2C8\uB2E4.`)
    setImportPreview(null)
    window.setTimeout(() => setImportMessage(''), 3000)
  }

  return (
    <section className="page-section">
      <div className="section-heading split-heading">
        <div>
          <span className="eyebrow">QUESTION BANK</span>
          <h2>문제 목록</h2>
          <p>파트와 실수 원인으로 좁혀서 내 약점을 빠르게 찾으세요.</p>
        </div>
        <div className="list-actions">
        <span className="total-label">{filtered.length}문제</span>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            onChange={handleImport}
          />
          <button
            className="button ghost small"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            {'CSV \uAC00\uC838\uC624\uAE30'}
          </button>
          <button
            className="button ghost small"
            type="button"
            disabled={questions.length === 0}
            onClick={() => downloadQuestionsCsv(questions)}
          >
            {'CSV \uB0B4\uBCF4\uB0B4\uAE30'}
          </button>
        </div>
      </div>


      <div className={`inline-notice ${importMessage ? 'visible' : ''}`} role="status">
        {importMessage}
      </div>

      {importPreview && (
        <div className="import-preview panel">
          <div className="card-title-row">
            <h3>CSV 미리보기</h3>
            <span>{importPreview.fileName}</span>
          </div>
          <div className="import-summary-grid">
            <div>
              <span>가져올 수 있는 문제</span>
              <strong>{importPreview.result.questions.length}</strong>
            </div>
            <div>
              <span>중복 감지</span>
              <strong>{importPreview.duplicateCount}</strong>
            </div>
            <div>
              <span>건너뛴 행</span>
              <strong>{importPreview.result.skipped}</strong>
            </div>
          </div>
          {importPreview.result.skippedRows.length > 0 && (
            <div className="skip-list">
              {importPreview.result.skippedRows.slice(0, 5).map((row) => (
                <span key={row.rowNumber}>
                  {row.rowNumber}행 · {row.reason}
                </span>
              ))}
            </div>
          )}
          <div className="preview-actions">
            <label className="toggle-filter">
              <input
                type="checkbox"
                checked={dedupeImport}
                onChange={(event) => setDedupeImport(event.target.checked)}
              />
              <span>중복 제외</span>
            </label>
            <button className="button ghost small" type="button" onClick={() => setImportPreview(null)}>
              취소
            </button>
            <button
              className="button primary small"
              type="button"
              disabled={
                dedupeImport
                  ? importPreview.freshQuestions.length === 0
                  : importPreview.result.questions.length === 0
              }
              onClick={confirmImport}
            >
              가져오기 확정
            </button>
          </div>
        </div>
      )}

      <div className="filter-panel panel">
        <label className="field search-field">
          <span className="sr-only">문제 검색</span>
          <input
            type="search"
            placeholder="문제 내용이나 태그 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="sr-only">파트 필터</span>
          <select
            aria-label="파트 필터"
            value={partFilter}
            onChange={(event) => setPartFilter(event.target.value as Part | 'all')}
          >
            <option value="all">전체 파트</option>
            {PARTS.map((part) => (
              <option key={part}>{part}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="sr-only">틀린 이유 필터</span>
          <select
            aria-label="틀린 이유 필터"
            value={reasonFilter}
            onChange={(event) =>
              setReasonFilter(event.target.value as MistakeReason | 'all')
            }
          >
            <option value="all">모든 틀린 이유</option>
            {MISTAKE_REASONS.map((reason) => (
              <option key={reason}>{reason}</option>
            ))}
          </select>
        </label>
        <label className="toggle-filter">
          <input
            type="checkbox"
            checked={wrongOnly}
            onChange={(event) => setWrongOnly(event.target.checked)}
          />
          <span>오답만 보기</span>
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="⌕"
          title={questions.length === 0 ? '저장된 문제가 없어요' : '조건에 맞는 문제가 없어요'}
          description={
            questions.length === 0
              ? '문제 등록 탭에서 첫 문제를 추가해 보세요.'
              : '필터나 검색어를 바꾸면 다른 문제를 볼 수 있습니다.'
          }
        />
      ) : (
        <div className="question-list">
          {filtered.map((question) => (
            <QuestionDetails
              question={question}
              onDelete={onDelete}
              onUpdate={onUpdate}
              key={question.id}
            />
          ))}
        </div>
      )}
    </section>
  )
}

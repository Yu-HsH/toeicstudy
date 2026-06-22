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
import { downloadQuestionsCsv, parseQuestionsCsv } from '../utils/csv'

interface ListPageProps {
  questions: Question[]
  onDelete: (id: string) => void
  onImport: (questions: Question[]) => void
}

export function ListPage({ questions, onDelete, onImport }: ListPageProps) {
  const [partFilter, setPartFilter] = useState<Part | 'all'>('all')
  const [reasonFilter, setReasonFilter] = useState<MistakeReason | 'all'>('all')
  const [wrongOnly, setWrongOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      if (result.questions.length > 0) onImport(result.questions)
      setImportMessage(
        `${result.questions.length}?? ???${
          result.skipped > 0 ? ` ? ${result.skipped}? ???` : ''
        }`,
      )
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'CSV? ?? ?????.')
    } finally {
      event.target.value = ''
      window.setTimeout(() => setImportMessage(''), 3000)
    }
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
            CSV ????
          </button>
          <button
            className="button ghost small"
            type="button"
            disabled={questions.length === 0}
            onClick={() => downloadQuestionsCsv(questions)}
          >
            CSV ????
          </button>
        </div>
      </div>


      <div className={`inline-notice ${importMessage ? 'visible' : ''}`} role="status">
        {importMessage}
      </div>
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
            <QuestionDetails question={question} onDelete={onDelete} key={question.id} />
          ))}
        </div>
      )}
    </section>
  )
}

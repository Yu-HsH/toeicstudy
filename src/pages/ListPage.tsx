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

const CSV_CREATION_PROMPT = `TOEIC RC 학습 앱에 가져올 CSV 데이터를 만들어 주세요.

실제 TOEIC 기출문제, ETS/YBM 교재, 시중 문제집 문항을 복제하거나 변형하지 말고, 완전히 새로운 오리지널 TOEIC 스타일 문제로 작성하세요.

CSV 헤더는 반드시 아래 순서와 이름을 그대로 사용하세요.
part,questionText,choiceA,choiceB,choiceC,choiceD,correctAnswer,myAnswer,explanation,tags,mistakeReason,passage,groupId,questionNumber,timedAttemptCount,totalSolveTimeMs,lastSolveTimeMs,fastestSolveTimeMs,slowestSolveTimeMs

생성 분량:
- Part 5: 100문제
- Part 6: 100문제
- Part 7: 100문제
- 총 300행

공통 규칙:
- 출력은 CSV 코드블록 하나만 주세요.
- CSV 외 설명 문장은 쓰지 마세요.
- 모든 셀은 큰따옴표로 감싸세요.
- 셀 안에 줄바꿈과 큰따옴표 문자는 쓰지 마세요.
- correctAnswer는 A, B, C, D 중 하나만 쓰세요.
- myAnswer와 mistakeReason은 항상 빈칸으로 두세요.
- explanation은 한국어로 짧고 실전적으로 작성하세요.
- tags는 여러 개면 | 로 구분하세요.
- timedAttemptCount, totalSolveTimeMs, lastSolveTimeMs, fastestSolveTimeMs, slowestSolveTimeMs는 항상 빈칸으로 두세요.
- 정답 위치 A/B/C/D는 최대한 고르게 분포시키세요.
- 난이도는 쉬움 30%, 중간 50%, 어려움 20% 정도로 섞으세요.

Part 5 규칙:
- part 값은 "Part 5"
- passage, groupId, questionNumber는 빈칸으로 두세요.
- 어휘, 품사, 동사 형태, 시제, 수일치, 전치사, 접속사, 관계사, 비교급, 수동태 유형을 골고루 섞으세요.

Part 6 규칙:
- part 값은 "Part 6"
- 하나의 passage에 4문제씩 묶어 총 25개 지문을 만드세요.
- groupId는 P6-001부터 P6-025까지 사용하세요.
- questionNumber는 각 groupId 안에서 1, 2, 3, 4로 작성하세요.
- 같은 groupId의 4행은 동일한 passage를 사용하세요.
- passage는 이메일, 공지, 메모, 광고, 안내문 등 짧은 비즈니스 지문으로 작성하세요.
- questionText는 빈칸 보충, 문장 삽입, 문맥 연결 유형을 섞으세요.

Part 7 규칙:
- part 값은 "Part 7"
- 하나의 passage에 4문제씩 묶어 총 25개 지문을 만드세요.
- groupId는 P7-001부터 P7-025까지 사용하세요.
- questionNumber는 각 groupId 안에서 1, 2, 3, 4로 작성하세요.
- 같은 groupId의 4행은 동일한 passage를 사용하세요.
- passage는 이메일, 공지, 채팅, 광고, 일정표, 기사, 영수증, 안내문 등 TOEIC RC 스타일 지문으로 작성하세요.
- questionText는 주제, 세부정보, 추론, 의도, 동의어, 문장 삽입 유형을 골고루 섞으세요.

중요:
- 총 300행을 생략 없이 작성하세요.
- 중간에 "이하 생략" 같은 표현을 절대 쓰지 마세요.
- 출력이 너무 길어 한 번에 끝낼 수 없으면, 완성된 행까지만 출력하고 멈춘 뒤 제가 "계속"이라고 하면 다음 행부터 이어서 출력하세요. 이어서 출력할 때는 헤더를 반복하지 마세요.`

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
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptCopyLabel, setPromptCopyLabel] = useState('복사')
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

  const copyCsvPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CSV_CREATION_PROMPT)
      setPromptCopyLabel('복사됨')
      window.setTimeout(() => setPromptCopyLabel('복사'), 1500)
    } catch {
      setPromptCopyLabel('실패')
      window.setTimeout(() => setPromptCopyLabel('복사'), 1500)
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
          <button
            className="icon-button"
            type="button"
            aria-label="CSV 생성 프롬프트"
            title="CSV 생성 프롬프트"
            onClick={() => setPromptOpen((current) => !current)}
          >
            ?
          </button>
        </div>
      </div>


      <div className={`inline-notice ${importMessage ? 'visible' : ''}`} role="status">
        {importMessage}
      </div>

      {promptOpen && (
        <div className="csv-prompt-panel panel">
          <div className="card-title-row">
            <h3>CSV 생성 프롬프트</h3>
            <div className="button-row">
              <button className="button ghost small" type="button" onClick={copyCsvPrompt}>
                {promptCopyLabel}
              </button>
              <button className="button ghost small" type="button" onClick={() => setPromptOpen(false)}>
                닫기
              </button>
            </div>
          </div>
          <textarea readOnly rows={16} value={CSV_CREATION_PROMPT} />
        </div>
      )}

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

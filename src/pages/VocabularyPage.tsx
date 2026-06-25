import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import {
  getVocabularySummary,
  isVocabularyDue,
  scoreVocabularyItem,
  vocabularyDays,
  vocabularyItems,
  type VocabularyItem,
  type VocabularyMode,
  type VocabularyProgress,
  type VocabularyScore,
} from '../vocabulary'

type VocabularyScope = 'due' | 'all' | 'weak'
type DayFilter = 'all' | string
type CheckResult = 'correct' | 'wrong' | null

const BATCH_SIZES = [5, 10, 20]

interface VocabularyPageProps {
  progress: VocabularyProgress
  onProgressChange: (progress: VocabularyProgress) => void
}

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
  }
  return shuffled
}

function formatDay(day: string): string {
  const number = day.replace(/\D/g, '')
  return number ? `Day ${number}` : day
}

function formatDate(value: string | undefined): string {
  if (!value) return '새 단어'
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function getPrompt(item: VocabularyItem, mode: VocabularyMode): string {
  return mode === 'meaning2word' ? item.meaning : item.word
}

function getAnswer(item: VocabularyItem, mode: VocabularyMode): string {
  return mode === 'meaning2word' ? item.word : item.meaning
}

function getScoreLabel(score: VocabularyScore): string {
  if (score === 5) return '알고 있음'
  if (score === 3) return '헷갈림'
  return '모름'
}

function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()[\]{}"'`.,;:!?/\\|~·ㆍ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitMeanings(meaning: string): string[] {
  return meaning
    .split(/[,;\n]/)
    .map((item) => item.replace(/\([^)]*\)/g, ' ').trim())
    .filter(Boolean)
}

function isTypedAnswerCorrect(
  typedAnswer: string,
  item: VocabularyItem,
  mode: VocabularyMode,
): boolean {
  const normalizedTyped = normalizeAnswer(typedAnswer)
  if (!normalizedTyped) return false

  if (mode === 'meaning2word') {
    return normalizeAnswer(item.word) === normalizedTyped
  }

  const candidates = [item.meaning, ...splitMeanings(item.meaning)]
    .map(normalizeAnswer)
    .filter(Boolean)
  return candidates.some(
    (candidate) =>
      candidate === normalizedTyped ||
      (normalizedTyped.length >= 2 && candidate.includes(normalizedTyped)),
  )
}

export function VocabularyPage({ progress, onProgressChange }: VocabularyPageProps) {
  const [scope, setScope] = useState<VocabularyScope>('due')
  const [dayFilter, setDayFilter] = useState<DayFilter>('all')
  const [mode, setMode] = useState<VocabularyMode>('word2meaning')
  const [batchSize, setBatchSize] = useState(10)
  const [queue, setQueue] = useState<VocabularyItem[]>([])
  const [index, setIndex] = useState(0)
  const [typedAnswer, setTypedAnswer] = useState('')
  const [checkResult, setCheckResult] = useState<CheckResult>(null)
  const [completed, setCompleted] = useState(false)
  const [sessionStats, setSessionStats] = useState({
    answered: 0,
    remembered: 0,
    partial: 0,
    missed: 0,
  })

  const summary = useMemo(() => getVocabularySummary(progress), [progress])
  const eligibleItems = useMemo(() => {
    const now = new Date()
    return vocabularyItems.filter((item) => {
      if (dayFilter !== 'all' && item.day !== dayFilter) return false
      const state = progress.items[item.id]
      if (scope === 'all') return true
      if (scope === 'weak') return Boolean(state && (state.lapses > 0 || state.ease < 2.2))
      return isVocabularyDue(state, now)
    })
  }, [dayFilter, progress, scope])

  const current = queue[index]
  const currentState = current ? progress.items[current.id] : undefined
  const progressText =
    queue.length === 0 ? '0 / 0' : `${Math.min(index + 1, queue.length)} / ${queue.length}`

  useEffect(() => {
    setQueue([])
    setIndex(0)
    setTypedAnswer('')
    setCheckResult(null)
    setCompleted(false)
    setSessionStats({ answered: 0, remembered: 0, partial: 0, missed: 0 })
  }, [batchSize, dayFilter, mode, scope])

  const startBatch = () => {
    const nextQueue = shuffleItems(eligibleItems).slice(0, batchSize)
    setQueue(nextQueue)
    setIndex(0)
    setTypedAnswer('')
    setCheckResult(null)
    setCompleted(false)
    setSessionStats({ answered: 0, remembered: 0, partial: 0, missed: 0 })
  }

  const checkAnswer = () => {
    if (!current || !typedAnswer.trim()) return
    setCheckResult(isTypedAnswerCorrect(typedAnswer, current, mode) ? 'correct' : 'wrong')
  }

  const scoreCurrent = (score: VocabularyScore) => {
    if (!current) return
    onProgressChange(scoreVocabularyItem(progress, current.id, score))
    setSessionStats((stats) => ({
      answered: stats.answered + 1,
      remembered: stats.remembered + (score === 5 ? 1 : 0),
      partial: stats.partial + (score === 3 ? 1 : 0),
      missed: stats.missed + (score === 0 ? 1 : 0),
    }))

    if (index >= queue.length - 1) {
      setCompleted(true)
      setTypedAnswer('')
      setCheckResult(null)
      return
    }

    setIndex((currentIndex) => currentIndex + 1)
    setTypedAnswer('')
    setCheckResult(null)
  }

  const renderControls = () => (
    <article className="vocab-controls panel">
      <div className="field-row three-columns">
        <label className="field">
          <span>범위</span>
          <select value={scope} onChange={(event) => setScope(event.target.value as VocabularyScope)}>
            <option value="due">오늘 복습</option>
            <option value="weak">취약 단어</option>
            <option value="all">전체 단어</option>
          </select>
        </label>
        <label className="field">
          <span>Day</span>
          <select value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}>
            <option value="all">전체</option>
            {vocabularyDays.map((day) => (
              <option value={day} key={day}>
                {formatDay(day)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>방향</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as VocabularyMode)}>
            <option value="word2meaning">영어 → 뜻</option>
            <option value="meaning2word">뜻 → 영어</option>
          </select>
        </label>
      </div>

      <div className="vocab-action-row">
        <div className="part-chip-row">
          {BATCH_SIZES.map((size) => (
            <button
              className={batchSize === size ? 'active' : ''}
              type="button"
              key={size}
              onClick={() => setBatchSize(size)}
            >
              {size}개
            </button>
          ))}
        </div>
        <span className="exam-answer-count">{eligibleItems.length}개</span>
        <button
          className="button primary"
          type="button"
          disabled={eligibleItems.length === 0}
          onClick={startBatch}
        >
          시작
        </button>
      </div>
    </article>
  )

  const renderStudyCard = () => {
    if (completed) {
      return (
        <article className="vocab-card panel">
          <span className="eyebrow">DONE</span>
          <h3>이번 묶음 완료</h3>
          <div className="part-result-grid">
            <div className="part-result-item">
              <span>풀이</span>
              <strong>{sessionStats.answered}</strong>
            </div>
            <div className="part-result-item">
              <span>알고 있음</span>
              <strong>{sessionStats.remembered}</strong>
            </div>
            <div className="part-result-item">
              <span>헷갈림</span>
              <strong>{sessionStats.partial}</strong>
            </div>
            <div className="part-result-item">
              <span>모름</span>
              <strong>{sessionStats.missed}</strong>
            </div>
          </div>
          <div className="solve-actions">
            <button
              className="button primary"
              type="button"
              disabled={eligibleItems.length === 0}
              onClick={startBatch}
            >
              다음 묶음
            </button>
          </div>
        </article>
      )
    }

    if (!current) {
      return (
        <EmptyState
          icon="Aa"
          title={eligibleItems.length === 0 ? '해당 단어가 없습니다' : '단어 묶음을 시작하세요'}
          description={
            eligibleItems.length === 0
              ? '다른 범위나 Day를 선택하면 학습할 단어가 표시됩니다.'
              : `${eligibleItems.length}개 중 ${Math.min(batchSize, eligibleItems.length)}개를 풉니다.`
          }
          action={
            eligibleItems.length > 0 && (
              <button className="button primary" type="button" onClick={startBatch}>
                시작
              </button>
            )
          }
        />
      )
    }

    return (
      <article className="vocab-card panel">
        <div className="question-card__head">
          <div className="badge-row">
            <span className="part-badge">{formatDay(current.day)}</span>
            <span className="group-badge">{isVocabularyDue(currentState) ? '오늘 복습' : '대기'}</span>
            {currentState?.lapses ? (
              <span className="mistake-badge">놓침 {currentState.lapses}</span>
            ) : null}
          </div>
          <span className="question-number">{progressText}</span>
        </div>

        <div className="vocab-prompt">
          <span>{mode === 'meaning2word' ? '뜻' : '단어'}</span>
          <strong>{getPrompt(current, mode)}</strong>
        </div>

        <form
          className="vocab-answer-form"
          onSubmit={(event) => {
            event.preventDefault()
            checkAnswer()
          }}
        >
          <label className="field">
            <span>{mode === 'meaning2word' ? '단어를 입력하세요' : '뜻을 입력하세요'}</span>
            <input
              autoFocus
              value={typedAnswer}
              disabled={checkResult !== null}
              placeholder={mode === 'meaning2word' ? '예: resume' : '예: 이력서'}
              onChange={(event) => setTypedAnswer(event.target.value)}
            />
          </label>
          <button
            className="button primary"
            type="submit"
            disabled={!typedAnswer.trim() || checkResult !== null}
          >
            채점
          </button>
        </form>

        {checkResult && (
          <div className={`answer-feedback ${checkResult === 'correct' ? 'success' : 'error'}`}>
            <strong>{checkResult === 'correct' ? '정답입니다.' : '오답입니다.'}</strong>
            <p>
              정답: <b>{getAnswer(current, mode)}</b>
            </p>
          </div>
        )}

        <div className="vocab-meta">
          <span>다음 복습 {formatDate(currentState?.due)}</span>
          <span>반복 {currentState?.reps ?? 0}</span>
          <span>ease {currentState?.ease ?? 2.5}</span>
        </div>

        {checkResult === 'correct' && (
          <div className="solve-actions">
            <button className="button primary" type="button" onClick={() => scoreCurrent(5)}>
              정답 저장하고 다음
            </button>
          </div>
        )}

        {checkResult === 'wrong' && (
          <div className="score-actions">
            {([0, 3] as VocabularyScore[]).map((score) => (
              <button
                className="button ghost"
                type="button"
                key={score}
                onClick={() => scoreCurrent(score)}
              >
                {getScoreLabel(score)}으로 저장
              </button>
            ))}
          </div>
        )}
      </article>
    )
  }

  return (
    <section className="page-section">
      <div className="section-heading split-heading">
        <div>
          <span className="eyebrow">VOCAB</span>
          <h2>단어 복습</h2>
          <p>노랭이 단어장과 기존 CLI 복습 진도를 이어서 봅니다.</p>
        </div>
        <span className="progress-label">{progressText}</span>
      </div>

      <div className="stat-grid vocab-summary">
        <div className="stat-card accent">
          <span>오늘 복습</span>
          <strong>{summary.dueCount}</strong>
          <small>대기 {summary.waitingCount}개</small>
        </div>
        <div className="stat-card">
          <span>전체 단어</span>
          <strong>{summary.total}</strong>
          <small>기존 단어장</small>
        </div>
        <div className="stat-card">
          <span>풀이 기록</span>
          <strong>{summary.reviewedCount}</strong>
          <small>브라우저 저장</small>
        </div>
        <div className="stat-card">
          <span>취약 단어</span>
          <strong>{summary.weakCount}</strong>
          <small>놓침 또는 낮은 ease</small>
        </div>
        <div className="stat-card">
          <span>안정 단어</span>
          <strong>{summary.masteredCount}</strong>
          <small>3회 이상 성공</small>
        </div>
      </div>

      {renderControls()}
      {renderStudyCard()}
    </section>
  )
}

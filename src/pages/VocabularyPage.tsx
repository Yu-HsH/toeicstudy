import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import {
  addVocabularyAcceptedAnswer,
  getVocabularyReviewPriority,
  getVocabularySummary,
  isVocabularyDue,
  isVocabularyNew,
  isVocabularyWeak,
  loadVocabularyStudySettings,
  normalizeAnswerText,
  previewVocabularySchedule,
  saveVocabularyStudySettings,
  scoreVocabularyItem,
  vocabularyDays,
  vocabularyItems,
  type VocabularyItem,
  type VocabularyMode,
  type VocabularyProgress,
  type VocabularyProgressItem,
  type VocabularyReviewGrade,
  type VocabularyStudySettings,
} from '../vocabulary'

type VocabularyScope = 'mixed' | 'due' | 'new' | 'weak' | 'all'
type DayFilter = 'all' | string
type AnswerJudgement = 'match' | 'accepted' | 'close' | 'miss' | null
type QueueKind = 'review' | 'new'

interface StudyQueueEntry {
  item: VocabularyItem
  kind: QueueKind
}

interface SessionStats {
  answered: number
  review: number
  new: number
  again: number
  hard: number
  good: number
  easy: number
}

interface VocabularyPageProps {
  progress: VocabularyProgress
  onProgressChange: (progress: VocabularyProgress) => void
}

const BATCH_SIZES = [10, 20, 40]
const GRADE_OPTIONS: { grade: VocabularyReviewGrade; label: string; hint: string }[] = [
  { grade: 'again', label: '다시', hint: '기억 안 남' },
  { grade: 'hard', label: '어려움', hint: '간신히 맞음' },
  { grade: 'good', label: '보통', hint: '알고 있음' },
  { grade: 'easy', label: '쉬움', hint: '바로 떠오름' },
]

const initialSessionStats: SessionStats = {
  answered: 0,
  review: 0,
  new: 0,
  again: 0,
  hard: 0,
  good: 0,
  easy: 0,
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

function formatDate(value: string | null | undefined): string {
  if (!value) return '미학습'
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function formatIntervalDays(days: number): string {
  if (days < 1 / 24) return `${Math.max(1, Math.round(days * 24 * 60))}분`
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}시간`
  return `${Math.max(1, Math.round(days))}일`
}

function getPrompt(item: VocabularyItem, mode: VocabularyMode): string {
  return mode === 'meaning2word' ? item.meaning : item.word
}

function getAnswer(item: VocabularyItem, mode: VocabularyMode): string {
  return mode === 'meaning2word' ? item.word : item.meaning
}

function splitMeanings(meaning: string): string[] {
  return meaning
    .split(/[,;\n]/)
    .map((item) => item.replace(/\([^)]*\)/g, ' ').trim())
    .filter(Boolean)
}

function getAnswerCandidates(
  item: VocabularyItem,
  mode: VocabularyMode,
  state: VocabularyProgressItem | undefined,
): string[] {
  if (mode === 'meaning2word') return [item.word]
  return [item.meaning, ...splitMeanings(item.meaning), ...(state?.acceptedAnswers ?? [])]
}

function getAnswerJudgement(
  typedAnswer: string,
  item: VocabularyItem,
  mode: VocabularyMode,
  state: VocabularyProgressItem | undefined,
): AnswerJudgement {
  const normalizedTyped = normalizeAnswerText(typedAnswer)
  if (!normalizedTyped) return 'miss'

  const candidates = getAnswerCandidates(item, mode, state)
    .map((candidate) => normalizeAnswerText(candidate))
    .filter(Boolean)
  const acceptedCandidates = (state?.acceptedAnswers ?? [])
    .map((candidate) => normalizeAnswerText(candidate))
    .filter(Boolean)

  if (acceptedCandidates.includes(normalizedTyped)) return 'accepted'
  if (candidates.includes(normalizedTyped)) return 'match'
  if (
    candidates.some(
      (candidate) =>
        normalizedTyped.length >= 2 &&
        (candidate.includes(normalizedTyped) || normalizedTyped.includes(candidate)),
    )
  ) {
    return 'close'
  }

  return 'miss'
}

function getJudgementCopy(judgement: AnswerJudgement) {
  if (judgement === 'match') {
    return { title: '정답과 거의 같아요', tone: 'success' as const }
  }
  if (judgement === 'accepted') {
    return { title: '저장해 둔 표현과 같아요', tone: 'success' as const }
  }
  if (judgement === 'close') {
    return { title: '비슷할 수 있어요', tone: 'success' as const }
  }
  return { title: '직접 판단해 주세요', tone: 'error' as const }
}

function getStatusLabel(state: VocabularyProgressItem | undefined): string {
  if (isVocabularyNew(state)) return '새 단어'
  if (state?.status === 'learning') return '학습 중'
  if (state?.status === 'relearning') return '재학습'
  if (isVocabularyDue(state)) return '오늘 복습'
  return '대기'
}

function getKindLabel(kind: QueueKind): string {
  return kind === 'new' ? '새 단어' : '복습 우선'
}

function sortByReviewPriority(
  items: VocabularyItem[],
  progress: VocabularyProgress,
  now = new Date(),
): VocabularyItem[] {
  return [...items].sort(
    (left, right) =>
      getVocabularyReviewPriority(progress.items[right.id], now) -
      getVocabularyReviewPriority(progress.items[left.id], now),
  )
}

function interleaveEntries(reviewEntries: StudyQueueEntry[], newEntries: StudyQueueEntry[]) {
  const primary = newEntries.length >= reviewEntries.length ? newEntries : reviewEntries
  const secondary = newEntries.length >= reviewEntries.length ? reviewEntries : newEntries
  const interval = Math.max(1, Math.floor(primary.length / Math.max(1, secondary.length)))
  const result: StudyQueueEntry[] = []
  let secondaryIndex = 0

  primary.forEach((entry, index) => {
    result.push(entry)
    if ((index + 1) % interval === 0 && secondaryIndex < secondary.length) {
      result.push(secondary[secondaryIndex])
      secondaryIndex += 1
    }
  })

  while (secondaryIndex < secondary.length) {
    result.push(secondary[secondaryIndex])
    secondaryIndex += 1
  }

  return result
}

function buildMixedQueue(
  items: VocabularyItem[],
  progress: VocabularyProgress,
  settings: VocabularyStudySettings,
): StudyQueueEntry[] {
  const reviewCandidates = sortByReviewPriority(
    items.filter((item) => !isVocabularyNew(progress.items[item.id])),
    progress,
  )
  const newCandidates = shuffleItems(items.filter((item) => isVocabularyNew(progress.items[item.id])))
  const used = new Set<string>()
  const reviewTarget = settings.includeNew
    ? Math.round(settings.batchSize * (settings.reviewRatio / 100))
    : settings.batchSize
  const newTarget = settings.includeNew ? settings.batchSize - reviewTarget : 0
  const reviewPicked: VocabularyItem[] = []
  const newPicked: VocabularyItem[] = []

  const pickReview = (count: number) => {
    reviewCandidates.forEach((item) => {
      if (reviewPicked.length >= count || used.has(item.id)) return
      reviewPicked.push(item)
      used.add(item.id)
    })
  }

  const pickNew = (count: number) => {
    newCandidates.forEach((item) => {
      if (newPicked.length >= count || used.has(item.id)) return
      newPicked.push(item)
      used.add(item.id)
    })
  }

  pickReview(reviewTarget)
  if (settings.includeNew) pickNew(newTarget)

  if (settings.includeNew && reviewPicked.length < reviewTarget) {
    pickNew(newTarget + (reviewTarget - reviewPicked.length))
  }

  if (newPicked.length < newTarget) {
    pickReview(reviewTarget + (newTarget - newPicked.length))
  }

  while (reviewPicked.length + newPicked.length < settings.batchSize) {
    const before = reviewPicked.length + newPicked.length
    pickReview(reviewPicked.length + 1)
    if (settings.includeNew) pickNew(newPicked.length + 1)
    if (before === reviewPicked.length + newPicked.length) break
  }

  return interleaveEntries(
    reviewPicked.map((item) => ({ item, kind: 'review' })),
    newPicked.map((item) => ({ item, kind: 'new' })),
  ).slice(0, settings.batchSize)
}

function buildScopedQueue(
  items: VocabularyItem[],
  progress: VocabularyProgress,
  scope: VocabularyScope,
  batchSize: number,
): StudyQueueEntry[] {
  if (scope === 'new') {
    return shuffleItems(items.filter((item) => isVocabularyNew(progress.items[item.id])))
      .slice(0, batchSize)
      .map((item) => ({ item, kind: 'new' }))
  }

  const candidates = items.filter((item) => {
    const state = progress.items[item.id]
    if (scope === 'due') return isVocabularyDue(state)
    if (scope === 'weak') return isVocabularyWeak(state)
    return true
  })

  const ordered = scope === 'all' ? shuffleItems(candidates) : sortByReviewPriority(candidates, progress)
  return ordered.slice(0, batchSize).map((item) => ({
    item,
    kind: isVocabularyNew(progress.items[item.id]) ? 'new' : 'review',
  }))
}

function countAvailableItems(
  items: VocabularyItem[],
  progress: VocabularyProgress,
  scope: VocabularyScope,
  includeNew: boolean,
): number {
  if (scope === 'mixed') {
    return items.filter((item) => includeNew || !isVocabularyNew(progress.items[item.id])).length
  }

  return items.filter((item) => {
    const state = progress.items[item.id]
    if (scope === 'due') return isVocabularyDue(state)
    if (scope === 'new') return isVocabularyNew(state)
    if (scope === 'weak') return isVocabularyWeak(state)
    return true
  }).length
}

export function VocabularyPage({ progress, onProgressChange }: VocabularyPageProps) {
  const [scope, setScope] = useState<VocabularyScope>('mixed')
  const [dayFilter, setDayFilter] = useState<DayFilter>('all')
  const [mode, setMode] = useState<VocabularyMode>('word2meaning')
  const [settings, setSettings] = useState(loadVocabularyStudySettings)
  const [queue, setQueue] = useState<StudyQueueEntry[]>([])
  const [index, setIndex] = useState(0)
  const [typedAnswer, setTypedAnswer] = useState('')
  const [answerChecked, setAnswerChecked] = useState(false)
  const [answerJudgement, setAnswerJudgement] = useState<AnswerJudgement>(null)
  const [acceptedSaved, setAcceptedSaved] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [sessionStats, setSessionStats] = useState<SessionStats>(initialSessionStats)

  const summary = useMemo(() => getVocabularySummary(progress), [progress])
  const filteredItems = useMemo(
    () => vocabularyItems.filter((item) => dayFilter === 'all' || item.day === dayFilter),
    [dayFilter],
  )
  const availableCount = useMemo(
    () => countAvailableItems(filteredItems, progress, scope, settings.includeNew),
    [filteredItems, progress, scope, settings.includeNew],
  )

  const currentEntry = queue[index]
  const current = currentEntry?.item
  const currentState = current ? progress.items[current.id] : undefined
  const progressText =
    queue.length === 0 ? '0 / 0' : `${Math.min(index + 1, queue.length)} / ${queue.length}`

  useEffect(() => {
    saveVocabularyStudySettings(settings)
  }, [settings])

  useEffect(() => {
    setQueue([])
    setIndex(0)
    setTypedAnswer('')
    setAnswerChecked(false)
    setAnswerJudgement(null)
    setAcceptedSaved(false)
    setCompleted(false)
    setSessionStats(initialSessionStats)
  }, [settings.batchSize, settings.includeNew, settings.reviewRatio, dayFilter, mode, scope])

  const updateSettings = (nextSettings: Partial<VocabularyStudySettings>) => {
    setSettings((currentSettings) => ({ ...currentSettings, ...nextSettings }))
  }

  const buildQueue = () => {
    if (scope === 'mixed') return buildMixedQueue(filteredItems, progress, settings)
    return buildScopedQueue(filteredItems, progress, scope, settings.batchSize)
  }

  const startBatch = () => {
    const nextQueue = buildQueue()
    setQueue(nextQueue)
    setIndex(0)
    setTypedAnswer('')
    setAnswerChecked(false)
    setAnswerJudgement(null)
    setAcceptedSaved(false)
    setCompleted(false)
    setSessionStats(initialSessionStats)
  }

  const checkAnswer = () => {
    if (!current) return
    setAnswerJudgement(getAnswerJudgement(typedAnswer, current, mode, currentState))
    setAnswerChecked(true)
    setAcceptedSaved(false)
  }

  const resetAnswer = () => {
    setAnswerChecked(false)
    setAnswerJudgement(null)
    setAcceptedSaved(false)
  }

  const saveAcceptedAnswer = () => {
    if (!current || !typedAnswer.trim()) return
    onProgressChange(addVocabularyAcceptedAnswer(progress, current.id, typedAnswer))
    setAcceptedSaved(true)
    setAnswerJudgement('accepted')
  }

  const scoreCurrent = (grade: VocabularyReviewGrade) => {
    if (!current || !currentEntry) return
    onProgressChange(scoreVocabularyItem(progress, current.id, grade))
    setSessionStats((stats) => ({
      ...stats,
      answered: stats.answered + 1,
      review: stats.review + (currentEntry.kind === 'review' ? 1 : 0),
      new: stats.new + (currentEntry.kind === 'new' ? 1 : 0),
      [grade]: stats[grade] + 1,
    }))

    if (index >= queue.length - 1) {
      setCompleted(true)
      setTypedAnswer('')
      setAnswerChecked(false)
      setAnswerJudgement(null)
      setAcceptedSaved(false)
      return
    }

    setIndex((currentIndex) => currentIndex + 1)
    setTypedAnswer('')
    setAnswerChecked(false)
    setAnswerJudgement(null)
    setAcceptedSaved(false)
  }

  const renderControls = () => (
    <article className="vocab-controls panel">
      <div className="field-row three-columns">
        <label className="field">
          <span>범위</span>
          <select value={scope} onChange={(event) => setScope(event.target.value as VocabularyScope)}>
            <option value="mixed">오늘 학습</option>
            <option value="due">복습만</option>
            <option value="new">새 단어만</option>
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

      <div className="vocab-settings-row">
        <label className="field ratio-field">
          <span>
            복습 우선 비율 <b>{settings.reviewRatio}%</b>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={settings.reviewRatio}
            disabled={scope !== 'mixed'}
            onChange={(event) => updateSettings({ reviewRatio: Number(event.target.value) })}
          />
        </label>
        <label className="toggle-filter">
          <input
            type="checkbox"
            checked={settings.includeNew}
            disabled={scope !== 'mixed'}
            onChange={(event) => updateSettings({ includeNew: event.target.checked })}
          />
          새 단어 섞기
        </label>
      </div>

      <div className="vocab-action-row">
        <div className="part-chip-row" aria-label="학습 묶음 크기">
          {BATCH_SIZES.map((size) => (
            <button
              className={settings.batchSize === size ? 'active' : ''}
              type="button"
              key={size}
              onClick={() => updateSettings({ batchSize: size })}
            >
              {size}개
            </button>
          ))}
        </div>
        <span className="exam-answer-count">가능 {availableCount}개</span>
        <button
          className="button primary"
          type="button"
          disabled={availableCount === 0}
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
          <div className="part-result-grid vocab-result-grid">
            <div className="part-result-item">
              <span>전체</span>
              <strong>{sessionStats.answered}</strong>
            </div>
            <div className="part-result-item">
              <span>복습</span>
              <strong>{sessionStats.review}</strong>
            </div>
            <div className="part-result-item">
              <span>새 단어</span>
              <strong>{sessionStats.new}</strong>
            </div>
            <div className="part-result-item">
              <span>다시</span>
              <strong>{sessionStats.again}</strong>
            </div>
            <div className="part-result-item">
              <span>보통/쉬움</span>
              <strong>{sessionStats.good + sessionStats.easy}</strong>
            </div>
          </div>
          <div className="solve-actions">
            <button
              className="button primary"
              type="button"
              disabled={availableCount === 0}
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
          title={availableCount === 0 ? '학습할 단어가 없어요' : '단어 묶음을 시작하세요'}
          description={
            availableCount === 0
              ? '다른 범위나 Day를 선택하면 학습할 단어가 표시됩니다.'
              : `복습 ${settings.reviewRatio}% 기준으로 최대 ${Math.min(
                  settings.batchSize,
                  availableCount,
                )}개를 섞어 보여줍니다.`
          }
          action={
            availableCount > 0 && (
              <button className="button primary" type="button" onClick={startBatch}>
                시작
              </button>
            )
          }
        />
      )
    }

    const judgementCopy = getJudgementCopy(answerJudgement)
    const canSaveAcceptedAnswer =
      mode === 'word2meaning' &&
      answerChecked &&
      Boolean(typedAnswer.trim()) &&
      answerJudgement !== 'match' &&
      !acceptedSaved

    return (
      <article className="vocab-card panel">
        <div className="question-card__head">
          <div className="badge-row">
            <span className="part-badge">{formatDay(current.day)}</span>
            <span className="group-badge">{getKindLabel(currentEntry.kind)}</span>
            <span className="group-badge">{getStatusLabel(currentState)}</span>
            {currentState?.lapses ? (
              <span className="mistake-badge">실패 {currentState.lapses}</span>
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
            <span>{mode === 'meaning2word' ? '영어를 입력하세요' : '뜻을 입력하세요'}</span>
            <input
              autoFocus
              value={typedAnswer}
              disabled={answerChecked}
              placeholder={mode === 'meaning2word' ? '예: resume' : '예: 재개하다'}
              onChange={(event) => setTypedAnswer(event.target.value)}
            />
          </label>
          {answerChecked ? (
            <button className="button ghost" type="button" onClick={resetAnswer}>
              다시 입력
            </button>
          ) : (
            <button className="button primary" type="submit">
              정답 보기
            </button>
          )}
        </form>

        {answerChecked && (
          <div className={`answer-feedback ${judgementCopy.tone}`}>
            <strong>{judgementCopy.title}</strong>
            <p>
              정답: <b>{getAnswer(current, mode)}</b>
            </p>
            {mode === 'word2meaning' && currentState?.acceptedAnswers.length ? (
              <p>허용 표현: {currentState.acceptedAnswers.join(', ')}</p>
            ) : null}
            {canSaveAcceptedAnswer && (
              <button className="button ghost small accepted-answer-button" type="button" onClick={saveAcceptedAnswer}>
                내 답도 맞는 표현으로 저장
              </button>
            )}
            {acceptedSaved && <p>이 표현을 다음부터 정답 후보로 인정합니다.</p>}
          </div>
        )}

        <div className="vocab-meta">
          <span>다음 복습 {formatDate(currentState?.due)}</span>
          <span>반복 {currentState?.reps ?? 0}</span>
          <span>ease {currentState?.ease ?? 2.5}</span>
        </div>

        {answerChecked && (
          <div className="score-actions grade-actions">
            {GRADE_OPTIONS.map(({ grade, label, hint }) => {
              const preview = previewVocabularySchedule(currentState, grade)
              return (
                <button
                  className="button ghost grade-button"
                  type="button"
                  key={grade}
                  onClick={() => scoreCurrent(grade)}
                >
                  <strong>{label}</strong>
                  <span>{formatIntervalDays(preview.intervalDays)}</span>
                  <small>{hint}</small>
                </button>
              )
            })}
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
          <p>복습 우선순위와 새 단어를 원하는 비율로 섞어 학습합니다.</p>
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
          <span>새 단어</span>
          <strong>{summary.newCount}</strong>
          <small>아직 시작 전</small>
        </div>
        <div className="stat-card">
          <span>학습 중</span>
          <strong>{summary.learningCount}</strong>
          <small>짧은 간격 복습</small>
        </div>
        <div className="stat-card">
          <span>취약 단어</span>
          <strong>{summary.weakCount}</strong>
          <small>실패 또는 낮은 ease</small>
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

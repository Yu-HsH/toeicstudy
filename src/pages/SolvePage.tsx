import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { EmptyState } from '../components/EmptyState'
import { isReviewDue } from '../storage'
import { formatDuration } from '../utils/time'
import {
  CHOICE_KEYS,
  MISTAKE_REASONS,
  PARTS,
  type ChoiceKey,
  type MistakeReason,
  type Part,
  type Question,
  type StudySession,
} from '../types'

type PartFilter = Part | 'all'
type SolveMode = 'practice' | 'exam'

const EXAM_COUNT_OPTIONS = [5, 10, 20, 50, 100]

interface SolvePageProps {
  questions: Question[]
  isReview?: boolean
  onAnswer: (
    id: string,
    answer: ChoiceKey,
    reason: MistakeReason | undefined,
    isReview: boolean,
    solveTimeMs?: number,
  ) => void
  onSessionComplete: (session: Omit<StudySession, 'id'>) => void
  onGoRegister: () => void
}

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
  }
  return shuffled
}

function makeShuffleSeed(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getStableShuffleScore(seed: string, value: string): number {
  let hash = 2166136261
  const input = `${seed}:${value}`
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function getCountOptions(total: number): number[] {
  if (total <= 0) return []
  return [...EXAM_COUNT_OPTIONS.filter((option) => option < total), total]
}

function getQuestionGroupKey(question: Question): string {
  return question.groupId || question.passage || question.id
}

function shuffleQuestionGroups(questions: Question[], seed?: string): Question[] {
  const groups = new Map<string, Question[]>()
  questions.forEach((question) => {
    const key = getQuestionGroupKey(question)
    groups.set(key, [...(groups.get(key) ?? []), question])
  })
  if (seed) {
    return [...groups.entries()]
      .sort(([leftKey], [rightKey]) => {
        const leftScore = getStableShuffleScore(seed, leftKey)
        const rightScore = getStableShuffleScore(seed, rightKey)
        return leftScore === rightScore ? leftKey.localeCompare(rightKey) : leftScore - rightScore
      })
      .flatMap(([, group]) => group)
  }
  return shuffleItems([...groups.values()]).flat()
}

export function SolvePage({
  questions,
  isReview = false,
  onAnswer,
  onSessionComplete,
  onGoRegister,
}: SolvePageProps) {
  const [mode, setMode] = useState<SolveMode>('practice')
  const baseStudyQuestions = useMemo(
    () => (isReview ? questions.filter((question) => isReviewDue(question)) : questions),
    [questions, isReview],
  )
  const [practicePart, setPracticePart] = useState<PartFilter>('all')
  const [practiceShuffleSeed, setPracticeShuffleSeed] = useState(makeShuffleSeed)
  const [practiceStartedAt, setPracticeStartedAt] = useState(Date.now)
  const [practiceAnsweredAt, setPracticeAnsweredAt] = useState<number | null>(null)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<ChoiceKey | null>(null)
  const [reason, setReason] = useState<MistakeReason | ''>('')
  const [examPart, setExamPart] = useState<PartFilter>('all')
  const [examCount, setExamCount] = useState(10)
  const [examQuestions, setExamQuestions] = useState<Question[]>([])
  const [examIndex, setExamIndex] = useState(0)
  const [examAnswers, setExamAnswers] = useState<Record<string, ChoiceKey>>({})
  const [examWrongReasons, setExamWrongReasons] = useState<Record<string, MistakeReason | ''>>({})
  const [examQuestionTimes, setExamQuestionTimes] = useState<Record<string, number>>({})
  const [examActiveStartedAt, setExamActiveStartedAt] = useState<number | null>(null)
  const [examSubmitted, setExamSubmitted] = useState(false)
  const [examSaved, setExamSaved] = useState(false)
  const [examStartedAt, setExamStartedAt] = useState<number | null>(null)
  const [examEndedAt, setExamEndedAt] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(Date.now())

  const studyQuestions = useMemo(
    () => {
      const filtered = baseStudyQuestions.filter(
        (question) => practicePart === 'all' || question.part === practicePart,
      )
      return shuffleQuestionGroups(filtered, practiceShuffleSeed)
    },
    [baseStudyQuestions, practicePart, practiceShuffleSeed],
  )
  const current = studyQuestions[index % Math.max(studyQuestions.length, 1)]
  const isCorrect = selected === current?.correctAnswer
  const examPool = useMemo(
    () => questions.filter((question) => examPart === 'all' || question.part === examPart),
    [examPart, questions],
  )
  const examCountOptions = useMemo(() => getCountOptions(examPool.length), [examPool.length])
  const safeExamCount = Math.min(examCount, examPool.length)
  const examStarted = examQuestions.length > 0
  const examCurrent = examQuestions[examIndex]
  const answeredCount = examQuestions.filter((question) => examAnswers[question.id]).length
  const unansweredCount = examQuestions.length - answeredCount
  const examResults = useMemo(
    () =>
      examQuestions.map((question) => {
        const answer = examAnswers[question.id]
        return {
          question,
          answer,
          isCorrect: answer === question.correctAnswer,
          solveTimeMs: examQuestionTimes[question.id] ?? 0,
        }
      }),
    [examAnswers, examQuestionTimes, examQuestions],
  )
  const examCorrectCount = examResults.filter((result) => result.isCorrect).length
  const examWrongResults = examResults.filter((result) => !result.isCorrect)
  const examAccuracy =
    examQuestions.length === 0 ? 0 : Math.round((examCorrectCount / examQuestions.length) * 100)
  const examElapsedMs = examStartedAt
    ? (examSubmitted ? (examEndedAt ?? nowMs) : nowMs) - examStartedAt
    : 0
  const practiceElapsedMs = Math.max(0, (practiceAnsweredAt ?? nowMs) - practiceStartedAt)
  const examCurrentElapsedMs =
    examCurrent && examActiveStartedAt !== null && !examSubmitted
      ? (examQuestionTimes[examCurrent.id] ?? 0) + Math.max(0, nowMs - examActiveStartedAt)
      : examCurrent
        ? (examQuestionTimes[examCurrent.id] ?? 0)
        : 0
  const examAverageQuestionTimeMs =
    examQuestions.length === 0
      ? 0
      : Math.round(
          examQuestions.reduce(
            (sum, question) => sum + (examQuestionTimes[question.id] ?? 0),
            0,
          ) / examQuestions.length,
        )
  const canSaveExamResults = examWrongResults.every(
    (result) => examWrongReasons[result.question.id],
  )
  const partCounts = useMemo(
    () =>
      PARTS.map((part) => ({
        part,
        count: baseStudyQuestions.filter((question) => question.part === part).length,
      })),
    [baseStudyQuestions],
  )
  const totalPracticeCount = baseStudyQuestions.length
  const partResults = useMemo(
    () =>
      PARTS.map((part) => {
        const results = examResults.filter((result) => result.question.part === part)
        return {
          part,
          total: results.length,
          correct: results.filter((result) => result.isCorrect).length,
        }
      }).filter((result) => result.total > 0),
    [examResults],
  )

  useEffect(() => {
    if (index >= studyQuestions.length && studyQuestions.length > 0) setIndex(0)
  }, [index, studyQuestions.length])

  useEffect(() => {
    setSelected(null)
    setReason('')
    const startedAt = Date.now()
    setPracticeStartedAt(startedAt)
    setPracticeAnsweredAt(null)
    setNowMs(startedAt)
  }, [current?.id])

  useEffect(() => {
    if (isReview && mode === 'exam') setMode('practice')
  }, [isReview, mode])

  useEffect(() => {
    const nextOptions = getCountOptions(examPool.length)
    if (nextOptions.length === 0) return
    setExamCount((currentCount) => {
      if (nextOptions.includes(currentCount)) return currentCount
      return nextOptions.includes(10) ? 10 : nextOptions[nextOptions.length - 1]
    })
  }, [examPool.length])

  useEffect(() => {
    const shouldTick =
      (mode === 'practice' && !selected && studyQuestions.length > 0) ||
      (examStarted && !examSubmitted)
    if (!shouldTick) return undefined
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [examStarted, examSubmitted, mode, selected, studyQuestions.length])

  if (baseStudyQuestions.length === 0) {
    return (
      <section className="page-section">
        <div className="section-heading">
          <span className="eyebrow">{isReview ? 'REVIEW' : 'PRACTICE'}</span>
          <h2>{isReview ? '오답 복습' : '문제 풀기'}</h2>
        </div>
        <EmptyState
          icon={isReview ? '✓' : '＋'}
          title={isReview ? '복습할 오답이 없어요' : '아직 저장된 문제가 없어요'}
          description={
            isReview
              ? '문제를 풀고 틀리면 이곳에 자동으로 모입니다.'
              : '문제를 직접 등록하거나 예시용 샘플을 추가해 시작하세요.'
          }
          action={
            !isReview && (
              <button className="button primary" type="button" onClick={onGoRegister}>
                문제 등록하러 가기
              </button>
            )
          }
        />
      </section>
    )
  }

  const getExamQuestionTimesWithCurrent = (timestamp = Date.now()) => {
    if (!examStarted || examSubmitted || !examCurrent || examActiveStartedAt === null) {
      return examQuestionTimes
    }

    const elapsedMs = Math.max(0, timestamp - examActiveStartedAt)
    return {
      ...examQuestionTimes,
      [examCurrent.id]: (examQuestionTimes[examCurrent.id] ?? 0) + elapsedMs,
    }
  }

  const commitExamCurrentTime = (timestamp = Date.now()) => {
    const nextTimes = getExamQuestionTimesWithCurrent(timestamp)
    setExamQuestionTimes(nextTimes)
    setExamActiveStartedAt(timestamp)
    return nextTimes
  }

  const selectPracticeAnswer = (answer: ChoiceKey) => {
    const answeredAt = Date.now()
    setSelected(answer)
    setPracticeAnsweredAt(answeredAt)
    setNowMs(answeredAt)
  }

  const handleNext = () => {
    if (!selected || (!isCorrect && !reason)) return
    onAnswer(current.id, selected, reason || undefined, isReview, practiceElapsedMs)
    if (index >= studyQuestions.length - 1) {
      setPracticeShuffleSeed(makeShuffleSeed())
    }
    setIndex((currentIndex) => (currentIndex + 1) % studyQuestions.length)
    setSelected(null)
    setReason('')
  }

  const selectPracticePart = (part: PartFilter) => {
    setPracticePart(part)
    setPracticeShuffleSeed(makeShuffleSeed())
    setIndex(0)
    setSelected(null)
    setReason('')
  }

  const resetExamSession = () => {
    setExamQuestions([])
    setExamAnswers({})
    setExamWrongReasons({})
    setExamQuestionTimes({})
    setExamActiveStartedAt(null)
    setExamSubmitted(false)
    setExamSaved(false)
    setExamIndex(0)
    setExamStartedAt(null)
    setExamEndedAt(null)
  }

  const startExamSession = () => {
    if (examPool.length === 0 || safeExamCount === 0) return
    setExamQuestions(shuffleQuestionGroups(examPool).slice(0, safeExamCount))
    setExamAnswers({})
    setExamWrongReasons({})
    setExamQuestionTimes({})
    setExamSubmitted(false)
    setExamSaved(false)
    setExamIndex(0)
    const startedAt = Date.now()
    setExamStartedAt(startedAt)
    setExamActiveStartedAt(startedAt)
    setExamEndedAt(null)
  }

  const submitExamSession = () => {
    if (unansweredCount > 0) return
    const endedAt = Date.now()
    commitExamCurrentTime(endedAt)
    setExamEndedAt(endedAt)
    setExamSubmitted(true)
  }

  const saveExamResults = () => {
    if (!canSaveExamResults || examSaved || !examStartedAt) return
    const endedAt = examEndedAt ?? Date.now()
    examQuestions.forEach((question) => {
      const answer = examAnswers[question.id]
      if (!answer) return
      const reason =
        answer === question.correctAnswer
          ? undefined
          : examWrongReasons[question.id] || undefined
      onAnswer(question.id, answer, reason, false, examQuestionTimes[question.id])
    })
    onSessionComplete({
      mode: 'exam',
      part: examPart,
      questionCount: examQuestions.length,
      correctCount: examCorrectCount,
      startedAt: new Date(examStartedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      durationMs: endedAt - examStartedAt,
    })
    setExamSaved(true)
  }

  const retryWrongQuestions = () => {
    const wrongQuestions = examResults
      .filter((result) => !result.isCorrect)
      .map((result) => result.question)
    if (wrongQuestions.length === 0) return
    setExamQuestions(shuffleQuestionGroups(wrongQuestions))
    setExamAnswers({})
    setExamWrongReasons({})
    setExamQuestionTimes({})
    setExamSubmitted(false)
    setExamSaved(false)
    setExamIndex(0)
    const startedAt = Date.now()
    setExamStartedAt(startedAt)
    setExamActiveStartedAt(startedAt)
    setExamEndedAt(null)
  }

  const changeMode = (nextMode: SolveMode) => {
    setMode(nextMode)
    if (nextMode === 'practice') {
      resetExamSession()
      setPracticeShuffleSeed(makeShuffleSeed())
      setIndex(0)
    }
  }

  const renderPracticePartPicker = () => (
    <div className="practice-filter panel" aria-label="즉시 풀이 파트 선택">
      <span>풀 파트</span>
      <div className="part-chip-row">
        <button
          className={practicePart === 'all' ? 'active' : ''}
          type="button"
          onClick={() => selectPracticePart('all')}
        >
          전체 <strong>{totalPracticeCount}</strong>
        </button>
        {partCounts.map(({ part, count }) => (
          <button
            className={practicePart === part ? 'active' : ''}
            type="button"
            key={part}
            onClick={() => selectPracticePart(part)}
          >
            {part} <strong>{count}</strong>
          </button>
        ))}
      </div>
    </div>
  )

  const renderQuestionBadges = (question: Question, extra?: ReactNode) => (
    <div className="badge-row">
      <span className="part-badge">{question.part}</span>
      {extra}
      {question.groupId && <span className="group-badge">세트 {question.groupId}</span>}
      {question.questionNumber && (
        <span className="group-badge">문항 {question.questionNumber}</span>
      )}
      {question.tags.map((tag) => (
        <span className="tag" key={tag}>
          #{tag}
        </span>
      ))}
    </div>
  )

  const renderPassage = (question: Question) =>
    question.passage ? (
      <div className="passage-box">
        <strong>지문</strong>
        <p>{question.passage}</p>
      </div>
    ) : null

  const renderPracticeMode = () => (
    <>
      {!isReview && renderPracticePartPicker()}
      {studyQuestions.length === 0 ? (
        <EmptyState
          icon="⌕"
          title="선택한 파트에 문제가 없어요"
          description="다른 파트를 고르거나 문제 등록에서 해당 파트 문제를 추가해 보세요."
        />
      ) : (
        <>
      <div className="progress-track" aria-hidden="true">
        <span style={{ width: `${((index + 1) / studyQuestions.length) * 100}%` }} />
      </div>

      <article className="solve-card panel">
        {renderQuestionBadges(current)}
        {renderPassage(current)}
        <h3 className="solve-question">{current.questionText}</h3>
        <div className="choice-list">
          {CHOICE_KEYS.map((key) => {
            const revealed = selected !== null
            const correctChoice = revealed && key === current.correctAnswer
            const wrongChoice = revealed && key === selected && key !== current.correctAnswer
            return (
              <button
                type="button"
                key={key}
                className={`choice-button ${correctChoice ? 'correct' : ''} ${
                  wrongChoice ? 'wrong' : ''
                }`}
                disabled={revealed}
                onClick={() => selectPracticeAnswer(key)}
              >
                <span className="choice-key">{key}</span>
                <span>{current.choices[key]}</span>
                {correctChoice && <span className="choice-result">정답</span>}
                {wrongChoice && <span className="choice-result">내 답</span>}
              </button>
            )
          })}
        </div>

        {selected && (
          <div className={`answer-feedback ${isCorrect ? 'success' : 'error'}`}>
            <strong>{isCorrect ? '정답입니다!' : `정답은 ${current.correctAnswer}입니다.`}</strong>
            {current.explanation && <p>{current.explanation}</p>}
          </div>
        )}

        {selected && !isCorrect && (
          <label className="field reason-picker">
            <span>이번에 틀린 이유를 골라주세요.</span>
            <select
              required
              value={reason}
              onChange={(event) => setReason(event.target.value as MistakeReason | '')}
            >
              <option value="">틀린 이유 선택</option>
              {MISTAKE_REASONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        )}

        {selected && (
          <div className="solve-actions">
            <span className="question-time-label">
              풀이 시간 {formatDuration(practiceElapsedMs)}
            </span>
            <button
              className="button primary"
              type="button"
              disabled={!isCorrect && !reason}
              onClick={handleNext}
            >
              {index === studyQuestions.length - 1 ? '저장하고 처음으로' : '저장하고 다음 문제'}
            </button>
          </div>
        )}
      </article>
        </>
      )}
    </>
  )

  const renderExamSetup = () => (
    <article className="exam-setup panel">
      <div className="card-title-row">
        <h3>실전 세트 만들기</h3>
        <span>{examPool.length}문제</span>
      </div>

      <div className="field-row two-columns">
        <label className="field">
          <span>파트</span>
          <select
            value={examPart}
            onChange={(event) => {
              setExamPart(event.target.value as PartFilter)
              resetExamSession()
            }}
          >
            <option value="all">전체 파트</option>
            {partCounts.map(({ part, count }) => (
              <option value={part} key={part}>
                {part} ({count}문제)
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>문제 수</span>
          <select
            value={safeExamCount || ''}
            disabled={examCountOptions.length === 0}
            onChange={(event) => setExamCount(Number(event.target.value))}
          >
            {examCountOptions.length === 0 ? (
              <option value="">문제 없음</option>
            ) : (
              examCountOptions.map((count) => (
                <option value={count} key={count}>
                  {count}문제
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      <div className="part-count-grid" aria-label="파트별 저장 문제 수">
        <button
          className={examPart === 'all' ? 'active' : ''}
          type="button"
          onClick={() => setExamPart('all')}
        >
          <strong>전체</strong>
          <span>{totalPracticeCount}</span>
        </button>
        {partCounts.map(({ part, count }) => (
          <button
            className={examPart === part ? 'active' : ''}
            type="button"
            key={part}
            onClick={() => setExamPart(part)}
          >
            <strong>{part}</strong>
            <span>{count}</span>
          </button>
        ))}
      </div>

      <div className="solve-actions">
        <button
          className="button primary"
          type="button"
          disabled={examPool.length === 0 || safeExamCount === 0}
          onClick={startExamSession}
        >
          실전 시작
        </button>
      </div>
    </article>
  )

  const renderExamQuestion = () => {
    if (!examCurrent) return renderExamSetup()
    const currentAnswer = examAnswers[examCurrent.id]

    return (
      <>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${((examIndex + 1) / examQuestions.length) * 100}%` }} />
        </div>

        <article className="solve-card panel">
          {renderQuestionBadges(examCurrent, <span className="exam-badge">실전</span>)}
          {renderPassage(examCurrent)}
          <h3 className="solve-question">{examCurrent.questionText}</h3>
          <div className="choice-list">
            {CHOICE_KEYS.map((key) => (
              <button
                type="button"
                key={key}
                className={`choice-button ${currentAnswer === key ? 'selected' : ''}`}
                onClick={() =>
                  setExamAnswers((currentAnswers) => ({
                    ...currentAnswers,
                    [examCurrent.id]: key,
                  }))
                }
              >
                <span className="choice-key">{key}</span>
                <span>{examCurrent.choices[key]}</span>
              </button>
            ))}
          </div>

          <div className="exam-navigation">
            <button
              className="button ghost"
              type="button"
              disabled={examIndex === 0}
              onClick={() => {
                commitExamCurrentTime()
                setExamIndex((currentIndex) => currentIndex - 1)
              }}
            >
              이전
            </button>
            <span className="exam-answer-count">
              {answeredCount} / {examQuestions.length} 답변
            </span>
            <span className="exam-answer-count">시간 {formatDuration(examElapsedMs)}</span>
            <span className="exam-answer-count">
              현재 문제 {formatDuration(examCurrentElapsedMs)}
            </span>
            <button
              className="button ghost"
              type="button"
              disabled={examIndex === examQuestions.length - 1}
              onClick={() => {
                commitExamCurrentTime()
                setExamIndex((currentIndex) => currentIndex + 1)
              }}
            >
              다음
            </button>
            <button
              className="button primary"
              type="button"
              disabled={unansweredCount > 0}
              onClick={submitExamSession}
            >
              제출하고 채점
            </button>
          </div>
        </article>
      </>
    )
  }

  const renderExamResults = () => (
    <div className="exam-results">
      <article className="exam-result-summary panel">
        <div>
          <span className="eyebrow">RESULT</span>
          <h3>{examAccuracy}%</h3>
          <p>
            {examCorrectCount} / {examQuestions.length}문제 정답 · 총{' '}
            {formatDuration(examElapsedMs)} · 문제당 평균{' '}
            {formatDuration(examAverageQuestionTimeMs)}
          </p>
        </div>
        <div className="result-actions">
          <button
            className="button primary"
            type="button"
            disabled={!canSaveExamResults || examSaved}
            onClick={saveExamResults}
          >
            {examSaved ? '결과 저장됨' : '결과 저장'}
          </button>
          <button className="button ghost" type="button" onClick={resetExamSession}>
            새 실전 세트
          </button>
          <button
            className="button primary"
            type="button"
            disabled={!examSaved || examCorrectCount === examQuestions.length}
            onClick={retryWrongQuestions}
          >
            틀린 문제 다시 풀기
          </button>
        </div>
      </article>

      <div className="part-result-grid">
        {partResults.map((result) => (
          <div className="part-result-item" key={result.part}>
            <span>{result.part}</span>
            <strong>
              {result.correct}/{result.total}
            </strong>
          </div>
        ))}
      </div>

      <div className="question-list">
        {examResults.map((result, resultIndex) => (
          <article
            className={`question-card ${result.isCorrect ? 'result-correct' : 'result-wrong'}`}
            key={result.question.id}
          >
            <div className="question-card__head">
              {renderQuestionBadges(
                result.question,
                <span className={result.isCorrect ? 'correct-badge' : 'mistake-badge'}>
                  {result.isCorrect ? '정답' : '오답'}
                </span>,
              )}
              <span className="question-number">
                #{resultIndex + 1} · {formatDuration(result.solveTimeMs)}
              </span>
            </div>
            {renderPassage(result.question)}
            <h3 className="question-text">{result.question.questionText}</h3>
            <div className="choice-list compact">
              {CHOICE_KEYS.map((key) => {
                const correctChoice = key === result.question.correctAnswer
                const wrongChoice = key === result.answer && key !== result.question.correctAnswer
                return (
                  <div
                    className={`choice-row ${correctChoice ? 'correct' : ''} ${
                      wrongChoice ? 'wrong' : ''
                    }`}
                    key={key}
                  >
                    <span className="choice-key">{key}</span>
                    <span>{result.question.choices[key]}</span>
                    <span className="choice-mark">
                      {correctChoice ? '정답' : wrongChoice ? '내 답' : ''}
                    </span>
                  </div>
                )
              })}
            </div>
            {result.question.explanation && (
              <div className="explanation-box">
                <strong>해설</strong>
                <p>{result.question.explanation}</p>
              </div>
            )}
            {!result.isCorrect && (
              <label className="field reason-picker compact-reason">
                <span>틀린 이유</span>
                <select
                  required
                  value={examWrongReasons[result.question.id] ?? ''}
                  disabled={examSaved}
                  onChange={(event) =>
                    setExamWrongReasons((currentReasons) => ({
                      ...currentReasons,
                      [result.question.id]: event.target.value as MistakeReason | '',
                    }))
                  }
                >
                  <option value="">선택</option>
                  {MISTAKE_REASONS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            )}
          </article>
        ))}
      </div>
    </div>
  )

  const renderExamMode = () => {
    if (examSubmitted) return renderExamResults()
    if (examStarted) return renderExamQuestion()
    return renderExamSetup()
  }

  const progressText =
    mode === 'exam' && examStarted && !examSubmitted
      ? `${examIndex + 1} / ${examQuestions.length}`
      : mode === 'exam' && examSubmitted
        ? `${examCorrectCount} / ${examQuestions.length}`
        : studyQuestions.length === 0
          ? '0 / 0'
          : `${index + 1} / ${studyQuestions.length}`

  return (
    <section className="page-section">
      <div className="section-heading split-heading">
        <div>
          <span className="eyebrow">{isReview ? 'REVIEW' : mode === 'exam' ? 'TEST' : 'PRACTICE'}</span>
          <h2>{isReview ? '오답 복습' : mode === 'exam' ? '실전 모드' : '문제 풀기'}</h2>
          <p>
            {isReview
              ? '다시 맞힌 문제는 복습 정답 횟수가 올라갑니다.'
              : mode === 'exam'
                ? '파트와 문제 수를 고른 뒤 마지막에 한 번에 채점합니다.'
                : '저장된 문제를 한 문제씩 차분하게 풀어보세요.'}
          </p>
        </div>
        <span className="progress-label">{progressText}</span>
      </div>

      {!isReview && (
        <div className="mode-toggle" aria-label="풀이 모드">
          <button
            className={mode === 'practice' ? 'active' : ''}
            type="button"
            onClick={() => changeMode('practice')}
          >
            즉시 풀이
          </button>
          <button
            className={mode === 'exam' ? 'active' : ''}
            type="button"
            onClick={() => changeMode('exam')}
          >
            실전 모드
          </button>
        </div>
      )}

      {mode === 'exam' && !isReview ? renderExamMode() : renderPracticeMode()}
    </section>
  )
}

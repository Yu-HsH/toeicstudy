import { isReviewDue } from '../storage'
import type { Question, StudySession, TabId } from '../types'
import { getQuestionStats } from '../utils/stats'
import { formatDuration } from '../utils/time'

interface VocabularyDashboardSummary {
  total: number
  reviewedCount: number
  dueCount: number
  newCount: number
  learningCount: number
  weakCount: number
  masteredCount: number
  waitingCount: number
}

interface DashboardPageProps {
  questions: Question[]
  sessions: StudySession[]
  vocabularySummary: VocabularyDashboardSummary
  onNavigate: (tab: TabId) => void
}

const DAILY_QUESTION_TARGET = 100
const DAILY_REVIEW_TARGET = 30
const DAILY_VOCAB_TARGET = 200
const MIN_QUESTION_BANK_TARGET = 300

function isToday(value: string | undefined): boolean {
  if (!value) return false
  const date = new Date(value)
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

function getPercent(value: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((value / target) * 100))
}

function getDashboardMessage({
  dueReview,
  dueVocabulary,
  questionCount,
}: {
  dueReview: number
  dueVocabulary: number
  questionCount: number
}) {
  if (questionCount < MIN_QUESTION_BANK_TARGET) {
    return '문제 수부터 채우면 남은 6일을 앱 안에서 더 안정적으로 돌릴 수 있어요.'
  }
  if (dueReview > 0) return '오늘은 새 문제보다 오답 복습을 먼저 처리하는 게 좋습니다.'
  if (dueVocabulary > 0) return '오답이 가볍다면 단어 복습을 먼저 끝내고 실전 세트로 넘어가세요.'
  return '대기 복습이 적습니다. 실전 모드로 시간을 재며 감각을 유지하세요.'
}

export function DashboardPage({
  questions,
  sessions,
  vocabularySummary,
  onNavigate,
}: DashboardPageProps) {
  const stats = getQuestionStats(questions, sessions)
  const todayTouchedQuestions = questions.filter((question) => isToday(question.lastAnsweredAt))
    .length
  const todaySessions = sessions.filter((session) => isToday(session.endedAt))
  const todaySessionQuestions = todaySessions.reduce(
    (sum, session) => sum + session.questionCount,
    0,
  )
  const todaySolvedCount = Math.max(todayTouchedQuestions, todaySessionQuestions)
  const dueReview = questions.filter((question) => isReviewDue(question)).length
  const waitingReview = questions.filter((question) => question.needsReview && !isReviewDue(question))
    .length
  const weakQuestions = questions.filter((question) => question.isMistake).length
  const questionBankPercent = getPercent(questions.length, MIN_QUESTION_BANK_TARGET)
  const todayQuestionPercent = getPercent(todaySolvedCount, DAILY_QUESTION_TARGET)
  const reviewPercent = getPercent(
    Math.max(0, DAILY_REVIEW_TARGET - dueReview),
    DAILY_REVIEW_TARGET,
  )
  const vocabPercent = getPercent(
    Math.max(0, DAILY_VOCAB_TARGET - vocabularySummary.dueCount),
    DAILY_VOCAB_TARGET,
  )
  const message = getDashboardMessage({
    dueReview,
    dueVocabulary: vocabularySummary.dueCount,
    questionCount: questions.length,
  })
  const slowQuestions = stats.slowQuestions.slice(0, 3)

  return (
    <section className="page-section dashboard-page">
      <div className="dashboard-hero panel">
        <div>
          <span className="eyebrow">TODAY</span>
          <h2>6일 집중 대시보드</h2>
          <p>{message}</p>
        </div>
        <div className="dashboard-hero-actions">
          <button className="button primary" type="button" onClick={() => onNavigate('solve')}>
            문제 풀기
          </button>
          <button className="button ghost" type="button" onClick={() => onNavigate('review')}>
            오답 복습
          </button>
        </div>
      </div>

      <div className="dashboard-goals">
        <article className="goal-card panel">
          <div className="goal-card__head">
            <span>오늘 풀이</span>
            <strong>
              {todaySolvedCount}/{DAILY_QUESTION_TARGET}
            </strong>
          </div>
          <div className="goal-progress" aria-hidden="true">
            <span style={{ width: `${todayQuestionPercent}%` }} />
          </div>
          <p>오늘 마지막으로 답을 저장한 문제와 실전 세트 기록 기준입니다.</p>
          <button className="button ghost small" type="button" onClick={() => onNavigate('solve')}>
            이어 풀기
          </button>
        </article>

        <article className="goal-card panel">
          <div className="goal-card__head">
            <span>오답 복습</span>
            <strong>{dueReview}</strong>
          </div>
          <div className="goal-progress warning" aria-hidden="true">
            <span style={{ width: `${reviewPercent}%` }} />
          </div>
          <p>대기 {waitingReview}문제 · 오늘 복습 대기 문제를 먼저 줄이세요.</p>
          <button className="button ghost small" type="button" onClick={() => onNavigate('review')}>
            복습하기
          </button>
        </article>

        <article className="goal-card panel">
          <div className="goal-card__head">
            <span>단어 복습</span>
            <strong>{vocabularySummary.dueCount}</strong>
          </div>
          <div className="goal-progress success" aria-hidden="true">
            <span style={{ width: `${vocabPercent}%` }} />
          </div>
          <p>새 단어 {vocabularySummary.newCount}개 · 취약 {vocabularySummary.weakCount}개</p>
          <button className="button ghost small" type="button" onClick={() => onNavigate('vocab')}>
            단어하기
          </button>
        </article>

        <article className="goal-card panel">
          <div className="goal-card__head">
            <span>문제 은행</span>
            <strong>
              {questions.length}/{MIN_QUESTION_BANK_TARGET}
            </strong>
          </div>
          <div className="goal-progress" aria-hidden="true">
            <span style={{ width: `${questionBankPercent}%` }} />
          </div>
          <p>6일 동안 이 앱만 쓰려면 최소 300문제 이상을 추천합니다.</p>
          <button className="button ghost small" type="button" onClick={() => onNavigate('list')}>
            문제 관리
          </button>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="panel dashboard-panel">
          <div className="card-title-row">
            <h3>오늘 우선순위</h3>
            <span>위에서부터 처리</span>
          </div>
          <div className="priority-list">
            <button type="button" onClick={() => onNavigate('review')}>
              <strong>1. 오답 복습</strong>
              <span>{dueReview > 0 ? `${dueReview}문제 대기` : '대기 오답 없음'}</span>
            </button>
            <button type="button" onClick={() => onNavigate('vocab')}>
              <strong>2. 단어 회전</strong>
              <span>
                복습 {vocabularySummary.dueCount}개 · 새 단어 {vocabularySummary.newCount}개
              </span>
            </button>
            <button type="button" onClick={() => onNavigate('solve')}>
              <strong>3. 실전 세트</strong>
              <span>
                최근 실전 정답률 {stats.recentSessionAccuracy}% · 평균{' '}
                {formatDuration(stats.averageSessionDuration)}
              </span>
            </button>
          </div>
        </article>

        <article className="panel dashboard-panel">
          <div className="card-title-row">
            <h3>속도 체크</h3>
            <span>시간 약점</span>
          </div>
          <div className="speed-summary">
            <div>
              <span>평균 풀이 시간</span>
              <strong>{formatDuration(stats.averageSolveTimeMs)}</strong>
              <small>{stats.timedAttemptCount}회 기록 기준</small>
            </div>
            <div>
              <span>누적 오답</span>
              <strong>{weakQuestions}</strong>
              <small>오답 표시된 문항</small>
            </div>
          </div>
          {slowQuestions.length === 0 ? (
            <p className="muted-text">문제를 풀면 오래 걸린 문항이 여기에 표시됩니다.</p>
          ) : (
            <div className="slow-question-list">
              {slowQuestions.map((item) => (
                <span key={item.label}>
                  <b>{formatDuration(item.value)}</b>
                  {item.label}
                </span>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  )
}

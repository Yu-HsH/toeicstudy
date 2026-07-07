import { EmptyState } from '../components/EmptyState'
import type { Question, StudySession } from '../types'
import { getQuestionStats } from '../utils/stats'
import { formatDuration } from '../utils/time'

interface StatsPageProps {
  questions: Question[]
  sessions: StudySession[]
}

function BarList({
  items,
  emptyText,
  formatValue = (value: number) => String(value),
}: {
  items: { label: string; value: number }[]
  emptyText: string
  formatValue?: (value: number) => string
}) {
  const max = Math.max(...items.map((item) => item.value), 1)
  const visibleItems = items.filter((item) => item.value > 0)
  if (visibleItems.length === 0) return <p className="muted-text">{emptyText}</p>
  return (
    <div className="bar-list">
      {visibleItems.map((item) => (
        <div className="bar-item" key={item.label}>
          <span className="bar-label">{item.label}</span>
          <span className="bar-track">
            <span style={{ width: `${Math.max((item.value / max) * 100, 8)}%` }} />
          </span>
          <strong>{formatValue(item.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export function StatsPage({ questions, sessions }: StatsPageProps) {
  const stats = getQuestionStats(questions, sessions)

  return (
    <section className="page-section">
      <div className="section-heading">
        <span className="eyebrow">PROGRESS</span>
        <h2>학습 통계</h2>
        <p>문제 수보다 반복해서 약점을 줄이는 흐름에 집중해 보세요.</p>
      </div>

      {questions.length === 0 ? (
        <EmptyState
          icon="▥"
          title="아직 집계할 데이터가 없어요"
          description="문제를 등록하고 한 번 풀면 정답률과 오답 분포가 표시됩니다."
        />
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <span>전체 문제</span>
              <strong>{stats.total}</strong>
              <small>저장된 문항</small>
            </div>
            <div className="stat-card accent">
              <span>정답률</span>
              <strong>{stats.accuracy}%</strong>
              <small>총 {stats.attemptCount}회 풀이 기준</small>
            </div>
            <div className="stat-card">
              <span>첫 풀이 정답률</span>
              <strong>{stats.firstAccuracy}%</strong>
              <small>처음 고른 답 기준</small>
            </div>
            <div className="stat-card">
              <span>오늘 복습</span>
              <strong>{stats.dueReview}</strong>
              <small>대기 {stats.waitingReview}문제</small>
            </div>
            <div className="stat-card">
              <span>복습 성공률</span>
              <strong>{stats.reviewAccuracy}%</strong>
              <small>복습 {stats.reviewAttemptCount}회 기준</small>
            </div>
            <div className="stat-card">
              <span>평균 풀이 시간</span>
              <strong>{formatDuration(stats.averageSolveTimeMs)}</strong>
              <small>시간 기록 {stats.timedAttemptCount}회 기준</small>
            </div>
            <div className="stat-card">
              <span>최근 실전</span>
              <strong>{stats.recentSessionAccuracy}%</strong>
              <small>최근 7일 세트 기준</small>
            </div>
            <div className="stat-card">
              <span>최근 등록</span>
              <strong>{stats.recent}</strong>
              <small>최근 7일</small>
            </div>
          </div>

          <div className="chart-grid">
            <div className="panel chart-card">
              <div className="card-title-row">
                <h3>파트별 오답 수</h3>
                <span>누적 오답 문항</span>
              </div>
              <BarList items={stats.partMistakes} emptyText="아직 틀린 문제가 없습니다." />
            </div>
            <div className="panel chart-card">
              <div className="card-title-row">
                <h3>틀린 이유별 오답 수</h3>
                <span>최근 선택 사유</span>
              </div>
              <BarList
                items={stats.reasonMistakes}
                emptyText="오답의 틀린 이유를 선택하면 표시됩니다."
              />
            </div>
            <div className="panel chart-card">
              <div className="card-title-row">
                <h3>태그별 약점</h3>
                <span>누적 오답 태그</span>
              </div>
              <BarList items={stats.tagMistakes} emptyText="오답 태그가 아직 없습니다." />
            </div>
            <div className="panel chart-card">
              <div className="card-title-row">
                <h3>시간 오래 걸린 문제</h3>
                <span>평균 풀이 시간</span>
              </div>
              <BarList
                items={stats.slowQuestions}
                emptyText="아직 시간 기록이 없습니다."
                formatValue={formatDuration}
              />
            </div>
            <div className="panel chart-card">
              <div className="card-title-row">
                <h3>최근 실전 기록</h3>
                <span>평균 {formatDuration(stats.averageSessionDuration)}</span>
              </div>
              {stats.latestSessions.length === 0 ? (
                <p className="muted-text">아직 저장된 실전 세트가 없습니다.</p>
              ) : (
                <div className="session-list">
                  {stats.latestSessions.map((session) => (
                    <div className="session-row" key={session.id}>
                      <span>
                        {session.part === 'all' ? '전체' : session.part} ·{' '}
                        {new Intl.DateTimeFormat('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                        }).format(new Date(session.endedAt))}
                      </span>
                      <strong>
                        {session.correctCount}/{session.questionCount}
                      </strong>
                      <small>{formatDuration(session.durationMs)}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

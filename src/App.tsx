import { useEffect, useMemo, useState } from 'react'
import { createSampleQuestions } from './data/sampleQuestions'
import { ListPage } from './pages/ListPage'
import { RegisterPage } from './pages/RegisterPage'
import { SolvePage } from './pages/SolvePage'
import { StatsPage } from './pages/StatsPage'
import { draftToQuestion, loadQuestions, recordAnswer, saveQuestions } from './storage'
import type {
  ChoiceKey,
  MistakeReason,
  Question,
  QuestionDraft,
  TabId,
} from './types'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'solve', label: '문제 풀기', icon: '▶' },
  { id: 'register', label: '문제 등록', icon: '＋' },
  { id: 'review', label: '오답 복습', icon: '↻' },
  { id: 'stats', label: '통계', icon: '▥' },
  { id: 'list', label: '문제 목록', icon: '☷' },
]

function App() {
  const [questions, setQuestions] = useState<Question[]>(loadQuestions)
  const [activeTab, setActiveTab] = useState<TabId>('solve')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    saveQuestions(questions)
  }, [questions])

  const mistakeCount = useMemo(
    () => questions.filter((question) => question.isMistake).length,
    [questions],
  )

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2200)
  }

  const addQuestion = (draft: QuestionDraft) => {
    setQuestions((current) => [draftToQuestion(draft), ...current])
    showNotice('문제를 저장했습니다.')
  }

  const addSamples = () => {
    const samples = createSampleQuestions()
    setQuestions((current) => {
      const existingTexts = new Set(current.map((question) => question.questionText))
      const fresh = samples.filter((sample) => !existingTexts.has(sample.questionText))
      if (fresh.length === 0) {
        showNotice('샘플 문제는 이미 들어 있어요.')
        return current
      }
      showNotice(`샘플 ${fresh.length}문제를 추가했습니다.`)
      return [...fresh, ...current]
    })
  }

  const answerQuestion = (
    id: string,
    answer: ChoiceKey,
    reason: MistakeReason | undefined,
    isReview: boolean,
  ) => {
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? recordAnswer(question, answer, reason, isReview) : question,
      ),
    )
  }

  const deleteQuestion = (id: string) => {
    if (!window.confirm('이 문제를 삭제할까요? 삭제 후 복구할 수 없습니다.')) return
    setQuestions((current) => current.filter((question) => question.id !== id))
    showNotice('문제를 삭제했습니다.')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <span className="brand-mark">T</span>
          <div>
            <strong>TOEIC 한 달 노트</strong>
            <span>내가 만든 문제로, 짧고 꾸준하게</span>
          </div>
        </div>
        <div className="header-summary" aria-label="저장 현황">
          <span>
            전체 <strong>{questions.length}</strong>
          </span>
          <span>
            오답 <strong>{mistakeCount}</strong>
          </span>
        </div>
      </header>

      <nav className="tab-nav" aria-label="주요 메뉴">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'active' : ''}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={() => setActiveTab(tab.id)}
          >
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
            {tab.id === 'review' && mistakeCount > 0 && (
              <small className="nav-count">{mistakeCount}</small>
            )}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {activeTab === 'solve' && (
          <SolvePage
            questions={questions}
            onAnswer={answerQuestion}
            onGoRegister={() => setActiveTab('register')}
          />
        )}
        {activeTab === 'register' && (
          <RegisterPage onAdd={addQuestion} onAddSamples={addSamples} />
        )}
        {activeTab === 'review' && (
          <SolvePage
            questions={questions}
            isReview
            onAnswer={answerQuestion}
            onGoRegister={() => setActiveTab('register')}
          />
        )}
        {activeTab === 'stats' && <StatsPage questions={questions} />}
        {activeTab === 'list' && (
          <ListPage questions={questions} onDelete={deleteQuestion} />
        )}
      </main>

      <footer className="app-footer">
        데이터는 이 브라우저의 localStorage에만 저장됩니다.
      </footer>

      <div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">
        {notice}
      </div>
    </div>
  )
}

export default App

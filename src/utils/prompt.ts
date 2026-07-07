import type { Question } from '../types'
import { formatDuration, getQuestionAverageSolveTimeMs } from './time'

export function createAnalysisPrompt(question: Question): string {
  const averageSolveTimeMs = getQuestionAverageSolveTimeMs(question)
  const choices = Object.entries(question.choices)
    .map(([key, value]) => `${key}. ${value}`)
    .join('\n')

  return `아래 TOEIC 학습용 문제의 오답을 분석해 주세요.

[문제 정보]
- 파트: ${question.part}
- 세트 ID: ${question.groupId ?? '없음'}
- 문항 번호: ${question.questionNumber ?? '없음'}
- 지문: ${question.passage ?? '없음'}
- 문제: ${question.questionText}
- 선택지:
${choices}
- 정답: ${question.correctAnswer}
- 내가 고른 답: ${question.myAnswer ?? '아직 선택하지 않음'}
- 내가 기록한 해설: ${question.explanation || '없음'}
- 틀린 이유: ${question.mistakeReason ?? '미분류'}
- 태그: ${question.tags.join(', ') || '없음'}
- 최근 풀이 시간: ${
    question.lastSolveTimeMs === undefined ? '기록 없음' : formatDuration(question.lastSolveTimeMs)
  }
- 평균 풀이 시간: ${
    averageSolveTimeMs === undefined ? '기록 없음' : formatDuration(averageSolveTimeMs)
  }

[분석 요청]
1. 왜 정답이 맞는지 핵심 근거를 설명해 주세요.
2. 왜 내가 고른 답이 틀렸는지 정답과 비교해 설명해 주세요.
3. 이 문제의 유형을 분류해 주세요.
4. 같은 유형을 다시 볼 때 가장 먼저 확인할 포인트를 알려 주세요.
5. Anki 카드에 넣을 한 줄 요약을 만들어 주세요.

답변은 한국어로, 짧고 실전적으로 작성해 주세요.`
}

export async function copyAnalysisPrompt(question: Question): Promise<void> {
  const prompt = createAnalysisPrompt(question)
  try {
    await navigator.clipboard.writeText(prompt)
    return
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = prompt
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    if (!copied) throw new Error('Clipboard copy failed')
  }
}

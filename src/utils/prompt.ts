import type { Question } from '../types'

export function createAnalysisPrompt(question: Question): string {
  const choices = Object.entries(question.choices)
    .map(([key, value]) => `${key}. ${value}`)
    .join('\n')

  return `아래 TOEIC 학습용 문제의 오답을 분석해 주세요.

[문제 정보]
- 파트: ${question.part}
- 문제: ${question.questionText}
- 선택지:
${choices}
- 정답: ${question.correctAnswer}
- 내가 고른 답: ${question.myAnswer ?? '아직 선택하지 않음'}
- 내가 기록한 해설: ${question.explanation || '없음'}
- 틀린 이유: ${question.mistakeReason ?? '미분류'}
- 태그: ${question.tags.join(', ') || '없음'}

[분석 요청]
1. 왜 정답이 맞는지 핵심 근거를 설명해 주세요.
2. 왜 내가 고른 답이 틀렸는지 정답과 비교해 설명해 주세요.
3. 이 문제의 유형을 분류해 주세요.
4. 같은 유형을 다시 볼 때 가장 먼저 확인할 포인트를 알려 주세요.
5. Anki 카드에 넣을 한 줄 요약을 만들어 주세요.

답변은 한국어로, 짧고 실전적으로 작성해 주세요.`
}

export async function copyAnalysisPrompt(question: Question): Promise<void> {
  await navigator.clipboard.writeText(createAnalysisPrompt(question))
}

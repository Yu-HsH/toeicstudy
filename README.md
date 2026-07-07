# TOEIC 한 달 노트

## 배포 주소

- https://yu-hsh.github.io/toeicstudy/

SSAFY와 병행하며 한 달 동안 직접 입력한 TOEIC 문제와 오답을 빠르게 관리하는 로컬 웹앱입니다. 로그인, 백엔드, 외부 데이터베이스 없이 브라우저의 `localStorage`만 사용합니다.

> 문제 저작권을 보호하기 위해 실제 기출문제를 포함하지 않습니다. 사용자가 학습할 문제를 직접 입력하는 구조이며, 포함된 샘플 3문항도 이 앱을 위해 새로 만든 예시입니다.

## 주요 기능

- 오늘 풀이/오답/단어/문제 은행 상태를 한눈에 보는 대시보드
- Part 5~7 문제 등록 및 A/B/C/D 선택지, 해설, 태그, 틀린 이유 기록
- 전체 문제 풀이와 즉시 정답 확인
- 문제별 최근/평균/최단/최장 풀이 시간 기록
- 누적 오답만 다시 푸는 복습 모드 및 복습 정답 횟수 기록
- 파트·오답 여부·틀린 이유·검색어 기반 문제 필터
- 전체 문항, 누적 풀이 정답률, 최근 7일 등록 수, 오답 분포 통계
- 문제별 ChatGPT 오답 분석 프롬프트 복사
- UTF-8 CSV 가져오기·내보내기
- 모바일과 데스크톱에 대응하는 반응형 UI

## 실행 방법

Node.js 20 이상을 권장합니다.

```bash
npm install
npm run dev
```

터미널에 표시되는 주소(기본값 `http://localhost:5173`)를 브라우저에서 엽니다.

프로덕션 빌드를 확인하려면 다음을 실행합니다.

```bash
npm run build
npm run preview
```

## 사용 방법

1. **오늘** 탭에서 오늘 풀 문제 수, 오답 복습 수, 단어 복습 수를 먼저 확인합니다.
2. **문제 등록** 탭에서 문제, 네 선택지, 정답을 입력합니다. 이미 풀었던 문제라면 내 답과 틀린 이유도 함께 기록할 수 있습니다.
3. 처음 둘러볼 때는 **샘플 3문제 추가**를 눌러 저작권 문제가 없는 예시 데이터를 넣을 수 있습니다. 같은 샘플은 중복 추가되지 않습니다.
4. **문제 풀기**에서 답을 누르면 정답과 해설이 표시됩니다. 틀렸다면 이유를 선택해야 결과를 저장할 수 있습니다.
5. **오답 복습**에서 누적 오답만 다시 풉니다. 다시 맞힐 때마다 해당 문제의 `reviewedCount`가 증가합니다.
6. **통계**에서 누적 풀이 기준 정답률과 오답 분포를 확인합니다.
7. **문제 목록**에서 상세 내용을 보고, **분석 프롬프트 복사**로 ChatGPT에 붙여넣을 문장을 만듭니다.

## CSV 백업과 복원

**문제 목록** 탭의 **CSV 내보내기**를 누르면 모든 문제가 내려받아집니다. 다른 브라우저나 초기화된 환경에서는 **CSV 가져오기**로 복원할 수 있습니다.

CSV 헤더는 다음 순서를 사용합니다.

```text
part,questionText,choiceA,choiceB,choiceC,choiceD,correctAnswer,myAnswer,explanation,tags,mistakeReason,passage,groupId,questionNumber,timedAttemptCount,totalSolveTimeMs,lastSolveTimeMs,fastestSolveTimeMs,slowestSolveTimeMs
```

- `part`: `Part 5` ~ `Part 7`
- `correctAnswer`, `myAnswer`: `A`, `B`, `C`, `D` (`myAnswer`는 빈 값 가능)
- `tags`: 여러 태그를 `|`로 구분
- `mistakeReason`: 단어, 품사, 문법, 전치사/접속사, 해석, 시간부족, 기타
- `timedAttemptCount`, `totalSolveTimeMs`, `lastSolveTimeMs`, `fastestSolveTimeMs`, `slowestSolveTimeMs`: 풀이 시간 백업용 선택 필드입니다.
- 필수 값이나 형식이 잘못된 행은 가져오기에서 건너뜁니다.

CSV에는 문제 내용과 학습 메모가 포함되므로 개인용으로 보관하세요. CSV가 보존하는 필드는 요구된 교환 필드와 풀이 시간 백업 필드이며, 정답/오답 누적 횟수는 새 브라우저에서 다시 시작됩니다.

## 데이터 저장과 초기화

데이터는 현재 브라우저 프로필의 아래 localStorage 키에 저장됩니다.

```text
toeic-month-note.questions.v1
```

서버로 전송되지 않지만 브라우저 사이트 데이터 삭제, 시크릿 창 종료, 다른 브라우저 사용 시에는 데이터가 유지되지 않을 수 있습니다. 중요한 기록은 CSV로 주기적으로 백업하세요.

## 프로젝트 구조

```text
src/
├─ components/          공용 상태·문제 상세 UI
├─ data/                직접 만든 샘플 3문항
├─ pages/               풀이, 등록, 복습, 통계, 목록 화면
├─ utils/               CSV, 통계, 분석 프롬프트
├─ App.tsx              탭 전환과 전역 문제 상태
├─ storage.ts           localStorage 읽기·쓰기와 풀이 기록
├─ types.ts             명시적 TypeScript 도메인 타입
└─ styles.css           반응형 대시보드 스타일
```

## 기술 스택

- React 19
- Vite 6
- TypeScript 5.8 (`strict`)
- 브라우저 localStorage, Clipboard API, File API

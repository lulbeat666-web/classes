# Creative Class AI

초등 교사가 교과서 학습을 마친 뒤 학습목표를 연습할 활동 3개를 고르는 웹앱입니다. 활동마다 어떤 학습 행동을 연습하는지, 수업 중 몇 분을 쓰는지, 교사가 어떤 말로 안내하는지 확인하고 복사할 수 있습니다.

## MVP 범위

| 포함 | 후속 범위 |
| --- | --- |
| 학년·교과, 필수 학습목표, 선택 교과서 내용 | 분위기·이동·경쟁·소음·기기별 고급 필터 |
| 활동 시간 10~60분, 정확한 시간·최대 시간, 준비 시간과 준비물, 학급 인원 | 활동별 재생성과 맞춤 변형 |
| 놀이 메커니즘 최대 4개 선택 또는 자동 조합, 브라우저 설정 저장과 초기화 | Gemini·Claude 및 복수 모델 선택 |
| OpenAI 구조화 응답, 검증된 추천 3개, 상세 보기와 복사 | 계정, 데이터베이스, 수업안·학습지·PPT 생성 |
| 키 없이 확인 가능한 분수 나눗셈 예시 | 교과서 이미지 업로드·OCR |

기술 스택은 Vite, React, TypeScript strict, Tailwind CSS의 공식 Vite 플러그인, Lucide React, Zod, Cloudflare Pages Functions입니다. OpenAI에는 Responses API와 Structured Outputs를 사용합니다. [OpenAI 구조화 출력 문서](https://developers.openai.com/api/docs/guides/structured-outputs)

## 설치와 실행

Node.js `22.12.0` 이상과 npm이 필요합니다. 처음 설치할 때는 저장소를 복제하고 프로젝트 루트에서 실행합니다.

```sh
git clone https://github.com/lulbeat666-web/classes.git
cd classes
npm ci
npm run build
npm run dev:pages
```

터미널에 `Ready on http://localhost:8788`이 표시되면 Wrangler를 실행한 컴퓨터의 브라우저에서 해당 주소를 엽니다. 터미널을 계속 실행해 두세요. Codex Cloud에서 서버를 시작한 경우에는 Codex의 공유 데스크톱에서 접속할 수 있습니다. 다른 컴퓨터에서 사용하려면 아래 Cloudflare Pages 배포 절차를 따릅니다. Wrangler가 빌드 결과와 `/api/*`의 Pages Functions를 함께 실행합니다. 예시 불러오기로 분수 나눗셈 조건을 입력한 후 활동을 생성하면 서버에 포함된 고정 예시 3개를 볼 수 있습니다. 예시 내용에 조건을 변경한 요청은 실제 생성 설정이 필요합니다. [Cloudflare Pages 로컬 개발 문서](https://developers.cloudflare.com/pages/functions/local-development/)

프런트엔드를 편집할 때는 Wrangler를 유지한 상태로 다른 터미널에서 `npm run dev`를 실행합니다. Vite 주소는 기본 `http://localhost:5173`이며 `/api` 호출을 Wrangler의 `8788` 포트로 전달합니다.

읽기 전용 사용자 설정 디렉터리 때문에 Wrangler 시작이 실패하는 Linux 개발 환경에서는 쓰기 가능한 설정 디렉터리를 지정해 실행할 수 있습니다.

```sh
mkdir -p .wrangler/config
XDG_CONFIG_HOME="$PWD/.wrangler/config" npm run dev:pages
```

## 로컬에서 OpenAI 활성화

1. `cp .dev.vars.example .dev.vars`를 실행합니다.
2. `.dev.vars`에서 `ENABLE_LIVE_GENERATION=true`를 설정하고 `OPENAI_API_KEY`에 프로젝트 API 키를 입력합니다.
3. Wrangler를 다시 시작하고 `http://localhost:8788`에서 학습목표를 입력한 후 생성합니다.

모델은 `gpt-4.1-mini-2025-04-14`를 사용합니다. 키는 서버가 읽는 `.dev.vars` 또는 Pages Secret에만 보관합니다. [OpenAI 모델 문서](https://developers.openai.com/api/docs/models/gpt-4.1-mini) [Cloudflare Secret 문서](https://developers.cloudflare.com/pages/functions/bindings/#secrets)

## 9번 요구사항과 서버 검증

- `GET /api/providers`에서 실시간 생성 가능 여부와 허용 모델 목록을 반환합니다.
- `POST /api/generate-activities`는 `lesson`, `mode`, 선택 `model`을 받습니다. 성공 응답에는 활동 `activities` 3개와 실제 사용 모드가 들어갑니다. 실패 응답의 `error.code`와 `error.message`를 화면에서 처리합니다.
- 생성 프롬프트는 필수 학습 행동을 먼저 정하고, 6~8개 후보의 학습 적합성·독창성·실행 가능성을 비교한 뒤, 겹치는 후보를 제외하고 3개를 반환하도록 지시합니다.
- 공통 Zod 스키마가 활동의 제목과 소개, 목표와 필수 학습 행동, 놀이 메커니즘, 소요 시간, 준비물, 모둠 구성, 진행 단계, 안내 멘트, 안전, 예상 문제와 대응, 1~5점 품질 평가를 검증합니다. 서버는 활동 개수, 중복, 단계 순서, 시간 합계, 허용 준비물과 사전 준비 시간도 검사합니다.
- 잘못된 AI 응답에는 검증 정보를 포함해 한 번 수정 요청을 보냅니다. 수정 응답도 검증에 실패하면 한국어 오류와 재시도 경로를 제공합니다. 제공자 오류와 타임아웃은 별도로 처리합니다.
- 생성 요청의 본문 한도는 16 KiB입니다. OpenAI 호출에는 호출당 응답 시간과 출력 길이 제한을 적용합니다.
- 활동의 품질 점수는 AI의 휴리스틱 평가입니다. 수업 운영의 적합성은 활동 세부 내용과 학급 상황을 함께 보고 판단합니다.

## Cloudflare Pages에 배포

1. GitHub에 프로젝트 소스를 올립니다. `functions/`와 `wrangler.jsonc`를 프로젝트 루트에 포함합니다.
2. Cloudflare에서 **Workers & Pages**로 이동해 Pages Git 연동 프로젝트를 만들고 저장소를 연결합니다.
3. 프로젝트 경로를 루트 디렉터리로 설정합니다. 빌드 명령은 `npm run build`, 빌드 출력 디렉터리는 `dist`입니다. 빌드 환경도 위 Node.js 버전 조건을 충족해야 합니다. [Cloudflare의 React 배포 문서](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/) [Pages Git 연동 문서](https://developers.cloudflare.com/pages/get-started/git-integration/)
4. 예시 배포에는 환경변수 설정이 필요 없습니다. 실제 생성에 사용할 도메인을 Cloudflare Access의 자체 호스팅 애플리케이션으로 보호하고 교사에게만 접근을 허용합니다.
5. Pages 프로젝트의 **Settings → Variables and Secrets**에서 운영 환경에 아래 값을 등록하고 재배포합니다. Pages Function은 배포 도메인의 요청에서 Access가 전달한 `Cf-Access-Jwt-Assertion`의 서명, 발급자, 대상 값을 검증한 뒤 OpenAI를 호출합니다. [Cloudflare Access JWT 검증 문서](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

| 이름 | 운영 설정 |
| --- | --- |
| `OPENAI_API_KEY` | 암호화된 Secret |
| `ENABLE_LIVE_GENERATION` | 실제 생성 사용 시 `true` |
| `LIVE_ACCESS_TEAM_DOMAIN` | `https://<팀 이름>.cloudflareaccess.com` |
| `LIVE_ACCESS_AUDIENCE` | Cloudflare Access 애플리케이션의 AUD 태그 |

## 테스트

```sh
npm run typecheck
npm run build
npm test
npm run test:pages
```

`npm test`는 모의 OpenAI 요청으로 인증 헤더와 구조화 응답 설정, 3개 활동의 런타임 검증, 검증 실패 후 수정, 요청 제한, 제공자 오류와 타임아웃 처리를 검사합니다. 서명된 테스트 토큰으로 운영 Access 검증도 확인합니다. `npm run test:pages`는 별도 임시 디렉터리에서 Wrangler Pages를 키 없이 실행하여 정적 페이지와 두 API의 라우팅, 예시 결과, 잘못된 입력 및 키 미설정 오류를 확인합니다.

실제 제공자는 키를 설정한 상태에서 5학년 수학의 분수 나눗셈 예시를 사용해 점검할 수 있습니다. 아래 명령은 Wrangler로 직접 요청을 보내고 응답의 활동 이름과 소요 시간을 표시합니다.

```sh
node --import tsx --input-type=module <<'JS'
import { demoLesson } from './src/shared/demo-lesson.ts';

const response = await fetch('http://localhost:8788/api/generate-activities', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode: 'openai', lesson: demoLesson }),
});
const data = await response.json();
if (!response.ok) throw new Error(data.error?.message ?? `HTTP ${response.status}`);
if (data.mode !== 'openai' || data.activities?.length !== 3) throw new Error('응답 검증 실패');
for (const activity of data.activities) {
  console.log(`${activity.title} (${activity.durationMinutes}분)`);
}
JS
```

## 프로젝트 구조

```text
src/              React 화면, 스타일, 브라우저 설정 저장
src/shared/       입력·활동 스키마, 놀이 메커니즘, 공통 예시 입력
functions/api/    Cloudflare Pages의 제공자 조회·활동 생성 엔드포인트
functions/lib/    프롬프트, OpenAI 호출, 접근 제어, 검증, 고정 예시
public/           정적 이미지
tests/           모의 API 테스트와 Wrangler Pages 통합 테스트
wrangler.jsonc    Pages 설정
.dev.vars.example 로컬 환경변수 예시
```

## 사용상 제한

브라우저에는 활동 조건을 저장하고, 학습목표와 교과서 본문은 현재 화면에서 관리합니다. 예시 모드는 분수 나눗셈 입력에 고정된 결과를 제공합니다. 실제 생성 결과의 시간과 준비물 검사는 응답에 적힌 단계와 준비물 목록을 기준으로 수행됩니다.

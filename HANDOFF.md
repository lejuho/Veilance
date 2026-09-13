# Veilance handoff (2026-09-13)

작업자 교대용 요약. 다음 사람은 이 문서와 `README.md`만 읽고 시작할 수 있어야 합니다.
새 작업을 마칠 때마다 아래 "현재 상태"와 "다음 할 일"을 갱신하고 커밋합니다.

## 1. 한 줄 요약

주호님이 커밋 `9324bf2`로 **진짜 `agent/`, `agent/API.md`, `CONTRACT_DESIGN.md`, `ERD.md`,
`CODEBASE_MAP.md`**를, DM으로 **`VEILANCE_FUNDER_SEED`와 `veilance-preprod-state.tgz`**(Preprod
배포 상태 전체: `.env.preprod`, 네 참여자의 지갑·private state·`deployment.json`)를 주셨습니다.
이전에 요청했던 것 전부 해결됐습니다. `agent/`에 압축을 풀어뒀고(`.gitignore`로 커밋 안 되는 것
확인 완료), **Preprod 컨트랙트는 이미 배포·검증까지 끝난 상태**입니다(2절). 다음 마일스톤도
주호님께 직접 받았습니다(4절). 남은 유일한 블로커는 이 PC의 WSL2/Docker 설치이며(6절), 이건
코드 작업(다음 마일스톤 1번, 기업별 agent 분리)과는 무관하게 지금 진행할 수 있습니다.

## 2. 레포에 있는 것 / 없는 것

| 항목 | 상태 | 위치 |
| --- | --- | --- |
| Compact 컨트랙트 + witness + sealed-entry | 있음 | `contract/src/` |
| 시뮬레이터 테스트 (27개) | 있음, 실행에 Compact CLI 필요 | `contract/test/` |
| devnet/Preprod E2E 스크립트 | 있음 | `contract/e2e/` |
| 웹 UI (React/Vite) | 있음, typecheck·build 통과 | `web/` |
| 기업별 그래프 범위 + 테스트 | 있음 | `shared/` |
| **Party Agent (HTTP 백엔드)** | **있음 (주호님, 커밋 9324bf2)** | `agent/` — `README.md`, `API.md` |
| 설계 문서 CONTRACT_DESIGN/ERD/CODEBASE_MAP | **있음 (주호님, 커밋 9324bf2)** | 루트 |
| 팀 목표 문서 (spec, 1~15절 전체) | 있음 | `docs/spec.md` |
| Compact 컴파일 산출물, 증명 키 | 없음 (gitignore, 로컬 빌드 필요) | `contract/src/managed/` |
| `agent/node_modules` | 로컬에서 매번 직접 만들어야 함 (git에 없음) | `contract/node_modules`의 심볼릭 링크 |
| **Preprod 지갑 시드 + 배포 상태** | **있음 (DM으로 받아 로컬에 풀어둠, 커밋 안 됨)** | `agent/.env.preprod`, `agent/.state/preprod/` |

Preprod 배포 정보 (커밋 da18af3 메시지 기준):
- 컨트랙트 주소 `aef192434994a76b50fde29683420943c4b04c7cd03caa2c0cf67138d9aa2348`
- 배포 tx `aceb3153…c08f`, 블록 2484901
- 탐색기 `https://preprod.midnightexplorer.com/contracts/{address}`
- **2026-09-13: 지갑 시드와 전체 `.state/preprod`를 DM으로 받아 `agent/`에 풀어뒀습니다.**
  `agent/.env.preprod`, `agent/.state/preprod/{admin,mine,refiner,batteryMfr,wallets}/`가 모두
  있어 이 배포에 admin 권한으로 바로 재접속할 수 있습니다. 둘 다 `agent/.gitignore`(`.env*`,
  `.state/`)로 커밋되지 않습니다 — 실수로 올라가지 않았는지 커밋 전에 항상 `git status`로 확인.
- 주호님 확인: **이 배포는 이미 웹 UI에서 발행 → 전달 → 증명 → 재사용 거부까지 실제 증명으로
  검증 완료된 상태**입니다(2026-09-10). 처음부터 다시 재현할 필요는 없습니다.

## 3. `agent/`를 처음 열어보는 사람에게

- **`npm install`을 하지 마세요.** `agent/node_modules`는 `contract/node_modules`의 심볼릭
  링크입니다 (WASM 런타임 클래스가 두 곳에 따로 설치되면 `expected instance of StateValue` 오류가
  납니다). 최초 1회 직접 만듭니다: `ln -s "$(pwd)/contract/node_modules" agent/node_modules`
  (Windows에서도 관리자 권한 없이 됐습니다, git-bash 기준).
- 실행: `cd agent && npm run dev` (또는 `npm start`). `GET /health`가 즉시 `ready:false`로
  응답하고 부팅이 끝나면 `true`가 됩니다.
- 계약은 자동 배포되지 않습니다. `POST /deploy`를 직접 호출해야 하고(기존 배포가
  `.state/deployment.json`에 있으면 그걸 재사용), 로컬 devnet에서 정책까지 한 번에 등록하려면
  `POST /admin/bootstrap`을 부릅니다.
- Preprod로 붙으려면: `cd agent && set -a && . ./.env.preprod && set +a` 후 실행. 로컬 proof
  server(Docker, `127.0.0.1:6300`)는 이 경우에도 필요합니다 — node/indexer만 Preprod의 공개
  엔드포인트를 쓰고, 증명 서버는 항상 로컬에서 돕니다.
- 웹 UI 요구 API(health/parties/ledger/jobs/admin/parties/verify/graph/explorer)를 이 agent가
  전부 구현하고 있습니다(v1 + v1.1 확장 포함). `agent/API.md` 참고.
- `contract/src/managed/`(컴파일 산출물)이 없으면 `npx tsc --noEmit`이 다수 에러를 냅니다. 이건
  버그가 아니라 `npm run compile:zk`를 아직 안 돌려서입니다.
- `agent/README.md`가 매우 상세합니다(706줄): 실제 devnet/Preprod에서 돌린 curl 검증 기록,
  API.md와의 사소한 구현 차이가 다 있습니다. 막히면 거기부터 보세요.

## 4. 다음 마일스톤 (주호님 지시, 2026-09-13)

현재 상태: **Preprod에 컨트랙트를 배포하고 web UI에서 발행 → 전달 → 증명 → 재사용 거부까지
실제 증명으로 검증 완료.**

다음 계획, 이 순서대로:

1. **기업별 agent 분리** — 각 기업 화면에 자기 lot만 보이게. **코드 작업 완료(2026-09-13,
   ethan)**: `agent/`에 `AGENT_PARTIES`(호스팅할 파티 제한), `AGENT_CONTRACT_ADDRESS`(admin이
   아닌 agent가 기존 배포에 붙기), `registry.json`의 `parties` 공개 디렉터리 +
   `src/cli/print-identity.ts`(다른 agent에 자기 partyId를 알려주는 스크립트)를 추가했습니다.
   상세는 `agent/API.md`의 "Per-company agents" 절과 `agent/README.md`의 "Running as a
   single-company agent" 절 참고. **아직 실제 멀티 프로세스로 돌려서 검증은 못 했습니다** —
   `print-identity.ts`가 컴파일된 컨트랙트(`pureCircuits.partyIdOf`)를 필요로 해서 Compact
   툴체인(6절)이 먼저 있어야 합니다. `npx tsc --noEmit`으로 새 코드 자체에 새 에러가 없는 것만
   확인했습니다(기존에 있던 `managed/` 부재 에러 외 추가 에러 없음).
2. **검증자가 indexer를 직접 읽는 독립 검증** — 지금은 verify 엔드포인트도 데모 agent를 거침.
   검증자(OEM/규제기관)가 agent를 신뢰하지 않고 indexer에서 직접 증명 상태를 읽을 수 있게.
   **미착수.**
3. **드로어 Evidence에 증명 세부 표시** — 회로명, verifier key, 증명 시간을 웹 UI의 lot
   드로어(Evidence 섹션)에 노출. **미착수.**

## 5. 이 PC(ethan, Windows 11)에서 확인한 것

| 검증 | 결과 |
| --- | --- |
| `git fetch` + merge로 주호님의 `9324bf2` 반영 | 완료, 충돌 없음 |
| `agent/node_modules` 심볼릭 링크 생성 | 성공 (관리자 권한 불필요, git-bash `ln -s`) |
| `agent`: `npx tsc --noEmit` | `contract/src/managed/` 부재로 인한 에러만 발생 (예상된 것, compile:zk 실행하면 해결될 것) |
| `web`: `npm ci`, `npm run typecheck`, `npm run build` | 모두 통과 |
| `contract`: `npm ci` | 통과 |
| `contract`: `npm run typecheck` | 실패, `src/managed/` 부재 때문 |
| `contract`: `npm test` | 불가. Compact CLI 없음 |
| `shared/graphScope.test.ts` | 통과 |
| `veilance-preprod-state.tgz` 압축 해제, `.env.preprod` 확인 | 완료. `PROOF_SERVER_URL=http://127.0.0.1:6300` (로컬 필요), node/indexer는 Preprod 공개 엔드포인트 |
| WSL2 / Docker 설치 시도 | **막힘.** 이 셸이 관리자 권한이 아니라 `wsl --install`, Windows 기능 활성화, Docker Desktop 설치가 전부 "elevation 필요" 오류. Compact CLI는 Windows 네이티브 빌드가 없어([공식 문서](https://docs.midnight.network/guides/windows-compact-setup) 확인) WSL2가 필수 |

## 6. 다음 할 일 (제안, 우선순위 순)

- [ ] **사용자가 직접**: 관리자 PowerShell에서 `wsl --install -d ubuntu` 실행 → 재부팅 → Ubuntu
      최초 설정(유닉스 사용자명/비밀번호). 같은 창에서 `winget install -e --id Docker.DockerDesktop`
      도 같이 설치하고, Docker Desktop 설정에서 WSL integration을 Ubuntu에 대해 켜기.
- [ ] 그다음(제가 이어서 진행 가능): WSL 안에서 Compact CLI 설치
      (`curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh`),
      `contract`에서 `npm run compile:zk`, 증명 서버 컨테이너 기동.
- [x] 4절 마일스톤 1번(기업별 agent 분리) 코드 작업 — `AGENT_PARTIES`, `AGENT_CONTRACT_ADDRESS`,
      registry `parties` 디렉터리, `print-identity.ts`. 위 WSL/Docker와 무관하게 진행함.
- [ ] WSL2/Docker가 준비되면: `print-identity.ts`로 기존 Preprod `.state/preprod/{mine,refiner,
      batteryMfr}`의 실제 partyId를 계산해 `registry.json`에 채우고, 세 파티를 각자 다른 포트의
      별도 프로세스로 띄워(`AGENT_PARTIES=mine`, `=refiner`, `=batteryMfr`, admin은 네 번째) 기업별
      분리가 실제로 동작하는지 검증. 지금 `.state/preprod/`는 한 프로세스가 네 파티를 다 호스팅하는
      전제로 만들어졌으므로 그대로 재사용 가능(디렉터리만 나누면 됨, 시크릿 재발급 불필요).
- [ ] 1번 검증이 끝나면 2번(검증자 독립 검증), 3번(Evidence 드로어) 순서로 착수.

## 7. 이력

- 2026-09-13 (ethan): 클론, 환경 점검, 웹 빌드 확인, 이 문서 작성.
- 2026-09-13 (ethan): `agent/`가 없어서 임시로 재구현(Hono, midnight/fake 백엔드, 테스트 20건),
  `docs/spec.md` 추가(초기 9절 요약본), README 갱신, `.gitignore`에서 `/agent/` 제거.
- 2026-09-13 (ethan): `docs/spec.md`를 15절 전체 버전으로 갱신.
- 2026-09-13 (ethan): 주호님이 커밋 `9324bf2`로 진짜 `agent/`·`API.md`·설계 문서 3개를 올림.
  fetch+merge로 반영. 임시로 만들었던 재구현은 폐기(스크래치패드에 백업만 남김), README를 실제
  agent의 실행법(`ln -s` 심볼릭 링크, `POST /deploy`, `POST /admin/bootstrap`, `PORT`/`CORS_ORIGIN`)에
  맞게 재작성.
- 2026-09-13 (ethan): 주호님이 DM으로 `VEILANCE_FUNDER_SEED`와 `veilance-preprod-state.tgz`,
  다음 마일스톤(기업별 agent 분리 → 검증자 독립 검증 → Evidence 드로어)을 전달. `agent/`에 상태
  압축 해제, gitignore 커버리지 확인. 압축 풀고 남은 원본 tgz가 루트에 gitignore 안 된 채로
  남아있던 것을 발견해 스크래치패드로 이동, 루트 `.gitignore`에 `*.tgz` 방어 규칙 추가.
  WSL2/Docker 설치는 여전히 관리자 권한 없음으로 차단.
- 2026-09-13 (ethan): 마일스톤 1(기업별 agent 분리) 코드 작업. `agent/src/config.ts`에
  `AGENT_PARTIES`/`AGENT_CONTRACT_ADDRESS`, `bootstrap.ts`/`handlers.ts`의 파티 순회를
  `HOSTED_PARTIES`로 교체, `registry.json`/`registry.ts`에 공개 `parties` 디렉터리와
  `partyId()` 접근자, `src/cli/print-identity.ts` 신규. `agent/API.md`·`agent/README.md`에
  "Per-company agents" / "Running as a single-company agent" 절 추가. typecheck로 새 에러
  없음 확인(기존 `managed/` 부재 에러만 남음). 실제 멀티 프로세스 실행 검증은 WSL2/Docker
  대기 중.

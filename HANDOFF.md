# Veilance handoff (2026-09-13)

작업자 교대용 요약. 다음 사람은 이 문서와 `README.md`만 읽고 시작할 수 있어야 합니다.
새 작업을 마칠 때마다 아래 "현재 상태"와 "다음 할 일"을 갱신하고 커밋합니다.

## 0. 최신 소식 (2026-09-13, ethan) — 마일스톤 1·2·3 전부 완료 🎉

**이 0절이 최신입니다.** 마일스톤 2·3도 이어서 끝냈습니다 — 요약만 먼저:

- **마일스톤 2(검증자 독립 검증)**: `/verify/*` 세 라우트가 여전히 `appState.
  partyOrThrow(holder)`로 holder의 **로컬 시크릿**에서 partyId를 계산하고 있던 버그를
  발견/수정(마일스톤 1과 똑같은 종류의 버그, verify 경로에 남아있던 것) — `resolvePartyId`
  + `anyPartyOrThrow`로 통일. 그리고 진짜 목표인 **완전 독립 검증 스크립트**
  `agent/src/cli/verify-independent.ts`를 새로 작성: 지갑도, 증명 서버도, agent 프로세스도
  전혀 없이 indexer만 직접 읽어서 동일한 PASSED/PENDING/STALE 판정을 내림. 로컬 agent
  프로세스를 전부 꺼둔 채로 Preprod에서 실제로 검증 완료.
- **마일스톤 3(Evidence 드로어)**: `agent/src/verifierKeys.ts`(회로별 verifier key
  sha256 fingerprint) + `graph.ts`가 각 edge에 `provingMs`/`verifierKeyFingerprint` 추가,
  `web/src/components/drawers/LotDrawer.tsx`의 Evidence 섹션에 Circuit/Verifier key/Proving
  time 세 줄 추가. mock(`web/src/api/mock.ts`)에도 동일 필드 채움. 실제 Preprod `/graph`
  응답으로 진짜 값(`provingMs: 40337`, 회로별로 다른 `verifierKeyFingerprint`) 확인 완료.

상세 내용은 §4를 참고하세요 (다음 마일스톤 섹션에 각 항목의 완료 기록을 갱신해뒀습니다).
아래 0-1절(이전 기록)은 마일스톤 1만 다룹니다 — 그대로 남겨둠.

## 0-1. 마일스톤 1 실검증 완료 (이전 기록)

이전까지 유일한 블로커였던 WSL2/Docker가 사용자 쪽에서 설치 완료됐고, 그 뒤로 이어서:

1. **WSL2 Ubuntu + Docker Desktop 설치 확인.** `wsl --install -d Ubuntu`는 최초 실행 시
   유닉스 사용자명/비밀번호를 상호작용으로 입력해야 해서 자동화된 셸에서는 멈춘다 —
   사용자가 직접 Ubuntu 앱을 열어 완료해야 함(계정: `user`/`user`).
2. **Compact CLI 설치 + `compile:zk` 완주.** WSL Ubuntu 안에 `compact-installer.sh` 설치 후
   `compact update --no-set-default 0.31.1`로 pinned 버전 설치, `compact compile +0.31.1
   src/veilance.compact src/managed/veilance` 실행 — 9개 회로 전부 prover/verifier key
   생성 성공 (`unzip`/`zip` 패키지가 없으면 `compact update`의 아티팩트 추출이 실패하니
   먼저 `apt-get install unzip zip` 필요). 이걸로 `contract`/`agent` typecheck, `npm test`
   (27개), `e2e:dry-run`이 전부 처음으로 로컬에서 통과함.
3. **증명 서버 컨테이너 기동.** `docker run -d -p 6300:6300 midnightntwrk/proof-server:8.1.0`
   (인자 없이 기본값 사용 — 이 이미지 버전은 `--network` 플래그가 없고 `--num-workers` 등만
   받음). `/version` → `8.1.0` 확인.
4. **`print-identity.ts`로 실제 partyId 계산 → `registry.json` 채움.** mine/refiner/
   batteryMfr 세 파티 전부 계산 성공, `registry.json`의 `parties` 디렉터리에 기록.
5. **🐛 실제 버그 발견 및 수정: `agent/node_modules`가 심볼릭 링크가 아니라 진짜 별도
   설치였다.** `stat -c '%i'`로 확인하면 `agent/node_modules`와 `contract/node_modules`의
   inode가 서로 달랐고(내용은 동일한 패키지 셋), Windows `dir`로 봐도 `<DIR>`이지
   `<JUNCTION>`이 아니었다 — 즉 예전에 "`ln -s` 성공"이라고 기록된 것은 실제로는 진짜
   심볼릭 링크가 아니라 (이 환경의 git-bash `ln -s`가 심볼릭 링크 권한 없이 조용히
   실패하거나 다른 동작을 한 것으로 보임) 완전히 별도인 두 번째 설치본이었다. `agent/src/
   routes.ts`·`contractSetup.ts`가 `@midnight-ntwrk/ledger-v8`·`midnight-js-contracts`를
   직접 import하므로, 이 파일들은 (contract/ 쪽 코드와 달리) **agent/node_modules를 우선
   해석**한다 — 그 결과 컨트랙트가 만든 `ContractState`와 agent 쪽 `midnight-js-contracts`가
   서로 다른 두 개의 로드된 클래스 인스턴스가 되어 `instanceof` 검사가 깨진다. 증상: 지갑
   동기화·원장 읽기(`/health`, `/parties`, `/ledger`)는 멀쩡한데, 실제 회로 호출
   (`POST /parties/:party/issue`)만 즉시(1초 내) `"'contractState' parameter ContractState
   (...) has unexpected type"` 에러로 실패. **고친 방법**: git-bash `ln -s`는 신뢰하지 말고
   PowerShell에서 `Remove-Item -Recurse -Force agent/node_modules` 후
   `cmd /c mklink /J agent\node_modules contract\node_modules`(NTFS 디렉터리 junction —
   관리자 권한 불필요)로 교체. `Get-Item agent/node_modules | Select LinkType`으로
   `Junction`이 뜨는지 반드시 확인. **이 PC에서 심볼릭 링크를 다시 만들 일이 있으면
   앞으로도 `ln -s` 대신 이 방법을 쓸 것.**
6. **마일스톤 1 실제 멀티 프로세스 검증 완료.** `AGENT_PARTIES=mine`(:4001),
   `=refiner`(:4002), `=batteryMfr`(:4003) 세 개의 완전히 분리된 `npx tsx src/index.ts`
   프로세스를 같은 `.env.preprod`/같은 배포 주소로 띄워서:
   - 각자 자기 파티만 `/parties`에 노출됨, `/health` ready:true 확인.
   - `/ledger`, `/ledger/policy`가 admin을 안 호스팅하는 프로세스에서도 정상 동작
     (`anyPartyOrThrow` 수정 확인).
   - `/graph`는 admin을 안 호스팅하는 프로세스에서 의도대로 실패함(`unknown or
     not-yet-built party: admin`) — 이건 버그가 아니라 구조적 한계: `buildGraph()`가
     전체 그래프의 모든 노드(각 파티의 로컬 보유 자격증명 개수 등 private 데이터)를
     그리려면 네 파티 전부의 시크릿이 필요함. 단일 회사 에이전트의 진짜 그래프 뷰는
     마일스톤 2(검증자가 indexer를 직접 읽음) 이후에나 의미가 생김 — 지금 더 손대지 않음.
   - **실제 발급 성공**: mine(4001) → refiner(4002)로 `POST /parties/mine/issue`
     (recipient가 이 프로세스에 없는 파티) — `stage: confirmed`, 실제 txHash/blockHeight.
     refiner(4002)에서 `POST /parties/refiner/scan` → 자기 키로 정상 복호화해 새
     자격증명 수신 확인.
   - **실제 전달 성공**: refiner(4002) → batteryMfr(4003)로
     `POST /parties/refiner/credentials/:id/transfer` — `stage: confirmed`.
     batteryMfr(4003)에서 scan → 정상 수신 확인.
   - 즉 mine→refiner→batteryMfr 전체 체인이 **세 개의 진짜 별도 OS 프로세스**로,
     서로의 시크릿 없이, `registry.json`의 공개 partyId 디렉터리만으로 완전히 동작함을
     Preprod 실체인에서 확인. 마일스톤 1의 "아직 실제 멀티 프로세스로 돌려서 검증은
     못 했습니다"가 이제 해소됨.
   - 작업 전 `agent/.state/preprod`를 `preprod.backup-20260913-164438`로 백업해둠
     (gitignored, 필요 없어지면 지워도 됨).

**다음(미착수)**: 없음 — 주호님이 지시한 세 마일스톤(§4) 전부 완료. 다음 지시 대기 중.

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

- **`npm install`을 하지 마세요.** `agent/node_modules`는 `contract/node_modules`와 같은
  디렉터리를 가리켜야 합니다 (WASM 런타임 클래스가 두 곳에 따로 설치되면 회로 호출 시
  `"'contractState' parameter ContractState (...) has unexpected type"` 오류가 납니다 —
  §0-1의 5번 항목에서 실제로 겪은 문제). **Windows에서는 git-bash `ln -s`를 신뢰하지 마세요** — 심볼릭
  링크 권한이 없으면 조용히 실패하거나 진짜 별도의 디렉터리를 만들어버릴 수 있고, 이러면
  `ls`로는 정상처럼 보입니다. 대신 PowerShell에서 다음으로 만들고 `LinkType`이 `Junction`인지
  확인하세요:
  ```powershell
  Remove-Item agent\node_modules -Recurse -Force -Confirm:$false  # 있다면(진짜 디렉터리인 경우만)
  cmd /c mklink /J agent\node_modules contract\node_modules
  Get-Item agent\node_modules | Select-Object LinkType   # "Junction"이어야 함
  ```
  (WSL/Linux/macOS라면 기존 `ln -s "$(pwd)/contract/node_modules" agent/node_modules`로 충분.)
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

1. **기업별 agent 분리** — 각 기업 화면에 자기 lot만 보이게. **완료 + 실제 멀티 프로세스
   검증 완료(2026-09-13, ethan, §0 참고)**: `agent/`에 `AGENT_PARTIES`(호스팅할 파티 제한),
   `AGENT_CONTRACT_ADDRESS`(admin이 아닌 agent가 기존 배포에 붙기), `registry.json`의
   `parties` 공개 디렉터리 + `src/cli/print-identity.ts`(다른 agent에 자기 partyId를 알려주는
   스크립트)를 추가했고, 실제 partyId를 계산해 `registry.json`에 채운 뒤 mine/refiner/
   batteryMfr을 각각 별도 포트의 완전히 분리된 프로세스로 띄워 Preprod에서 발급→전달
   전체 체인이 서로의 시크릿 없이 동작함을 확인했습니다. 상세는 `agent/API.md`의
   "Per-company agents" 절과 `agent/README.md`의 "Running as a single-company agent" 절 참고.
2. **검증자가 indexer를 직접 읽는 독립 검증** — **완료(2026-09-13, ethan, §0 참고)**.
   기존 `/verify/*` 세 라우트(`createChallenge`/`getVerifyResult`/`listOpenChallenges`)가
   holder의 로컬 시크릿에서 partyId를 계산하던 버그를 `resolvePartyId`/`anyPartyOrThrow`로
   고쳤고, 진짜 목표인 완전 독립 스크립트 `agent/src/cli/verify-independent.ts`를 새로
   작성했습니다 — 지갑·증명 서버·agent 프로세스 전부 없이 indexer만 직접 읽어 동일한
   PASSED/PENDING/STALE 판정을 냅니다. 로컬 agent를 전부 꺼둔 채로 Preprod에서 실제 검증
   완료(기존 attestation에 PASSED, 미사용 challenge에 PENDING). 상세는 `agent/API.md`의
   "Independent verification" 절 참고.
3. **드로어 Evidence에 증명 세부 표시** — **완료(2026-09-13, ethan, §0 참고)**. 회로명은
   `GraphEdge.circuit`으로 이미 있었고, `agent/src/verifierKeys.ts`(compile:zk 산출물
   `keys/<circuit>.verifier`의 sha256 앞 16자 — 회로마다 고정, 매 증명마다 같음)와
   `graph.ts`의 job-history 조회로 `provingMs`를 추가해 `GET /graph`의 각 edge에
   `provingMs`/`verifierKeyFingerprint`를 실었습니다. 웹 UI `LotDrawer.tsx`의 Evidence
   섹션에 Circuit/Verifier key/Proving time 세 줄을 추가(mock에도 동일 필드 채움).
   실제 Preprod `/graph` 응답으로 확인(예: `provingMs: 40337`, 회로별로 다른 fingerprint).

## 5. 이 PC(ethan, Windows 11)에서 확인한 것

| 검증 | 결과 |
| --- | --- |
| `git fetch` + merge로 주호님의 `9324bf2` 반영 | 완료, 충돌 없음 |
| `agent/node_modules` 심볼릭 링크 생성 | 성공이라 기록했었으나 **오기록이었음** — 실제로는 진짜 별도 디렉터리였고 §0-1의 5번 항목에서 발견/수정 |
| `agent`: `npx tsc --noEmit` | `contract/src/managed/` 부재로 인한 에러만 발생 (예상된 것, compile:zk 실행하면 해결될 것) |
| `web`: `npm ci`, `npm run typecheck`, `npm run build` | 모두 통과 |
| `contract`: `npm ci` | 통과 |
| `contract`: `npm run typecheck` | 실패, `src/managed/` 부재 때문 |
| `contract`: `npm test` | 불가. Compact CLI 없음 |
| `shared/graphScope.test.ts` | 통과 |
| `veilance-preprod-state.tgz` 압축 해제, `.env.preprod` 확인 | 완료. `PROOF_SERVER_URL=http://127.0.0.1:6300` (로컬 필요), node/indexer는 Preprod 공개 엔드포인트 |
| WSL2 / Docker 설치 시도 | **막힘.** 이 셸이 관리자 권한이 아니라 `wsl --install`, Windows 기능 활성화, Docker Desktop 설치가 전부 "elevation 필요" 오류. Compact CLI는 Windows 네이티브 빌드가 없어([공식 문서](https://docs.midnight.network/guides/windows-compact-setup) 확인) WSL2가 필수 |

## 6. 다음 할 일 (제안, 우선순위 순)

- [x] WSL2 Ubuntu + Docker Desktop 설치 (사용자가 직접, 2026-09-13).
- [x] WSL Ubuntu 안에 Compact CLI 설치 + `compile:zk` 완주 (2026-09-13, ethan — §0 참고).
- [x] 증명 서버 컨테이너 기동, `/version` 8.1.0 확인 (2026-09-13, ethan).
- [x] 4절 마일스톤 1번(기업별 agent 분리) 코드 작업 — `AGENT_PARTIES`, `AGENT_CONTRACT_ADDRESS`,
      registry `parties` 디렉터리, `print-identity.ts`.
- [x] `print-identity.ts`로 실제 partyId 계산 → `registry.json`에 채움, mine/refiner/batteryMfr을
      각각 별도 포트의 완전히 분리된 프로세스로 띄워 Preprod에서 발급→전달 전체 체인 검증 완료
      (2026-09-13, ethan — §0 참고). 이 과정에서 `agent/node_modules` 심볼릭 링크 버그를
      발견/수정함(§0-1의 5번 항목).
- [x] 마일스톤 2(검증자 독립 검증) — `resolvePartyId`/`anyPartyOrThrow` 수정 +
      `verify-independent.ts` 신규, Preprod에서 agent 프로세스 없이 실제 검증 완료
      (2026-09-13, ethan — §0 참고).
- [x] 마일스톤 3(Evidence 드로어) — `verifierKeys.ts` 신규, `graph.ts`/`GraphEdge`/
      `LotDrawer.tsx`에 circuit·verifier key·proving time 노출, 실제 Preprod 데이터로 확인
      (2026-09-13, ethan — §0 참고).
- [ ] 다음: 없음 — §4의 세 마일스톤 전부 완료. 다음 지시 대기 중.

## 6-1. 이 PC(새 PC, ethan)로 옮긴 뒤 발견해서 고친 것 (2026-09-13)

마일스톤 1(기업별 agent 분리) 코드를 실제로 여러 프로세스로 쪼개 돌리기 전에, 코드만 읽고
"AGENT_PARTIES로 파티를 나눴을 때 자기 프로세스에 없는 파티를 참조하는 곳"을 전수 조사했습니다
(`grep`으로 `.file.partySecret`·`partyOrThrow(` 전체 호출부 확인). `startCertifySupplierJob`만
`resolvePartyId`로 이미 대응돼 있었고, 아래 두 종류는 안 돼 있어서 고쳤습니다:

1. **발행/전달의 수신자(recipient)가 이 프로세스에 없으면 즉시 실패**: `startIssueJob`/
   `startTransferJob`/`recipientHasEncKey`(handlers.ts)가 `appState.partyOrThrow(body.recipient)`로
   수신자의 `partySecret`을 직접 읽어 `partyId`를 계산하고 있었습니다. mine·refiner·batteryMfr을
   각자 다른 프로세스로 쪼개면 mine이 refiner에게 발행하는 순간
   `"unknown or not-yet-built party: refiner"`로 죽습니다 — 데모의 핵심 플로우(광산→정제사→
   배터리제조사)가 바로 막히는 지점이었습니다. `resolvePartyId`(호스팅돼 있으면 로컬 secret,
   아니면 `registry.json`의 공개 `parties` 디렉터리)로 통일해서 고쳤습니다. `recipientHasEncKey`는
   호출자(caller) 파라미터를 추가로 받아 그 프로바이더로 공개 원장을 읽도록 변경(원장 읽기 자체는
   공개 데이터라 아무 파티의 provider든 상관없음).
2. **`admin`을 안 호스팅하는 에이전트에서 `GET /ledger`, `/ledger/policy`, `/explorer/ledger-raw`,
   `/graph`(수신자 복호화 폴백)가 전부 즉시 실패**: `ledgerRead.ts`·`graph.ts`·`explorer.ts`
   네 곳이 "아무 파티 provider나 상관없는 공개 원장 읽기"에 `appState.partyOrThrow("admin")`을
   하드코딩하고 있었습니다. `AGENT_PARTIES=mine`처럼 admin을 안 호스팅하는 단일 기업 에이전트는
   이 네 엔드포인트가 전부 `"unknown or not-yet-built party: admin"`로 죽습니다 — 웹 UI 대시보드가
   기업별 에이전트에서 거의 못 뜬다는 뜻이라 1번보다 더 근본적인 문제였습니다. `appState`에
   `anyPartyOrThrow()`(호스팅된 파티 아무거나 하나)를 추가해 네 곳 다 교체. 반대로 `deploy`/
   `certifyOrigin`/`certifySupplier`/`setCarbonThreshold`처럼 계약상 진짜 admin만 호출 가능한
   회로는 `"admin"` 하드코딩을 그대로 뒀습니다(의도된 것, 버그 아님).

두 수정 다 `npx tsc --noEmit`으로 확인: 에러 개수 그대로 43개(전부 `managed/` 부재로 인한 기존
파생 에러, 줄 번호만 밀림 — 새 에러 없음). `contract` typecheck(27개, 동일 원인)·`web` build·
`shared/graphScope.test.ts` 재확인, 전부 통과. `agent/API.md`의 "Per-company agents" 절에
issue/transfer도 같은 패턴으로 크로스 에이전트에서 동작한다고 추가.

Preprod 상태(`agent/.env.preprod`, `agent/.state/preprod/`)는 노트북에서 tgz로 받아 이 PC에
풀었고 배포 주소(`aef19243...`)가 §2 기록과 일치함을 확인했습니다. WSL2/Docker Desktop은 사용자가
관리자 권한으로 설치 진행 중 — 끝나면 §6대로 Compact CLI 설치, `compile:zk`, 실제 멀티 프로세스
검증으로 이어갑니다.

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
- 2026-09-13 (ethan, 새 PC): `C:\dev\veilance`에 새로 클론(다른 PC), baseline 재현 확인(§5와
  동일 결과). 노트북에서 `veilance-preprod-state.tgz`를 받아 `agent/`에 풀어 Preprod 상태 이전
  완료(§6-1). 마일스톤 1 코드를 실행 전에 전수 리뷰해서 크로스 에이전트 참조 버그 2건 발견 후
  수정(§6-1): issue/transfer의 recipient 파티 ID 해석, `admin` 비호스팅 에이전트의 공개 원장 읽기
  4곳. WSL2/Docker Desktop은 사용자가 관리자 권한으로 설치 진행 중.
- 2026-09-13 (ethan): 사용자가 WSL2 Ubuntu + Docker Desktop 설치 완료. 이어서 WSL Ubuntu에
  Compact CLI 설치, `compile:zk` 최초 완주(9개 회로), 증명 서버 컨테이너 기동,
  `print-identity.ts`로 실제 partyId 계산해 `registry.json` 채움. mine/refiner/batteryMfr을
  세 개의 완전히 분리된 프로세스로 Preprod에 붙여 발급(mine→refiner)과 전달(refiner→
  batteryMfr) 전체 체인이 서로의 시크릿 없이 동작함을 확인 — 마일스톤 1 완전 검증. 이 과정에서
  `agent/node_modules`가 (예전 기록과 달리) 진짜 심볼릭 링크가 아니라 별도 설치본이었던 버그를
  발견, PowerShell `mklink /J`로 교체해 수정(회로 호출이 `ContractState has unexpected type`로
  실패하던 근본 원인). 전체 내용은 §0 참고.
- 2026-09-13 (ethan): 마일스톤 2(검증자 독립 검증). `handlers.ts`의 `createChallenge`/
  `getVerifyResult`/`listOpenChallenges`가 holder의 로컬 시크릿으로 partyId를 계산하던
  버그를 `resolvePartyId`/`anyPartyOrThrow`로 수정(마일스톤 1과 같은 종류의 버그가 verify
  경로에 남아있었음) — mine 전용 에이전트로 batteryMfr의 검증 결과를 정상 반환함을 실증.
  새 `agent/src/cli/verify-independent.ts`: 지갑·증명 서버·agent 프로세스 없이 indexer만
  직접 읽는 완전 독립 검증 스크립트. 로컬 agent 전부 정지 상태에서 Preprod 대상으로 실행해
  실제 attestation에 PASSED, 미사용 challenge에 PENDING을 정확히 재현함을 확인. `agent/API.md`에
  "Independent verification" 절 추가. 커밋 `2885be2`.
- 2026-09-13 (ethan): 마일스톤 3(Evidence 드로어). 새 `agent/src/verifierKeys.ts`(회로별
  verifier key sha256 fingerprint, 최초 1회 읽고 캐시), `graph.ts`가 각 edge에 job history
  조회로 `provingMs`, verifierKeys.ts로 `verifierKeyFingerprint` 추가. `agent/src/types.ts`·
  `web/src/api/types.ts`의 `GraphEdge`에 두 필드 추가, `web/src/api/mock.ts`에도 동일 필드
  채움(mock은 fakeHash로 안정적인 가짜 fingerprint 생성). `LotDrawer.tsx`의 Evidence 섹션에
  Circuit/Verifier key/Proving time 세 줄 추가, `messages.ts`에 한국어 번역 추가. 전체 4파티
  호스팅 에이전트로 실제 Preprod `/graph`를 조회해 진짜 값(`provingMs: 40337`, 회로별로 다른
  fingerprint) 확인. `contract`·`agent`·`web` typecheck와 `web` 프로덕션 빌드 전부 통과.
  이것으로 §4의 세 마일스톤 전부 완료 — 다음 지시 대기 중.

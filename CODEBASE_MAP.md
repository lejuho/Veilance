# Veilance Codebase Map

> 저장소 전체의 지도. "무엇이 어디에 있고, 무엇을 먼저 읽어야 하는가"를 답한다.
> 최종 갱신: 2026-09-09 (Party Agent + Web UI 추가)

---

## 1. 한눈에 보기

```text
Veilance/
├── landing.md              제품 정의. 모든 설계의 출발점 (Problem → Solution → MVP → Roadmap)
├── ERD.md                  데이터 모델. L1 ledger / L2 private / L3 app DB 3계층
├── CONTRACT_DESIGN.md      컨트랙트 설계 + 검증 결과 + 툴체인 결정 + devnet 실측
├── spec.md                 기능명세서. 화면 / FR / 데이터 / 엣지케이스 / 미정 사항
├── CODEBASE_MAP.md         이 문서
├── compact_medium.md       참고 자료 (Midnight 실행 모델 해설, 외부 글)      [미커밋]
├── template_spec.md        참고 자료 (기능명세서 형식 템플릿, 타 프로젝트)   [미커밋]
└── contract/               구현 전부
    ├── src/
    │   ├── veilance.compact    컨트랙트 (ledger 11, witness 11, pure circuit 5, export circuit 9)
    │   ├── witnesses.ts        witness 구현 + VeilancePrivateState
    │   ├── sealed-entry.ts     X25519 봉인 / 개봉 / inbox 스캔
    │   └── managed/            컴파일 산출물 (gitignore, `npm run compile[:zk]` 로 생성)
    ├── test/
    │   ├── network.ts          compact-runtime 위의 multi-party 시뮬레이터
    │   └── demo.test.ts        27 tests: 데모 4단계 + 공격 + negative + v2 + v3
    ├── e2e/
    │   ├── run.ts              로컬 devnet 전체 흐름 + circuit 별 시간 측정
    │   ├── lib/                health / wallet / providers / zk / report / config
    │   ├── README.md           실행 절차, 툴체인 세대 결정 근거, 메모리 가이드
    │   ├── REPORT.md, report.json   최근 실행 결과 (gitignore)
    │   └── .state/             참여자별 private state (LevelDB, gitignore)
    ├── NOTES.md                구현 노트: 스펙 대비 변경, 보안 감사, v2/v3 변경 로그, 툴체인
    ├── package.json            scripts + 안정 세대 의존성 고정
    ├── tsconfig.json, vitest.config.ts
    └── .gitignore
├── agent/                  Party Agent — 기업별 Node 서비스 (데모는 한 프로세스가 4 party 호스팅)
│   ├── API.md                  Web UI 와의 HTTP 계약 (v1)
│   ├── README.md               실행법, API.md 대비 차이, devnet curl 검증 기록
│   ├── registry.json           L3 라벨 (조직명, origin 명, 재료명). 온체인에 안 올라감
│   ├── src/
│   │   ├── index.ts / routes.ts / handlers.ts   HTTP 계층 (Hono, :4000)
│   │   ├── jobs.ts             순차 job 큐 (증명 1개씩), stage 전이, 영속화
│   │   ├── bootstrap.ts        지갑 4개 + 자금 + DUST + provider + 컨트랙트 재접속
│   │   ├── contractSetup.ts    deploy / findDeployedContract
│   │   ├── ledgerRead.ts       indexer → ledger 디코딩 → 카운터/정책
│   │   ├── predicates.ts       verifier profile 별 predicate 표 (spec §4.2.3)
│   │   ├── disclosure.ts       op 별 "공개 / 비공개" 텍스트 (spec §5)
│   │   ├── state.ts / appState.ts   party vault (enc key, held credential, lastSeenInboxIndex, jobs)
│   │   └── registry.ts / bytes.ts / config.ts / types.ts
│   ├── .state/                 배포 주소 + party 별 vault (gitignore)
│   └── node_modules → ../contract/node_modules (symlink: WASM 런타임 단일 사본 보장)
└── web/                    Web UI v3 — 단일 화면 (Vite + React 18 + TS + Tailwind), agent API 만 호출
    ├── UX_V3.md                확정 UX 스펙 (용어, 레이아웃, 드로어, 규칙). 화면 변경 전 반드시 읽을 것
    ├── README.md, .env.example   VITE_API_URL 미설정 또는 VITE_MOCK=1 이면 mock, VITE_EXPLORER_URL_TEMPLATE 로 외부 explorer
    ├── src/Screen.tsx          화면 조립: TopBar + Map + StatusBar + Drawer + ExplorerModal, 드로어 상태는 URL query
    ├── src/components/
    │   ├── TopBar.tsx          체인 점 + tip, 컨트랙트 short-hash(→ explorer), Policy 칩
    │   ├── Map.tsx             기업 카드 4장 + 간선의 lot 알약 + proof 배지 (고정 배치, 드래그 없음)
    │   ├── StatusBar.tsx       한 줄 상태: Idle / Proving · … · 23 s / Confirmed / Rejected
    │   ├── Drawer.tsx, JobRing.tsx   오른쪽 드로어 틀, 링 타이머
    │   ├── ExplorerModal.tsx   Transaction / Block / Contract / Ledger
    │   └── drawers/            OrgDrawer (발행·인박스), LotDrawer (타임라인·Transfer·Prove·Evidence), VerifierDrawer (Request proof·결과 표), PolicyDrawer
    ├── src/api/                http.ts (실제) / mock.ts / client.ts / types.ts
    ├── src/hooks/              queries.ts (graph 5s, job 1s, tip 10s), useAction.ts (폼 → job → 링)
    ├── src/lib/                lots.ts (lot 번호·제목), progress.ts, format.ts, registry.ts, bus.ts
    └── screenshots/            v3-*.png (mock), v3-real-*.png (실제 agent + devnet)
```

---

## 2. 읽는 순서

| 목적 | 순서 |
|---|---|
| 제품이 뭔지 | `landing.md` §1–§8 |
| 데이터가 어디에 사는지 | `ERD.md` §1 (3계층) → §2 다이어그램 |
| 컨트랙트가 무엇을 증명하는지 | `CONTRACT_DESIGN.md` §2 (암호 규약) → §4 (circuit) → §5 (disclosure) |
| 코드 자체 | `contract/src/veilance.compact` 주석이 설계 근거를 담고 있음 → `witnesses.ts` → `sealed-entry.ts` |
| 왜 이렇게 됐는지 (결정 이력) | `contract/NOTES.md` D-1…D-9, S-1…S-11, §7–§9 |
| UI 를 만들 때 | `spec.md` (FR 표의 `circuit` 열이 컨트랙트와 연결) → `agent/API.md` |
| 데모를 시연할 때 | `web/` 의 `/demo` 페이지 (7단계 가이드) + `agent/README.md` 실행 순서 |
| devnet 에서 돌릴 때 | `contract/e2e/README.md` |

---

## 3. 문서 간 관계

```text
landing.md ──(요구사항)──▶ ERD.md ──(엔티티)──▶ CONTRACT_DESIGN.md ──(circuit)──▶ spec.md
                                                        │                           │
                                                        ▼                           ▼
                                              contract/src/*.compact         UI (미구현)
                                                        │
                                                        ▼
                                              contract/NOTES.md (구현 중 발견·결정)
```

- `ERD.md` 의 L1 엔티티 ↔ `veilance.compact` 의 `export ledger` 필드가 1:1.
- `CONTRACT_DESIGN.md` §4 의 circuit 표 ↔ `veilance.compact` 의 `export circuit`.
- `spec.md` FR 표의 `circuit` 열 ↔ 같은 이름.
- `NOTES.md` 는 `CONTRACT_DESIGN.md` §9 의 원본. 둘이 다르면 NOTES 가 최신.

---

## 3.1 런타임 구성

```text
Browser (web/)  ──HTTP :4000──▶  Party Agent (agent/)  ──▶  proof server :6300
                                    │  4 party vault              indexer :8088
                                    │  midnight-js providers      node :9944 (ws)
                                    └─ contract/e2e/lib + contract/src 재사용
```

- UI 는 지갑·키·private state 를 갖지 않는다. Verifier 는 UI 만 쓴다.
- agent 는 party 당 partySecret, X25519 비밀키, 지갑, level private state provider 를 갖는다. 프로덕션은 기업당 agent 1개.
- circuit 호출은 agent 의 순차 job 큐를 통해 1개씩 (proof server 메모리). UI 는 job 을 1초 폴링.

## 4. 컨트랙트 구조 (`contract/src/veilance.compact`)

| 구역 | 내용 |
|---|---|
| Types | `Credential`, `MaterialSpec`, `VerifierProfile` (enum), `Attestation` |
| Ledger | `adminId` (sealed), `policyVersion` (Counter), `carbonThreshold`, `certifiedOrigins` / `certifiedSuppliers` (MerkleTree<8>), `provenanceTree` (HistoricMerkleTree<16>), `nullifiers` (Set), `attestations` (Map), `partyEncKeys` (Map), `credentialInbox` (Map<Uint<64>, Bytes<192>>), `credentialInboxCount` (Counter) |
| Witnesses | `adminSecret`, `ownerSecret`, `certId`, `certPath`, `originPath`, `heldCredential`, `commitmentPath`, `issuedMaterial`, `recipientId`, `newBatchSecret`, `newCarbonClass` |
| Pure circuits | `partyIdOf`, `certLeafOf`, `commitmentOf`, `nullifierOf`, `attestationKeyOf` — 모든 해시 정의는 여기 한 곳 |
| Helpers | `assertAdmin`, `assertSupplierCertified`, `assertOriginCertified`, `provenCredential`, `deliverSealedEntry`, `recordAttestation` |
| Admin circuits | `certifyOrigin`, `certifySupplier`, `setCarbonThreshold` |
| Key registration | `registerEncKey` |
| Circuit 1 | `issueProvenance(entry)` |
| Circuit 2 | `transferProvenance(entry)` |
| Circuit 3 | `attestConsumer`, `attestProcurement`, `attestRegulator` |

도메인 분리 문자열 5종: `veilance:id`, `veilance:cert`, `veilance:cm`, `veilance:nf`, `veilance:att`.

---

## 5. TypeScript 모듈

| 파일 | 역할 | 의존 |
|---|---|---|
| `src/witnesses.ts` | 11개 witness 구현. `VeilancePrivateState` 와 `forIssue` / `forTransfer` / `forHold` 상태 빌더. Merkle path 는 ledger 에서 직접 계산 | `managed/veilance/contract` |
| `src/sealed-entry.ts` | `generateEncKeypair`, `sealCredential`, `openCredential`, `scanInbox`. 컨테이너 192byte 레이아웃은 파일 헤더 참조 | `node:crypto`, `pureCircuits` |
| `test/network.ts` | `VeilanceNetwork` (공유 ledger) + `Party` (로컬 private state). circuit 별 wrapper, public state 스냅샷 | `@midnight-ntwrk/compact-runtime` |
| `test/demo.test.ts` | 27 tests. 그룹: `Veilance demo` (10), `negative cases` (7), `attestation binding (v2)` (3), `encrypted inbox (v3)` (7) | vitest |
| `e2e/run.ts` | devnet 전체 흐름. `--dry-run` 이면 네트워크 호출 없이 키 유도·봉인 왕복·프로바이더 구성만 | 아래 lib/* |
| `e2e/lib/config.ts` | 엔드포인트, 네트워크 id, 지갑 시드, `FUNDING_AMOUNT`, ZK 디렉토리 | — |
| `e2e/lib/health.ts` | node / indexer / proof-server health 및 버전 경고 | fetch |
| `e2e/lib/wallet.ts` | HD 시드 → shielded / unshielded / dust 지갑, `WalletFacade`, genesis 자금 지급 (`signRecipe` 포함), DUST 등록, midnight-js provider 어댑터 | wallet-sdk-* 4.x |
| `e2e/lib/providers.ts` | 참여자별 private state (level) / indexer / proof / zk config provider 묶음 | midnight-js-* 4.1.1 |
| `e2e/lib/zk.ts` | `keys/` 존재 확인 | fs |
| `e2e/lib/report.ts` | circuit 별 시간 측정, `REPORT.md` / `report.json` 출력 | — |
| `e2e/lib/party.ts` | `Party` 타입, `setPrivateState`, `currentLedger`, `snapshotLedger` — run.ts 와 agent 가 공유 | — |

---

## 6. 명령어

```bash
cd contract
npm install
npm run compile        # compact compile +0.31.1 --skip-zk  (~1s)  → src/managed/
npm run compile:zk     # 전체 ZK 빌드 (~80s) → src/managed/veilance/keys/ (18 파일)
npm test               # pretest 로 compile 후 vitest 27개
npm run typecheck
npm run e2e:dry-run    # 네트워크 없이
npm run e2e            # 로컬 devnet 필요

# party agent + web
cd agent && npm run dev                                  # :4000, ready 까지 ~60s (GET /health 의 ready)
cd web && VITE_API_URL=http://localhost:4000 npm run dev  # :5173. 환경변수 없으면 mock 모드
# Docker 엔진이 꺼져 있으면: powershell.exe -Command "Start-Process 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'"
# WSL 통합이 풀려 있으면 docker.exe 로: "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" compose -f "$(wslpath -w ~/.midnight-expert/devnet/devnet.yml)" up -d

# devnet (Docker Desktop + WSL integration 필요)
docker compose -f ~/.midnight-expert/devnet/devnet.yml up -d
docker compose -f ~/.midnight-expert/devnet/devnet.yml down      # 상태 유지
docker compose -f ~/.midnight-expert/devnet/devnet.yml down -v   # 체인 초기화
```

---

## 7. 버전 고정 (바꾸기 전에 `CONTRACT_DESIGN.md` §9.5 읽을 것)

| 구성요소 | 버전 | 비고 |
|---|---|---|
| Compact compiler | 0.31.1 (`+0.31.1` 로 스크립트에 고정) | 0.34.0 은 ledger-v9 차세대. 안정 devnet / SDK 없음 |
| language_version | ≥ 0.23 | |
| `@midnight-ntwrk/compact-runtime` | 0.16.0 | |
| `@midnight-ntwrk/onchain-runtime-v3` | 3.0.0 (`overrides`) | 두 벌 로드되면 `expected instance of StateValue` |
| `@midnight-ntwrk/ledger-v8` | 8.1.0 | |
| `@midnight-ntwrk/midnight-js-*` | 4.1.1 | |
| `@midnight-ntwrk/wallet-sdk-facade` | 4.1.0 | |
| devnet 이미지 | node 0.22.5 / indexer-standalone 4.2.1 / proof-server 8.1.0 | network id `undeployed` |
| Preprod | `agent/.env.preprod` (gitignore) 로 전환. 컨트랙트 `aef19243…2348` | `VEILANCE_*` 환경변수, 공유 수수료 지갑 |

---

## 8. 상태와 미완

| 영역 | 상태 |
|---|---|
| 컨트랙트 (MVP 9 circuit) | 완료. 시뮬레이터 27 tests, devnet E2E 통과 |
| 보안 감사 | HIGH 2건 수정, 나머지 문서화 (`NOTES.md` §4) |
| devnet 실측 | transfer 41s, issue 30s, attest 24–31s. `CONTRACT_DESIGN.md` §9.6 |
| Party Agent | 완료. devnet 과 **Midnight Preprod 공개 테스트넷** 양쪽에서 데모 전 과정 검증 (`agent/README.md`, `CONTRACT_DESIGN.md` §9.6.1) |
| Web UI | v3 완료. 단일 화면(지도 + 드로어 + explorer), 데모 전용 요소 제거. mock + 실제 agent Playwright 검증 (`web/screenshots/v3-*`) |
| Lace 지갑 연결 | 미구현. UI 의 API 추상화 뒤에 남겨 둠 (spec.md 배치 결정) |
| 봉인 헬퍼 브라우저 경로 | `node:crypto` 만 검증. WebCrypto 미검증 |
| 보류 항목 | revocation, admin 키 교체, originId salt, 수량 분할, 메타데이터 노출, 초기 익명성 (`spec.md` 각 §x.6) |
| 알려진 한계 | Consumer / Procurement 프로필은 nullifier 미검사 (S-5). Regulator 는 nullifier 공개 (S-4) |

---

## 9. 자주 찾는 것

| 찾는 것 | 위치 |
|---|---|
| commitment / nullifier 정의 | `veilance.compact` "Pure derivations" 구역, `CONTRACT_DESIGN.md` §2 |
| 왜 Set 이 아니라 Merkle tree 인가 | `CONTRACT_DESIGN.md` §1 원칙 2, `veilance.compact` `provenanceTree` 주석 |
| 무엇이 온체인에 공개되는가 | `CONTRACT_DESIGN.md` §5, `NOTES.md` §4 |
| disclose() 가 왜 여기만 있나 | `NOTES.md` D-1, 각 `disclose()` 옆 주석 |
| inbox 봉인 포맷 | `sealed-entry.ts` 헤더, `spec.md` §2.4 |
| attestation 키가 왜 challenge 가 아닌가 | `veilance.compact` `attestationKeyOf` 주석, `NOTES.md` §7 |
| 툴체인을 왜 0.31.1 로 내렸나 | `CONTRACT_DESIGN.md` §9.5, `e2e/README.md` §2 |
| devnet 통합 이슈 3건 | `CONTRACT_DESIGN.md` §9.6 표 |
| 화면 규칙·용어 | `web/UX_V3.md` |
| API 엔드포인트 | `agent/API.md`, 구현은 `agent/src/routes.ts` |
| 라벨(조직명·origin 명)이 어디서 오나 | `agent/registry.json` (L3). 온체인에는 id 만 |
| job stage 전이 | `agent/src/jobs.ts`, UI 표시는 `web/src/components/JobRing.tsx` + `StatusBar.tsx` |
| 공급망 그래프 데이터 | `agent/src/graph.ts` (`GET /graph`), explorer 는 `agent/src/explorer.ts` |

// site/home-explain.js — 홈 해부도 + 그래프 판독기 + 그래프 레이아웃 순수 함수.
// npm 패키지 없이 상대경로 ESM만 쓴다. 색은 CSS 변수 또는 HUE 팔레트만.
import { STATS, HUE } from "./garden-data.js"

const hueHex = (k) => HUE[k] || "#CBE3F4"
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))
const nf = (n, en) => Number(n || 0).toLocaleString(en ? "en-US" : "ko-KR")

// 문구 치환기: "{notes}개" + {notes:"301"} → "301개". 없는 키는 빈 문자열(절대 'undefined' 금지).
export const fill = (s, vars) => String(s == null ? "" : s).replace(/\{(\w+)\}/g, (_, k) => {
  const v = vars && vars[k]
  return v === undefined || v === null ? "" : String(v)
})

// STATS → 치환 변수. 언어별 천단위 구분자를 적용한다. 호출될 때마다 새로 만든다(캐시 금지).
// ⚠ 방향성 인접 합계는 여기 넣지 않는다 — 화면에 쓰는 '연결'은 linkPairs 하나뿐이다.
//   (그 키 이름을 주석에 적지도 말 것: 수용 기준 (8)이 파일 전체에서 그 문자열을 금지한다.)
function numbers(en) {
  return {
    notes: nf(STATS.notes, en), hubs: nf(STATS.hubs, en), terms: nf(STATS.terms, en),
    linkPairs: nf(STATS.linkPairs, en), wikilinks: nf(STATS.wikilinks, en),
    indexKeys: nf(STATS.indexKeys, en), diagrams: nf(STATS.diagrams, en),
    translated: nf(STATS.translated, en), codeLines: nf(STATS.codeLines, en),
  }
}

// 모든 사용자 노출 문구는 여기 한 곳에서만 나온다. 호출될 때마다 새 객체를 만든다(캐시 금지).
function copy(en) {
  return {
    strip: {
      spa:         en ? "Vanilla-JS SPA"                    : "바닐라 JS SPA",
      noframework: en ? "No framework, no bundler"          : "프레임워크 0 · 번들러 0",
      pipeline:    en ? "Self-built pipeline"               : "자체 빌드 파이프라인",
      counts:      en ? "{notes} notes · {linkPairs} links" : "노트 {notes} · 연결 {linkPairs}",
      jump:        en ? "How this site works ↓"             : "이 사이트가 작동하는 방식 ↓",
    },
    how: { head: en ? "HOW THIS PAGE IS BUILT" : "이 사이트가 만들어지는 경로" },
    stage: {
      source: { key: "SOURCE", title: "content/**/*.md", desc: en
        ? "{notes} markdown notes across {hubs} hubs, with {wikilinks} [[wikilinks]] in the body. Most are written by hand; the nightly briefs below are added by the generator."
        : "마크다운 노트 {notes}개, 허브 {hubs}개. 본문에 [[위키링크]] {wikilinks}개. 대부분 직접 쓰고, 야간 브리핑은 아래 생성기가 보탭니다." },
      build: { key: "BUILD", title: "build-content.mjs", desc: en
        ? "One Node script resolves wikilinks against a {indexKeys}-key index and computes {linkPairs} note-to-note connections. Private notes are filtered out here."
        : "Node 스크립트 하나가 위키링크를 {indexKeys}키 인덱스로 해석하고 노트 사이 연결 {linkPairs}개를 계산합니다. 비공개 노트도 여기서 걸러집니다." },
      data: { key: "DATA", title: "garden-data.js", desc: en
        ? "The single generated data module the site reads. Never hand-edited."
        : "사이트가 읽는 단 하나의 생성 데이터 모듈. 사람이 손대지 않습니다." },
      render: { key: "RENDER", title: "site/app.js", desc: en
        ? "Drawn with template strings, no framework: router, graph view, search, KO/EN, galaxy canvas — all hand-built. Backlinks, search and the graph are computed in the visitor's browser on top of that data. About {codeLines} lines of my own source."
        : "프레임워크 없이 템플릿 문자열로 그립니다. 라우터·그래프뷰·검색·한/영 전환·은하 캔버스를 직접 만들었고, 백링크·검색·그래프는 방문자 브라우저에서 이 데이터 위에 계산됩니다. 직접 작성한 소스는 약 {codeLines}줄입니다." },
      ship: { key: "SHIP", title: "GitHub Pages", desc: en
        ? "The public build strips private notes and ships only if the leak audit passes. No backend on the visitor's side."
        : "공개 빌드가 비공개 노트를 제외하고, 유출 감사를 통과해야만 배포됩니다. 방문자 쪽에 백엔드는 없습니다." },
    },
    night: {
      label: en
        ? "⟲ Every night at 01:07 an unattended generator writes new notes and re-runs SOURCE→DATA — if generation fails a deterministic scaffold still creates the day's page (shipping is a separate manual step; days the machine was off are skipped)."
        : "⟲ 매일 01:07, 무인 생성기가 새 노트를 써넣고 SOURCE→DATA 구간을 다시 돌립니다 — 생성이 실패해도 결정론 스캐폴드가 그날 페이지를 만듭니다(배포는 수동이라 별도로 실행합니다. PC가 꺼져 있던 날은 건너뜁니다).",
      caption: en
        ? "● brief published · ○ the job did not run (last 14 days of the publish log)"
        : "● 브리핑이 발행된 날 · ○ 실행되지 않은 날 (최근 14일 발행 로그)",
      aria: en ? "Nightly publish log, 14 days" : "야간 발행 기록 14일",
      on:   en ? "{iso} — published"            : "{iso} — 발행됨",
      off:  en ? "{iso} — did not run"          : "{iso} — 실행되지 않음",
    },
    fact: {
      diagrams:   en ? "notes carry diagrams — tap to open one"        : "다이어그램을 가진 노트 — 눌러서 보기",
      terms:      en ? "glossary terms auto-link in the body"          : "본문에서 자동 링크되는 용어",
      translated: en ? "notes in English — tap to switch"              : "영문판 노트 — 눌러서 전환",
      links:      en ? "note-to-note links — see how to read the graph": "노트 사이 연결 — 그래프 읽는 법 보기",
    },
    gx: {
      head: en ? "HOW TO READ THE GRAPH" : "이 사이트의 그래프 읽는 법",
      mobile: en
        ? "On a narrow screen the map on the right is hidden — everything below describes the graph that appears on a wider display."
        : "좁은 화면에서는 오른쪽 지도가 숨겨집니다 — 아래 설명은 넓은 화면에서 나타나는 그래프에 대한 것입니다.",
      where: en
        ? "On a wide screen the home page shows the {hubs} hubs and the links between them on the right. Open a note and it becomes a map of that note's neighbours."
        : "넓은 화면에서는 홈 오른쪽에 허브 {hubs}개와 허브 사이의 연결이 그려집니다. 노트를 열면 그 노트와 이어진 노트들의 지도로 바뀝니다.",
      demolab:  en ? "Example — the graph you see on a note page"          : "예시 — 노트 페이지에서 보이는 그래프",
      leadnote: en ? "Dashed lines are annotation pointers, not graph links." : "점선은 설명용 지시선입니다 — 그래프의 선이 아닙니다.",
      aria:     en ? "Example of how to read the graph view"              : "그래프 뷰 읽는 법 예시",
    },
    call: {
      center: en ? "This note"     : "지금 보는 노트",
      color:  en ? "Colour = hub"  : "색 = 소속 허브",
      line:   en ? "Line = link"   : "선 = 연결",
    },
    scope: {
      home:    en ? "{hubs} hubs and the links between them"                       : "허브 {hubs}개와 허브 사이의 연결",
      post:    en ? "Up to 12 of the {n} notes linked to this one, most-connected first" : "이 노트와 이어진 노트 {n}개 중 연결이 많은 순으로 최대 12개",
      postAll: en ? "All {n} notes linked to this one"                             : "이 노트와 이어진 노트 {n}개 전부",
      postNoN: en ? "The notes linked to this one"                                 : "이 노트와 이어진 노트들",
      folder:  en ? "Up to 10 notes from this hub"                                 : "이 허브의 노트 최대 10개",
      sub:     en ? "Up to 10 notes from this section"                             : "이 중분류의 노트 최대 10개",
      tag:     en ? "Up to 10 notes with this tag"                                 : "이 태그가 붙은 노트 최대 10개",
      demo:    en ? "Example — one note and its neighbours"                        : "예시 — 노트 하나와 그 주변 이웃",
    },
    legend: {
      color:    en ? "Colour = the hub it belongs to"                              : "색 = 그 노트가 속한 허브",
      onecolor: en ? "Every circle here belongs to the same hub, so they share one colour" : "이 화면의 원은 모두 같은 허브라 색이 하나입니다",
      hubcolor: en ? "Colour = the hub (10-colour palette, so a few hubs share one)": "색 = 허브 (팔레트가 10색이라 일부 허브는 색을 공유합니다)",
      center:   en ? "The larger circle in the middle is the note you are on (same colour rule as the rest)" : "가운데의 더 큰 원 = 지금 보고 있는 노트 (색 규칙은 다른 원과 같습니다)",
      size:     en ? "Circle size = notes in that hub (log scale, so only large gaps show; hover a circle for the exact count)" : "원 크기 = 그 허브의 노트 수 (로그 비례라 큰 차이만 드러납니다. 원에 커서를 올리면 정확한 수)",
      line:     en ? "Line = the two notes are linked"                             : "선 = 두 노트가 이어져 있음",
      hubline:  en ? "Line = at least one note link crosses these two hubs"        : "선 = 두 허브 사이에 노트 링크가 하나 이상 있음",
      linesub:  en ? "Links are computed at build time from the [[wiki-links]] I wrote, plus same-topic and shared-tag neighbours" : "연결은 본문에 쓴 [[링크]]에 같은 주제 이웃과 같은 태그 노트를 더해 빌드가 계산합니다",
      click:    en ? "Click a circle to open that page"                            : "원을 누르면 그 문서로 이동합니다",
      hubclick: en ? "Click a circle to open that hub"                             : "원을 누르면 그 허브의 문서 목록으로 이동합니다",
      clickdemo: en ? "Clicking a circle opens that page — the drawing above is a still example, so it does not respond to clicks." : "원을 누르면 그 문서로 이동합니다 — 위 그림은 설명용 정지 이미지라 눌러도 반응하지 않습니다.",
      hover:    en ? "Hover a circle to light up only its links"                   : "원 위에 커서를 올리면 그 노트의 연결만 밝아집니다",
      hubhover: en ? "Hover a circle to light up only its links"                   : "원 위에 커서를 올리면 그 허브의 연결만 밝아집니다",
    },
    featnote: {
      head: en ? "Explore the knowledge system" : "지식 시스템 둘러보기",
      body: en ? "{notes} interlinked notes across {hubs} hubs — pick a domain below and go in." : "허브 {hubs}개에 걸친 상호연결 노트 {notes}개 — 아래에서 분야별로 들어가 보세요.",
    },
  }
}

const GLYPH = {
  // SOURCE: 겹친 마크다운 3장 + [[ ]] 표식
  source: `<svg class="hs-svg" viewBox="0 0 56 40" aria-hidden="true">
    <rect x="8" y="5" width="26" height="24" rx="2.5" fill="var(--panel-2)" stroke="var(--line)"/>
    <rect x="13" y="8" width="26" height="24" rx="2.5" fill="var(--panel-2)" stroke="var(--line)"/>
    <rect x="18" y="11" width="26" height="24" rx="2.5" fill="var(--panel)" stroke="var(--line)"/>
    <circle cx="11.5" cy="8.5" r="1.8" fill="${hueHex('sky')}"/>
    <circle cx="16.5" cy="11.5" r="1.8" fill="${hueHex('coral')}"/>
    <circle cx="21.5" cy="14.5" r="1.8" fill="${hueHex('lime')}"/>
    <path d="M24 19v9M26 19v9M38 19v9M40 19v9" stroke="var(--text-faint)" stroke-width="1.1" fill="none"/>
    <path d="M29 23.5h6" stroke="var(--text-faint)" stroke-width="1.1"/>
  </svg>`,
  // BUILD: 깔때기 — 6가닥 들어가 3가닥 나오고, 1가닥은 ×로 끊긴다(비공개 노트 게이트)
  build: `<svg class="hs-svg" viewBox="0 0 56 40" aria-hidden="true">
    <path d="M3 7h14M3 12h14M3 17h14M3 22h14M3 27h14M3 32h14" stroke="var(--line)" stroke-width="1.1"/>
    <path d="M19 5L33 16v7L19 34Z" fill="var(--panel-2)" stroke="var(--line)" stroke-width="1.1"/>
    <path d="M35 16h18M35 19.5h18M35 23h18" stroke="var(--accent)" stroke-width="1.1"/>
    <path d="M26 31v5h11" stroke="var(--text-faint)" stroke-width="1" stroke-dasharray="2 2" fill="none"/>
    <path d="M39 33l4.5 4.5M43.5 33L39 37.5" stroke="var(--text-faint)" stroke-width="1.1"/>
  </svg>`,
  // DATA: 생성 데이터 브릭 + AUTO 배지
  data: `<svg class="hs-svg" viewBox="0 0 56 40" aria-hidden="true">
    <rect x="7" y="7" width="42" height="26" rx="6" fill="var(--panel-2)" stroke="var(--line)"/>
    <g fill="var(--text-faint)">
      <circle cx="14" cy="17" r="1"/><circle cx="20" cy="17" r="1"/><circle cx="26" cy="17" r="1"/><circle cx="32" cy="17" r="1"/>
      <circle cx="14" cy="22" r="1"/><circle cx="20" cy="22" r="1"/><circle cx="26" cy="22" r="1"/><circle cx="32" cy="22" r="1"/>
      <circle cx="14" cy="27" r="1"/><circle cx="20" cy="27" r="1"/><circle cx="26" cy="27" r="1"/><circle cx="32" cy="27" r="1"/>
    </g>
    <text class="hs-auto" x="45" y="14" text-anchor="end">AUTO</text>
  </svg>`,
  // RENDER: 이 페이지 자신의 축소도 — 우측 열에만 그래프. 시선을 실제 레일로 넘기는 다리.
  render: `<svg class="hs-svg" viewBox="0 0 56 40" aria-hidden="true">
    <rect x="4" y="5" width="48" height="30" rx="3" fill="var(--panel-2)" stroke="var(--line)"/>
    <path d="M4 11h48" stroke="var(--line)"/>
    <rect x="7" y="14" width="8" height="18" rx="1.5" fill="var(--line-soft)"/>
    <rect x="17" y="14" width="20" height="18" rx="1.5" fill="var(--line-soft)"/>
    <path d="M43 18l4 5-5 5" stroke="var(--accent)" stroke-width="1" fill="none"/>
    <circle cx="43" cy="18" r="1.6" fill="var(--accent)"/><circle cx="47" cy="23" r="1.6" fill="var(--accent)"/><circle cx="42" cy="28" r="1.6" fill="var(--accent)"/>
  </svg>`,
  // SHIP: 감사 게이트 → 지구본. 실패 가지는 ×로 끊긴다.
  ship: `<svg class="hs-svg" viewBox="0 0 56 40" aria-hidden="true">
    <path d="M13 6l8 3v10c0 6-8 10-8 10S5 25 5 19V9Z" fill="var(--panel-2)" stroke="var(--line)" stroke-width="1.1"/>
    <path d="M9.5 17.5l2.5 2.5 4.5-5" stroke="var(--accent)" stroke-width="1.4" fill="none"/>
    <path d="M23 18h11" stroke="var(--accent)" stroke-width="1.1"/>
    <path d="M31 15l3 3-3 3" stroke="var(--accent)" stroke-width="1.1" fill="none"/>
    <circle cx="44" cy="18" r="8" fill="none" stroke="var(--line)" stroke-width="1.1"/>
    <path d="M36 18h16M44 10c3.5 4 3.5 12 0 16M44 10c-3.5 4-3.5 12 0 16" stroke="var(--line)" stroke-width="1" fill="none"/>
    <path d="M17 30v5h8" stroke="var(--text-faint)" stroke-width="1" stroke-dasharray="2 2" fill="none"/>
    <path d="M27 32.5l4 4M31 32.5l-4 4" stroke="var(--text-faint)" stroke-width="1.1"/>
  </svg>`,
}

/* 데모 그래프 노드 표. [0]이 중심.
   실제 그래프와 같은 결정론 배치: 중심 (196,96), R=68, y축 0.82 압축, -90°부터 72° 간격 5개.
   좌표는 그 식으로 계산해 넣은 값이며 그대로 쓴다. */
const DEMO_NODES = [
  { x: 196.0, y: 96.0,  r: 9, hue: "sky",    o: "1" },
  { x: 196.0, y: 40.2,  r: 6, hue: "pink",   o: "0.86" },
  { x: 260.7, y: 78.8,  r: 6, hue: "coral",  o: "0.86" },
  { x: 236.0, y: 141.1, r: 6, hue: "lime",   o: "0.86" },
  { x: 156.0, y: 141.1, r: 6, hue: "violet", o: "0.86" },
  { x: 131.3, y: 78.8,  r: 6, hue: "mint",   o: "0.86" },
]
// center↔ring0..ring4 (5개) + ring1↔ring2 (1개) = 6개. 부호는 실선 한 종류뿐이다.
const DEMO_EDGES = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [2, 3]]
// 데모 범례가 쓰는 색 목록. [0]이 중심 색인 것은 DEMO_NODES[0]이 중심이기 때문이다.
const DEMO_HUES = [...new Set(DEMO_NODES.map((n) => n.hue))]   // ["sky","pink","coral","lime","violet","mint"]

/* ===== 그래프 레이아웃 (DOM 비의존 순수 함수) =====
   좌표계는 app.js의 graphSVG viewBox "0 0 260 214"와 동일: 중심 (130,100), 반경 74, y축 0.82 압축.

   라벨이 지켜야 할 제약은 둘이다. (세 번째 축은 아래 '보장하지 않는 것' 참조)
   (a) 라벨 ↔ 라벨 : 같은 높이 밴드에 놓이는 두 라벨이 가로로 겹치면 안 된다.  → labelCap(ringLen)
   (b) 라벨 ↔ 노드 원 : 라벨이 '다른 노드의 원'을 침범하면 안 된다.            → labelCaps(...)의 여유 계산

   (a)의 유도: 라벨 baseline = 노드 y + 고정 오프셋이므로 두 라벨의 Δy = 두 노드의 Δy.
     Δy = 121.36·sin(π/n)·|cos m|,  Δx = 148·sin(π/n)·|sin m|   (m = 두 노드 각의 중점)
     · 홀수 n : 정확히 마주보는 쌍이 존재해 Δy=0 → 예산 = 148·sin(180°/n)
     · 짝수 n : 인접 쌍 최소 Δy = 121.36·sin²(180°/n).
                이 값이 7(글리프 높이) 이상이면 인접 쌍은 절대 같은 밴드가 아니므로
                예산 = 148·sin(360°/n)(정확히 마주보는 쌍), 미만이면 그 절반.
     실측: 12노드 → 74 user unit(cap 17셀), 10노드 → 87, 16노드 → 28.3(그래서 링 상한을 12로 잡는다).

   (b)는 반지름이 노드마다 다르므로(허브 지도) 닫힌 식이 없다. 그래서 ringLayout이 만든 실제 좌표에서
   노드마다 직접 계산한다. 이것이 v2에서 EN 홈의 'Agent Engineering' 라벨이 'missions' 원을
   12.7 × 4.9 user unit 덮은 원인이었다(라벨↔라벨만 검사했기 때문). */
export const RING_MAX = 12                      // post 라우트 이웃 표시 상한
const CHAR_UNIT = 3.9                           // JetBrains Mono 6.5px 1글자 폭(user unit)
const GLYPH_ASC = 5.07                          // baseline 위 글리프 높이 (0.78em × 6.5px)
const GLYPH_DESC = 1.43                         // baseline 아래 글리프 깊이 (0.22em × 6.5px)
const CJK = /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿＀-｠]/

// 한글·CJK 1자 = 2셀, 그 외 1자 = 1셀
export const cellWidth = (s) => Array.from(String(s == null ? "" : s)).reduce((a, ch) => a + (CJK.test(ch) ? 2 : 1), 0)

// (a) 라벨↔라벨 예산에서 나오는 폭 상한(셀).
export function labelCap(ringLen) {
  const n = Number(ringLen) || 0
  if (n < 3) return 20
  const d = (deg) => Math.sin((deg * Math.PI) / 180)
  const budget = n % 2
    ? 148 * d(180 / n)
    : (121.36 * d(180 / n) ** 2 < 7 ? 74 : 148) * d(360 / n)
  return Math.max(5, Math.min(20, Math.floor((budget * 0.92) / CHAR_UNIT)))   // 0.92 = 안전 여유
}

/* (a)와 (b)를 합친 **노드별** 폭 상한. { [id]: cap } 을 돌려준다.
   opts = { ringLen, radiusOf, dyRing, dyCenter = 17 }
     ringLen  : 중심을 뺀 링 노드 수 (= ringLayout의 ring.length)
     radiusOf : (node) => 그 노드의 원 반지름
     dyRing   : 링 라벨 baseline 오프셋(노드 y 기준)   — 그래프당 하나의 상수
     dyCenter : 중심 라벨 baseline 오프셋               — 기본 17
   라벨 글리프 밴드는 [baseline - GLYPH_ASC, baseline + GLYPH_DESC].
   그 밴드와 세로로 겹치는 다른 노드 원까지의 가로 여유가 라벨 반폭을 제한한다. */
export function labelCaps(nodes, pos, opts) {
  const o = opts || {}
  const base = labelCap(o.ringLen)
  const radiusOf = typeof o.radiusOf === "function" ? o.radiusOf : () => 5
  const dyRing = Number(o.dyRing) || 13
  const dyCenter = o.dyCenter === undefined ? 17 : Number(o.dyCenter)
  const out = {}
  for (const a of nodes) {
    const pa = pos[a.id]; if (!pa) continue
    const by = pa.y + (pa.center ? dyCenter : dyRing)
    let lim = Infinity
    for (const b of nodes) {
      if (b.id === a.id) continue
      const pb = pos[b.id]; if (!pb) continue
      const rb = radiusOf(b)
      // 세로로 안 겹치면 이 원은 이 라벨을 제한하지 않는다
      if (Math.min(by + GLYPH_DESC, pb.y + rb) - Math.max(by - GLYPH_ASC, pb.y - rb) <= 0) continue
      lim = Math.min(lim, 2 * (Math.abs(pa.x - pb.x) - rb))
    }
    const clear = lim === Infinity ? 20 : Math.floor(lim / CHAR_UNIT)
    out[a.id] = Math.max(4, Math.min(pa.center ? Math.min(base, 12) : base, clear))
  }
  return out
}

// semantic=true면 '·'/공백에서 의미 단위로 먼저 자른다(허브 단축명 전용).
export function clampLabel(t, cap, semantic) {
  const s = String(t == null ? "" : t)
  if (cellWidth(s) <= cap) return s
  if (semantic) {
    const cut = s.search(/[· ]/)
    if (cut > 0 && cellWidth(s.slice(0, cut)) <= cap) return s.slice(0, cut)
  }
  let out = ""
  for (const ch of s) { if (cellWidth(out + ch) > cap - 2) break; out += ch }
  return out + "…"
}

// 허브 반지름: 노트 수의 로그를 5~11에 정규화. 12허브 실측 5.0~11.0 / 서로 다른 값 9개.
export function hubRadius(nodes) {
  const cs = nodes.map((n) => Math.max(1, n.count || 1))
  const lo = Math.log(Math.min(...cs)), hi = Math.log(Math.max(...cs)), span = hi - lo
  const r = (n) => (span <= 0 ? 8 : 5 + (6 * (Math.log(Math.max(1, n.count || 1)) - lo)) / span)
  return { r, maxR: Math.max(...nodes.map(r)) }
}

// 중심 1 + 나머지를 타원 링에 균등 배치. app.js graphData가 이 함수를 쓴다.
export function ringLayout(nodes, centerId) {
  const cx = 130, cy = 100, R = 74, pos = {}
  const ring = nodes.filter((n) => n.id !== centerId)
  if (centerId) pos[centerId] = { x: cx, y: cy, center: true }
  ring.forEach((n, i) => {
    const a = (i / Math.max(1, ring.length)) * Math.PI * 2 - Math.PI / 2
    pos[n.id] = { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * 0.82, center: false }
  })
  return { pos, ring }
}

export function stackStrip(en) {
  const c = copy(en), v = numbers(en)
  const chips = [c.strip.spa, c.strip.noframework, c.strip.pipeline, c.strip.counts]
    .map((s) => `<span class="sschip">${esc(fill(s, v))}</span>`).join("")
  return `<div class="stackstrip">${chips}<button type="button" class="sslink" data-scroll="how">${esc(c.strip.jump)}</button></div>`
}

export function howSection(en) {
  const c = copy(en), v = numbers(en)

  // 1) 5단 파이프라인 — 순서 고정. 커넥터 화살표는 CSS .how-stage::after가 그린다(마크업 없음).
  const STAGES = ["source", "build", "data", "render", "ship"]
  const flow = STAGES.map((k) => `<div class="how-stage">${GLYPH[k]}`
    + `<div class="hs-k">${esc(c.stage[k].key)}</div>`
    + `<div class="hs-t">${esc(c.stage[k].title)}</div>`
    + `<div class="hs-d">${esc(fill(c.stage[k].desc, v))}</div>`
    + `</div>`).join("")

  // 2) 야간 도트 스트립 — STATS.daily(14칸, 빌드 시 앵커 고정). 비어 있으면 블록 자체를 렌더하지 않는다.
  const d = Array.isArray(STATS.daily) ? STATS.daily : []
  let night = ""
  if (d.length) {
    const dots = d.map((x, i) => {
      const tip = esc(fill(x.on ? c.night.on : c.night.off, { iso: x.iso }))
      // 빈 원의 stroke는 var(--text-faint) — var(--line)은 대비 1.30:1(다크)/1.28:1(라이트)이라 보이지 않는다 (R3).
      const paint = x.on ? `fill="var(--accent)"` : `fill="none" stroke="var(--text-faint)" stroke-width="1.2"`
      return `<circle cx="${12 + i * 18}" cy="13" r="4.2" ${paint}><title>${tip}</title></circle>`
    }).join("")
    night = `<div class="how-night"><div class="hn-lab">${esc(c.night.label)}</div>`
      + `<svg class="hn-svg" viewBox="0 0 268 34" role="img" aria-label="${esc(c.night.aria)}">${dots}`
      + `<text class="hn-tick" x="12" y="30" text-anchor="middle">${esc(d[0].iso.slice(5))}</text>`
      + `<text class="hn-tick" x="246" y="30" text-anchor="middle">${esc(d[d.length - 1].iso.slice(5))}</text>`
      + `</svg><div class="hn-cap">${esc(c.night.caption)}</div></div>`
  }

  // 3) 증명 칩 4개 — 전부 목적지를 가진다. diagramId가 비면 그 칩만 빠진다.
  const facts = [
    { skip: !STATS.diagramId, tag: "a", attr: `href="#p=${esc(STATS.diagramId)}"`, n: nf(STATS.diagrams, en), l: c.fact.diagrams },
    { skip: false, tag: "a", attr: `href="#f=glossary"`, n: nf(STATS.terms, en), l: c.fact.terms },
    { skip: false, tag: "button", attr: `type="button" data-action="lang"`, n: nf(STATS.translated, en), l: c.fact.translated },
    { skip: false, tag: "button", attr: `type="button" data-scroll="gxblock" data-gx-open`, n: nf(STATS.linkPairs, en), l: c.fact.links },
  ].filter((f) => !f.skip)
    .map((f) => `<${f.tag} class="fact" ${f.attr}><b>${esc(f.n)}</b><span>${esc(f.l)}</span></${f.tag}>`).join("")

  // 4) 그래프 가이드 — 기본 접힘(모든 화면 폭에서 동일). 상태는 localStorage에만 남는다.
  //    데모 범례에는 그림과 '같은 배열'인 DEMO_HUES를 넘긴다 → 스와치 색이 그림과 어긋날 수 없다.
  let open = false
  try { open = localStorage.getItem("cosmos-gx") === "1" } catch (e) {}
  const gx = `<div class="gx-block" id="gxblock">`
    + `<button type="button" class="gx-tog" data-gx aria-expanded="${open ? "true" : "false"}" aria-controls="gxbody">`
    + `<span>${esc(c.gx.head)}</span><span class="gx-car" aria-hidden="true">${open ? "▴" : "▾"}</span></button>`
    + `<div class="gx-body" id="gxbody"${open ? "" : " hidden"}>`
    + `<div class="gx-hint gx-mobile">${esc(c.gx.mobile)}</div>`
    + `<p class="gx-where">${esc(fill(c.gx.where, v))}</p>`
    + `<div class="gx-demolab">${esc(c.gx.demolab)}</div>`
    + graphGuideSVG(en)
    + `<div class="gx-leadnote">${esc(c.gx.leadnote)}</div>`
    + graphLegend({ kind: "demo" }, en, { hover: false, meta: { hueList: DEMO_HUES } })
    + `</div></div>`

  return `<section class="how" id="how"><div class="how-head">${esc(c.how.head)}</div>`
    + `<div class="how-flow">${flow}</div>${night}`
    + `<div class="how-facts">${facts}</div>${gx}</section>`
}

export function graphGuideSVG(en) {
  const c = copy(en)
  // 색·스트로크·불투명도 표현식은 §C5 graphSVG의 노드와 '글자 그대로 동일'하다.
  // 중심을 구별하는 것은 오직 반지름(9 vs 6)과 위치와 불투명도(1 vs 0.86)뿐 — 실물이 그러하기 때문이다.
  const edges = DEMO_EDGES.map(([a, b]) =>
    `<line class="gg-e" x1="${DEMO_NODES[a].x}" y1="${DEMO_NODES[a].y}" x2="${DEMO_NODES[b].x}" y2="${DEMO_NODES[b].y}"/>`).join("")
  const dots = DEMO_NODES.map((n) =>
    `<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${hueHex(n.hue)}" stroke="var(--page-bg)" stroke-width="1.5" opacity="${n.o}"/>`).join("")
  const leads = `<path class="gg-lead" d="M88 109L184 98"/>`
    + `<path class="gg-lead" d="M196 22L196 32"/>`
    + `<path class="gg-lead" d="M333 129L256 113"/>`
  const labs = `<text class="gg-lab" x="8" y="112" text-anchor="start">${esc(c.call.center)}</text>`
    + `<text class="gg-lab" x="196" y="18" text-anchor="middle">${esc(c.call.color)}</text>`
    + `<text class="gg-lab" x="412" y="132" text-anchor="end">${esc(c.call.line)}</text>`
  return `<svg class="gx-svg" viewBox="0 0 420 200" role="img" aria-label="${esc(c.gx.aria)}">${edges}${dots}${leads}${labs}</svg>`
}

export function graphScope(route, en, meta = {}) {
  const c = copy(en), v = numbers(en)
  const k = route && route.kind
  if (k === "post") {
    const n = Number(meta.n)
    if (!Number.isFinite(n) || n <= 0) return c.scope.postNoN
    // 잘린 게 없으면 '최대 12개'라고 말하지 않는다(301개 중 169개가 이 경우 — 실측).
    const key = Number(meta.hidden) > 0 ? c.scope.post : c.scope.postAll
    return fill(key, { ...v, n: nf(n, en) })
  }
  if (k === "folder") return c.scope.folder
  if (k === "sub") return c.scope.sub
  if (k === "tag") return c.scope.tag
  if (k === "demo") return c.scope.demo
  return fill(c.scope.home, v)
}

export function graphLegend(route, en, opts = {}) {
  const { hover = false, meta = {} } = opts
  const c = copy(en)
  const kind = (route && route.kind) || "home"
  /* 이 화면에 실제로 그려진 색 목록. 호출부가 반드시 넘긴다(§C6-A 레일 / §C3-6 데모).
     스와치의 모든 원은 여기서만 색을 받는다 — 범례가 화면에 없는 색을 그리지 않게 하는 유일한 장치다.
     비허브 라우트에서 nodes[0]은 중심 노드이므로 hueList[0]은 곧 중심의 색이다(§C5 graphData 참조). */
  const HL = (Array.isArray(meta.hueList) && meta.hueList.length) ? meta.hueList : ["sky", "coral", "lime"]
  const h0 = hueHex(HL[0]), h1 = hueHex(HL[1] || HL[0]), h2 = hueHex(HL[2] || HL[0])
  const hues = HL.length
  const SW = {
    color:    `<circle cx="6" cy="7" r="4" fill="${h0}"/><circle cx="15" cy="7" r="4" fill="${h1}"/><circle cx="24" cy="7" r="4" fill="${h2}"/>`,
    onecolor: `<circle cx="6" cy="7" r="4" fill="${h0}"/><circle cx="15" cy="7" r="4" fill="${h0}"/><circle cx="24" cy="7" r="4" fill="${h0}"/>`,
    center:   `<circle cx="4" cy="7" r="2.5" fill="${h1}"/><circle cx="15" cy="7" r="5.5" fill="${h0}"/><circle cx="26" cy="7" r="2.5" fill="${h2}"/>`,
    size:     `<circle cx="8" cy="7" r="3" fill="${h0}"/><circle cx="21" cy="7" r="6" fill="${h0}"/>`,
    line:     `<line x1="4" y1="7" x2="26" y2="7" stroke="var(--line)" stroke-width="1.4"/><circle cx="4" cy="7" r="2.4" fill="${h0}"/><circle cx="26" cy="7" r="2.4" fill="${h1}"/>`,
    click:    `<circle cx="9" cy="7" r="4" fill="${h0}"/><path d="M17 3l7 6-3 .5 1.6 3-1.8 .9-1.6-3L17 12Z" fill="var(--text-faint)"/>`,
  }
  const row = (sw, text) => `<div class="gx-row"><svg class="gx-sw" viewBox="0 0 30 14" aria-hidden="true">${sw}</svg><span>${esc(text)}</span></div>`

  let out = `<div class="gx-scope">${esc(graphScope(route, en, meta))}</div>`
  if (kind === "post" || kind === "demo") out += row(SW.center, c.legend.center)
  out += hues >= 2
    ? row(SW.color, kind === "home" ? c.legend.hubcolor : c.legend.color)
    : row(SW.onecolor, c.legend.onecolor)
  if (kind === "home") out += row(SW.size, c.legend.size)
  out += row(SW.line, kind === "home" ? c.legend.hubline : c.legend.line)
  out += `<div class="gx-sub">${esc(c.legend.linesub)}</div>`
  if (kind === "demo") {
    // 데모 그림은 목업이라 클릭·호버 반응이 없다. 그래도 '원은 누를 수 있다'는 정보 자체는
    // 좁은 화면에서 유일하게 보이는 그래프가 이것이므로 버리지 않고, 문구가 스스로 예외를 밝힌다.
    out += row(SW.click, c.legend.clickdemo)
  } else {
    // 홈은 허브 지도다 — 원이 노트가 아니라 허브이고 목적지가 '#f='(허브 문서 목록)이며,
    // 호버 시 밝아지는 것도 '그 노트의 연결'이 아니라 허브 간 엣지다. 그래서 hubcolor/hubline과
    // 정확히 같은 형태로 분기한다. 한쪽만 분기하면 같은 그림을 두 어휘로 설명하게 된다(R2).
    out += row(SW.click, kind === "home" ? c.legend.hubclick : c.legend.click)
    if (hover) out += `<div class="gx-hint">${esc(kind === "home" ? c.legend.hubhover : c.legend.hover)}</div>`
  }
  return out
}

export function featNote(en) {
  const c = copy(en), v = numbers(en)
  return `<section class="feat-note"><h2>${esc(c.featnote.head)}</h2><p>${esc(fill(c.featnote.body, v))}</p></section>`
}

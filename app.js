// Cosmos Knowledge — 단독 SPA. Claude Design 충실 재현 + 실제 md 렌더(marked).
import {
  SITE, HUE, FOLDERS, GROUPS, TERMS, STATS,
  postById, folderById, subById, leadPost, allTags, postsByTag,
  backlinksOf, recentPosts, searchPosts, resolveLink, localGraph,
} from "./garden-data.js"
import { createGalaxy } from "./galaxy-field.js"
import {
  stackStrip, howSection, featNote, graphLegend,
  clampLabel, labelCaps, hubRadius, ringLayout, RING_MAX,
} from "./home-explain.js"

const TOKENS = {
  dark: {
    "--page-bg": "radial-gradient(125% 115% at 64% 22%, #1c2440 0%, #11151f 46%, #080a10 100%)",
    "--panel": "rgba(15,17,25,0.74)", "--panel-2": "rgba(24,27,38,0.60)", "--rail": "rgba(13,15,22,0.40)",
    "--glass": "rgba(16,18,27,0.72)", "--text": "#EEF1F8", "--text-dim": "rgba(238,241,248,0.66)",
    "--text-faint": "rgba(238,241,248,0.58)", "--line": "rgba(255,255,255,0.10)", "--line-soft": "rgba(255,255,255,0.055)",
    "--accent": "#F4C77B", "--link": "#BBD6F2", "--chip": "rgba(255,255,255,0.07)", "--shadow": "0 18px 50px -24px rgba(0,0,0,0.62)",
  },
  light: {
    "--page-bg": "radial-gradient(125% 115% at 64% 20%, #fdfbf6 0%, #f4eee2 56%, #ebe3d2 100%)",
    "--panel": "rgba(255,253,250,0.88)", "--panel-2": "rgba(255,255,255,0.78)", "--rail": "rgba(255,253,247,0.6)",
    "--glass": "rgba(255,255,255,0.78)", "--text": "#1d2230", "--text-dim": "rgba(29,34,48,0.7)",
    "--text-faint": "rgba(29,34,48,0.60)", "--line": "rgba(20,24,40,0.12)", "--line-soft": "rgba(20,24,40,0.07)",
    "--accent": "#C8821F", "--link": "#2b46f5", "--chip": "rgba(20,24,40,0.05)", "--shadow": "0 18px 50px -30px rgba(40,50,80,0.30)",
  },
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))
const hueHex = (k) => HUE[k] || "#CBE3F4"
const root = document.getElementById("root")
// 로컬(server.mjs)에서만 /api 존재 → 공개 정적 호스트에선 폴링/로그 생략(404 콘솔 노이즈 방지)
const IS_LOCAL = location.protocol === "file:" || /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?)/.test(location.hostname)

/* ---------- 계층 배지 ---------- */
const layerTag = (l) => (l && T().layer[l]) ? `<span class="lbadge l-${l}">${T().layer[l]}</span>` : ""

/* ---------- 내부 링크 엔진 ---------- */
// marked 전: [[슬러그|라벨]] → 내부 앵커. 코드블록/인라인코드는 건드리지 않음. 미정의는 검색용 span.
function linkifyWikilinks(md) {
  const parts = String(md || "").split(/(```[\s\S]*?```)/g)
  return parts.map((seg, i) => {
    if (i % 2 === 1) return seg
    return seg.split(/(`[^`]*`)/g).map((s, j) => {
      if (j % 2 === 1) return s
      return s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, tgt, lab) => {
        // 옵시디언 표 관례: 표 안에서는 [[대상\|라벨]]로 파이프를 이스케이프 → 끝 백슬래시 제거
        const target = tgt.trim().replace(/\\+$/, ""), label = (lab || target).trim()
        const id = resolveLink(target)
        return id ? `[${label}](#p=${id})` : `<a class="wl undef" data-q="${esc(target)}">${esc(label)}</a>`
      })
    }).join("")
  }).join("")
}
// marked 후: 외부 http(s) 링크 비활성화 (내부 문서 전용 원칙)
const EXT_ALLOW = /^https?:\/\/([a-z0-9-]+\.)*(github\.com|github\.io|linkedin\.com|vercel\.app)(\/|$)/i
function neutralizeExternalLinks(container) {
  container.querySelectorAll('a[href^="http://"],a[href^="https://"]').forEach((a) => {
    if (EXT_ALLOW.test(a.href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; return } // 포트폴리오 증빙 링크는 허용
    const span = document.createElement("span"); span.className = "ext-off"
    span.textContent = a.textContent; span.title = "외부 링크 비활성 (Cosmos 내부 문서 전용)"
    a.replaceWith(span)
  })
}
// 용어 자동 링크: term 페이지 aliases가 본문에 나오면 첫 등장 1회를 내부 링크로. 코드/헤딩/기존링크 제외.
function findWord(text, term) {
  if (/^[\x00-\x7f]+$/.test(term)) {
    const re = new RegExp("(^|[^A-Za-z0-9_])(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![A-Za-z0-9_])", "i")
    const m = re.exec(text); return m ? m.index + m[1].length : -1
  }
  return text.toLowerCase().indexOf(term.toLowerCase())
}
function autolinkTerms(container) {
  if (!TERMS || !TERMS.length) return
  const items = []
  TERMS.forEach((t) => t.terms.forEach((term) => { if (term && term.length >= 2) items.push({ term, id: t.id, len: term.length }) }))
  items.sort((a, b) => b.len - a.len)
  const used = new Set()
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement
      if (!p || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
      if (p.closest("a, code, pre, h1, h2, h3, .mermaid, .excalidraw-embed, .ext-off, .no-autolink")) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const nodes = []; let n; while ((n = walker.nextNode())) nodes.push(n)
  for (const node of nodes) {
    const text = node.nodeValue
    let hit = null
    for (const it of items) { if (used.has(it.id)) continue; const idx = findWord(text, it.term); if (idx >= 0) { hit = { it, idx }; break } }
    if (!hit) continue
    const { it, idx } = hit
    const before = text.slice(0, idx), match = text.slice(idx, idx + it.term.length), after = text.slice(idx + it.term.length)
    const frag = document.createDocumentFragment()
    if (before) frag.appendChild(document.createTextNode(before))
    const a = document.createElement("a"); a.className = "tlink"; a.href = "#p=" + it.id; a.textContent = match
    frag.appendChild(a)
    if (after) frag.appendChild(document.createTextNode(after))
    node.parentNode.replaceChild(frag, node)
    used.add(it.id)
  }
}

let galaxy = null
const state = { theme: "dark", lang: "ko", open: {}, search: false, query: "" }
try { state.lang = localStorage.getItem("cosmos-lang") === "en" ? "en" : "ko" } catch (e) {}

/* ---------- i18n: UI 라벨 + 노트 표시 헬퍼 ---------- */
const UI = {
  ko: { explore: "탐색", graph: "그래프 뷰", toc: "목차", backlinks: "들어오는 링크", tags: "태그",
    recent: "최근에 자란 노트", related: "이어지는 노트", search: "검색", find: "찾기",
    night: "밤", day: "낮", notes: "개 노트", conns: "개 연결", tag: "태그",
    noToc: "목차 없음", noResult: "결과가 없어요.", searchHint: "제목 · 요약 · 태그 · 본문으로 찾기",
    searchPh: "제목 · 요약 · 태그…", more: (n) => `＋ ${n}개 더 보기`, fold: "접기",
    notrans: "🌐 이 노트는 아직 영문판이 없어 한국어로 표시됩니다.",
    gxhead: "이 그래프는?", hubs: "개 허브", hubmap: " · 허브 지도", plusMore: (n) => `외 ${n}개`,
    layer: { overview: "요약", deep: "상세", term: "용어" } },
  en: { explore: "EXPLORE", graph: "GRAPH VIEW", toc: "CONTENTS", backlinks: "BACKLINKS", tags: "TAGS",
    recent: "RECENT NOTES", related: "Related notes", search: "Search", find: "Find",
    night: "Dark", day: "Light", notes: " notes", conns: " links", tag: "TAG",
    noToc: "No contents", noResult: "No results.", searchHint: "Search title · summary · tags · body",
    searchPh: "title · summary · tags…", more: (n) => `＋ ${n} more`, fold: "Fold",
    notrans: "🌐 English version not available yet — showing Korean.",
    gxhead: "WHAT IS THIS?", hubs: " hubs", hubmap: " · hub map", plusMore: (n) => `+${n} more`,
    layer: { overview: "Overview", deep: "Deep", term: "Term" } },
}
const T = () => UI[state.lang] || UI.ko
const isEn = () => state.lang === "en"
// 노트/폴더 표시 헬퍼: EN 모드에서 번역이 있으면 영문, 없으면 한국어 폴백
const pt = (p) => (isEn() && p.title_en ? p.title_en : p.title)
const ps = (p) => (isEn() && p.summary_en ? p.summary_en : p.summary)
const pmd = (p) => (isEn() && p.md_en ? p.md_en : p.md)
const fname = (f) => (isEn() ? (f.en || f.name) : f.name)
const fnameById = (fid) => { const f = folderById(fid); return f ? fname(f) : fid }
const sname = (s) => (isEn() ? (s.slug ? s.slug.charAt(0).toUpperCase() + s.slug.slice(1) : s.name) : s.name)

// 13개 허브를 GROUPS(config/hub-groups.json)에 따라 4개+기타로 묶는다. content/**는 건드리지 않는
// 표시 전용 재배열 — GROUPS가 비어 있으면(폴백) null을 반환해 호출부가 기존 단일 그리드로 되돌아간다.
function folderGroups() {
  if (!GROUPS || !GROUPS.length) return null
  const used = new Set()
  const groups = GROUPS.map((g) => {
    const folders = (g.hubs || []).map(folderById).filter(Boolean)
    folders.forEach((f) => used.add(f.id))
    return { slug: g.slug, label: g.label, en: g.en, color: g.color, folders }
  }).filter((g) => g.folders.length)
  const rest = FOLDERS.filter((f) => !used.has(f.id))
  if (rest.length) groups.push({ slug: "others", label: "기타", en: "Others", color: "#C2CCD8", folders: rest })
  return groups
}

function applyTheme(t) {
  const tk = TOKENS[t] || TOKENS.dark
  for (const k in tk) document.documentElement.style.setProperty(k, tk[k])
  document.documentElement.setAttribute("data-theme", t)
  if (galaxy) galaxy.setTheme(t)
}

function parseRoute() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ""))
  if (!h || h === "home") return { kind: "home" }
  const [k, ...rest] = h.split("=")
  const v = rest.join("=")
  if (k === "f") return { kind: "folder", id: v }
  if (k === "s") return { kind: "sub", id: v }
  if (k === "p") return { kind: "post", id: v }
  if (k === "t") return { kind: "tag", id: v }
  return { kind: "home" }
}

/* ---------- partials ---------- */
function header(route) {
  let crumb = `<a href="#home">Cosmos</a>`
  if (route.kind === "folder") { const f = folderById(route.id); if (f) crumb += ` <span>/</span> <span>${esc(fname(f))}</span>` }
  if (route.kind === "sub") { const s = subById(route.id); if (s) { const f = folderById(s.folderId); crumb += ` <span>/</span> <a href="#f=${f.id}">${esc(fname(f))}</a> <span>/</span> <span>${esc(sname(s))}</span>` } }
  if (route.kind === "post") { const p = postById(route.id); if (p) crumb += ` <span>/</span> <a href="#f=${p.folderId}">${esc(fnameById(p.folderId))}</a> <span>/</span> <span>${esc(pt(p))}</span>` }
  if (route.kind === "tag") crumb += ` <span>/</span> <span>#${esc(route.id)}</span>`
  return `<header class="topbar"><div class="topbar-in">
    <a class="brand" href="#home"><b>Cosmos Knowledge</b><span>A GALAXY OF NOTES</span></a>
    <nav class="crumbs">${crumb}</nav>
    <div class="right">
      <button class="pill menu-btn" data-action="menu" aria-label="${isEn() ? "Open navigation" : "탐색 열기"}">☰</button>
      <button class="pill" data-action="search" aria-label="${isEn() ? "Search" : "검색"}">${T().search} <kbd>/</kbd></button>
      <button class="pill" data-action="lang" aria-label="${isEn() ? "Switch language" : "언어 전환"}" title="한국어 / English"><span>${isEn() ? "🌐 EN" : "🌐 한"}</span></button>
      <button class="pill" data-action="theme" aria-label="${isEn() ? "Toggle theme" : "테마 전환"}"><span class="sun"></span><span>${state.theme === "dark" ? T().night : T().day}</span></button>
    </div>
  </div></header>`
}

const NAV_LIMIT = 8
function navPosts(s, route) {
  const showAll = (state.showAll || {})[s.id]
  const shown = showAll ? s.posts : s.posts.slice(0, NAV_LIMIT)
  const rest = s.posts.length - shown.length
  const items = shown.map((p) =>
    `<a class="exp-post ${route.id === p.id ? "active" : ""}" href="#p=${p.id}" title="${esc(pt(p))}"><span class="pdot"></span><span class="pt">${esc(pt(p))}</span></a>`).join("")
  const more = rest > 0 ? `<button class="exp-more" data-more="${s.id}">${T().more(rest)}</button>`
    : (showAll && s.posts.length > NAV_LIMIT ? `<button class="exp-more" data-more="${s.id}">${T().fold}</button>` : "")
  return `<div class="exp-kids">${items}${more}</div>`
}
function folderRow(f, route, activeFolder) {
  const open = state.open[f.id] ?? (f.id === activeFolder)
  const count = f.subs.reduce((a, s) => a + s.posts.length, 0)
  return `<div class="exp-folder" style="--hue:${hueHex(f.hue)}">
    <div class="row ${open ? "open" : ""}" data-toggle="${f.id}">
      <span class="chev">▶</span><span class="dot"></span>
      <a class="nm" href="#f=${f.id}">${esc(fname(f))}</a><span class="ct">${count}</span>
    </div>
    ${open ? `<div class="exp-kids">${f.subs.map((s) => {
      const so = state.open[s.id] ?? (route.kind === "post" ? postById(route.id)?.subId === s.id : route.id === s.id)
      return `<div class="exp-sub">
        <div class="row ${so ? "open" : ""}" data-toggle="${s.id}">
          <span class="chev">▶</span><a class="nm" href="#s=${s.id}">${esc(sname(s))}</a><span class="ct">${s.posts.length}</span>
        </div>
        ${so ? navPosts(s, route) : ""}
      </div>`
    }).join("")}</div>` : ""}
  </div>`
}
function explorer(route) {
  const activeFolder = route.kind === "folder" ? route.id : route.kind === "sub" ? subById(route.id)?.folderId : route.kind === "post" ? postById(route.id)?.folderId : null
  const groups = folderGroups()
  const body = groups
    ? groups.map((g) => `<div class="exgroup-head">${esc(isEn() ? g.en : g.label)}</div>${g.folders.map((f) => folderRow(f, route, activeFolder)).join("")}`).join("")
    : FOLDERS.map((f) => folderRow(f, route, activeFolder)).join("")
  return `<aside class="rail exrail kg-scroll exrail-box">
    <div class="railhead">${T().explore}</div>
    ${body}
  </aside>`
}

function graphData(route) {
  let ids = [], centerId = null, hub = false, hidden = 0, nodes = null
  if (route.kind === "post") {
    const g = localGraph(route.id); centerId = route.id
    // 연결도 내림차순 상위 RING_MAX + 중심. 자르는 기준을 명시해 '무엇이 남는가'의 정당성을 확보한다.
    const deg = (id) => { const p = postById(id); return p ? (p.links || []).length + backlinksOf(id).length : 0 }
    const rest = g.nodes.map((n) => n.id).filter((id) => id !== route.id)
      .sort((a, b) => deg(b) - deg(a) || (a < b ? -1 : 1))   // 동점 tie-break = 재현성
    hidden = Math.max(0, rest.length - RING_MAX)
    ids = [route.id, ...rest.slice(0, RING_MAX)]             // ← nodes[0] = 중심 (범례 hueList[0]의 근거)
  } else if (route.kind === "folder") {
    const f = folderById(route.id); ids = f ? f.subs.flatMap((s) => s.posts).slice(0, 10).map((p) => p.id) : []
  } else if (route.kind === "sub") {
    const s = subById(route.id); ids = s ? s.posts.slice(0, 10).map((p) => p.id) : []
  } else if (route.kind === "tag") {
    ids = postsByTag(route.id).slice(0, 10).map((p) => p.id)
  } else {
    // 홈: 허브 지도. 노드=허브(폴더), 엣지=허브 간 교차링크가 1개 이상 존재하는 쌍(STATS.hubEdges).
    hub = true
    nodes = FOLDERS.map((f) => ({
      id: f.id, title: f.name, title_en: f.en || f.name, nav: f.nav || "", hue: f.hue, layer: "",
      count: f.subs.reduce((a, s) => a + s.posts.length, 0),
    }))
  }
  if (!nodes) nodes = ids.map(postById).filter(Boolean)
  const { pos, ring } = ringLayout(nodes, centerId)
  let edges = []
  if (hub) {
    edges = (STATS.hubEdges || []).map((e) => [e[0], e[1]])
  } else {
    const set = new Set(nodes.map((n) => n.id)), seen = new Set()
    nodes.forEach((n) => (n.links || []).forEach((t) => {
      if (set.has(t)) { const k = [n.id, t].sort().join("|"); if (!seen.has(k)) { seen.add(k); edges.push([n.id, t]) } }
    }))
    // 방어용: localGraph 정의상 실제로는 0개가 추가된다(실측 301/301에서 0). 정의가 바뀌어도 고아 노드를 막는다.
    if (centerId) ring.forEach((n) => { const k = [centerId, n.id].sort().join("|"); if (!seen.has(k)) { seen.add(k); edges.push([centerId, n.id]) } })
  }
  return { nodes, pos, ring, edges, centerId, hub, hidden }
}

// data를 넘기면 graphData를 다시 부르지 않는다(asideRight가 범례 meta를 같은 데이터에서 뽑기 위해 넘긴다).
function graphSVG(route, data) {
  const { nodes, pos, ring, edges, centerId, hub, hidden } = data || graphData(route)
  if (nodes.length < 2) return ""
  const es = edges.filter(([a, b]) => pos[a] && pos[b])          // 공개 빌드에서 허브가 사라져도 안전
  const lines = es.map(([a, b]) =>
    `<line class="gedge" data-a="${a}" data-b="${b}" x1="${pos[a].x.toFixed(1)}" y1="${pos[a].y.toFixed(1)}" x2="${pos[b].x.toFixed(1)}" y2="${pos[b].y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>`).join("")
  const hr = hub ? hubRadius(nodes) : null
  const radiusOf = hub ? ((n) => hr.r(n)) : ((n) => (pos[n.id] && pos[n.id].center ? 7 : 5))
  const DY_RING = hub ? Math.round(hr.maxR + 8) : 13             // 그래프 전체에 단 하나의 세로 오프셋
  const caps = labelCaps(nodes, pos, { ringLen: ring.length, radiusOf, dyRing: DY_RING, dyCenter: 17 })
  const base = hub ? "#f=" : "#p="
  const gs = nodes.map((n) => {
    const c = n.id === centerId, p = pos[n.id]
    const r = radiusOf(n)
    const full = hub ? (isEn() ? (n.title_en || n.title) : (n.nav || n.title)) : pt(n)
    const whole = hub ? (isEn() ? (n.title_en || n.title) : n.title) : pt(n)   // 호버·title용 전체 이름
    // 허브 원의 크기는 로그 비례라 중간 허브끼리 눈으로 구분되지 않는다(실측: 12개 중 7개가 지름 2px 안에 몰림).
    // 범례가 그 한계를 자백하는 대신, 정확한 노트 수를 캡션과 네이티브 툴팁이 제공한다.
    const capName = hub ? `${whole} · ${n.count}${T().notes}` : whole
    const short = clampLabel(full, caps[n.id], hub)
    const ly = (p.y + (c ? 17 : DY_RING)).toFixed(1)
    return `<g class="gnode${c ? " center" : ""}" data-id="${n.id}" data-t="${esc(capName)}" data-l="${esc(n.layer || "")}">`
      + `<a href="${base}${n.id}"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(2)}" fill="${hueHex(n.hue)}" stroke="var(--page-bg)" stroke-width="1.5" opacity="${hub ? 0.92 : (c ? 1 : 0.86)}"><title>${esc(capName)}</title></circle></a>`
      + `<text class="glabel" x="${p.x.toFixed(1)}" y="${ly}" text-anchor="middle">${esc(short)}</text>`
      + `</g>`
  }).join("")
  const unit = hub ? T().hubs : T().notes
  const scope = hub ? T().hubmap : ""
  const more = hidden > 0 ? ` · ${T().plusMore(hidden)}` : ""
  const def = `${nodes.length}${unit} · ${es.length}${T().conns}${scope}${more}`
  return `<div class="rail"><div class="railhead">${T().graph}</div>
    <svg class="graphsvg" viewBox="0 0 260 214" style="width:100%;height:auto;display:block;overflow:visible">${lines}${gs}</svg>
    <div class="graph-cap" id="graph-cap" data-default="${esc(def)}">${esc(def)}</div></div>`
}
function asideRight(route) {
  const boxes = []
  { const gd = graphData(route)
    const g = graphSVG(route, gd)
    if (g) {
      boxes.push(g)
      // 범례가 화면에 없는 색을 그리지 않도록, '실제로 그려진 색 목록'을 그대로 넘긴다.
      // Set은 삽입 순서를 유지하므로 post 라우트에서는 hueList[0]이 곧 중심 노드의 색이다.
      const meta = {
        hueList: [...new Set(gd.nodes.map((n) => n.hue))],
        n: gd.ring.length + gd.hidden,                    // 자르기 '전' 이웃 총수
        hidden: gd.hidden,
      }
      boxes.push(`<div class="rail gx-rail"><div class="railhead">${T().gxhead}</div>`
        + graphLegend(route, isEn(), { hover: true, meta })
        + `</div>`)
    } }
  if (route.kind === "post") {
    const p = postById(route.id)
    boxes.push(`<div class="rail" style="--hue:${hueHex(p.hue)}"><div class="railhead">${T().toc}</div><div class="toc" id="toc"></div></div>`)
    const bl = backlinksOf(p.id)
    if (bl.length) boxes.push(`<div class="rail" style="--hue:${hueHex(p.hue)}"><div class="railhead">${T().backlinks}</div>${bl.map((b) =>
      `<a class="bl" href="#p=${b.id}"><span class="dot" style="--hue:${hueHex(b.hue)}"></span>${esc(pt(b))}</a>`).join("")}</div>`)
  } else {
    const tags = allTags().slice(0, 16)
    boxes.push(`<div class="rail"><div class="railhead">${T().tags}</div><div class="tagcloud">${tags.map((t) =>
      `<a href="#t=${encodeURIComponent(t.tag)}">#${esc(t.tag)}</a>`).join("")}</div></div>`)
    boxes.push(`<div class="rail"><div class="railhead">${T().recent}</div><div class="recent">${recentPosts(6).map((r) =>
      `<a class="r" href="#p=${r.id}" style="--hue:${hueHex(r.hue)}"><span class="dot"></span><span><span class="t">${esc(pt(r))}</span><span class="m">${esc(fnameById(r.folderId))} · ${esc(r.dateISO)}</span></span></a>`).join("")}</div></div>`)
  }
  return `<aside class="aside">${boxes.join("")}</aside>`
}

/* ---------- post card ---------- */
const pcard = (p) => `<a class="pcard" href="#p=${p.id}" style="--hue:${hueHex(p.hue)}">
  <div class="pm"><span class="dot"></span><span class="f">${esc(fnameById(p.folderId))}</span>${layerTag(p.layer)}<span class="d">${esc(p.dateISO)}</span></div>
  <h3>${esc(pt(p))}</h3><p>${esc(ps(p))}</p>
  <div class="tg">${p.tags.slice(0, 3).map((t) => `<span>#${esc(t)}</span>`).join("")}</div></a>`

/* ---------- 포트폴리오 푸터 ---------- */
function footer() {
  const en = isEn(), S = SITE
  return `<footer class="site-foot"><div class="foot-in">
    <div class="foot-id"><b>${esc(S.author)}</b> · ${en ? esc(S.roleEn) : esc(S.role)}</div>
    <div class="foot-links">
      <a href="${esc(S.github)}" target="_blank" rel="noopener">GitHub</a>
      <a href="mailto:${esc(S.email)}">${esc(S.email)}</a>
      <a href="${esc(S.resume)}" download>${en ? 'Résumé' : '이력서'} (PDF)</a>
    </div>
  </div></footer>`
}

/* ---------- md-hero: 첫 방문자용 매커니즘 선언 (이 화면 = 마크다운 문서) ---------- */
function mdManifesto(en) {
  const n = (x) => (x || 0).toLocaleString(en ? "en-US" : "ko-KR")
  const chips = [
    [n(STATS.notes), en ? "notes" : "노트"],
    [n(STATS.wikilinks), en ? "wiki-links" : "위키링크"],
    [n(STATS.terms), en ? "terms" : "용어"],
    [n(STATS.diagrams), en ? "diagrams" : "다이어그램"],
  ]
  return `<section class="md-hero">
    <div class="mdh-eyebrow">${en ? "THIS IS NOT AN ORDINARY WEBPAGE" : "이 사이트는 보통 웹페이지가 아닙니다"}</div>
    <h2 class="mdh-head">${en ? "Every screen you see here is a <b>Markdown document</b>" : "지금 보시는 모든 화면은 <b>마크다운(.md) 문서</b>입니다"}</h2>
    <p class="mdh-body">${en
      ? `<b>${n(STATS.notes)} notes</b> written by <b>TaeHyang Kwon</b> live here as plain .md files, and a self-built engine renders them into this screen. It began with Quartz — then the engine was rebuilt from scratch. Whatever you open, you are reading one person's actual working documents.`
      : `권태향이 직접 쓴 <b>노트 ${n(STATS.notes)}편</b>이 .md 원본 그대로 살아 있고, 직접 만든 엔진이 그것을 지금 이 화면으로 렌더합니다. Quartz로 시작해 엔진을 통째로 다시 만들었습니다 — 어떤 페이지를 열어도, 당신은 한 사람의 실제 작업 문서를 읽고 있는 것입니다.`}</p>
    <div class="mdh-chips">${chips.map(([v, k]) => `<span class="mdh-chip"><b>${v}</b> ${k}</span>`).join("")}</div>
  </section>`
}

/* ---------- views ---------- */
function viewHome() {
  const en = isEn(), S = SITE
  const feat = [
    { id: 'projects/deep/graphify-runs', e: '🕸️', k: 'GraphRAG', t: 'Graphify GraphRAG',
      d: en ? 'A knowledge/code graph with graphify + local Ollama — 168 nodes, 354 edges, $0 cost, 3.8× token savings.'
            : 'graphify + 로컬 Ollama로 지식·코드 그래프 구축 — 168노드·354엣지·$0·토큰 3.8배 절감.' },
    { id: 'projects/deep/agent-office-v2', e: '🤖', k: en ? 'Multi-agent' : '멀티에이전트', t: 'Agent Office v2',
      d: en ? 'A 4-floor AI office where role-split agents plan, build, and sign off work (self-test 147 PASS).'
            : '역할 분담 에이전트가 기획·빌드·결재하는 4층 AI 오피스(셀프테스트 147 PASS).' },
    { id: 'projects/deep/cosmos-knowledge-build', e: '🌌', k: en ? 'This site' : '이 사이트', t: 'Cosmos Knowledge',
      d: en ? 'The site you are reading — a self-built SPA: build pipeline, graph view, wiki-links, i18n, nightly automation.'
            : '지금 보는 이 사이트 — 직접 만든 SPA: 빌드 파이프라인·그래프뷰·위키링크·이중언어·야간 자동화.' },
  ]
  const cta = `<div class="cta-row">
      <a class="cta primary" href="#f=projects">${en ? 'View projects' : '대표 프로젝트 보기'}</a>
      <a class="cta" href="${esc(S.resume)}" download>${en ? 'Résumé (PDF)' : '이력서 (PDF)'}</a>
      <a class="cta" href="${esc(S.github)}" target="_blank" rel="noopener">GitHub</a>
      <a class="cta" href="mailto:${esc(S.email)}">${en ? 'Contact' : '연락'}</a>
    </div>`
  const strip = stackStrip(en)
  const how = howSection(en)
  return `${mdManifesto(en)}
  <section class="phero">
    <div class="pen">${en ? esc(S.roleEn || '') : esc(S.role || '')}</div>
    <h1 class="phero-name">${esc(S.author)}<span class="phero-en">${esc(S.authorEn)}</span></h1>
    <p class="phero-tag">${en ? esc(S.taglineEn) : esc(S.tagline)}</p>
    ${cta}
  </section>
  ${strip}
  <section class="feat">
    <div class="feat-head">${en ? 'Featured work' : '대표 작업'}</div>
    <div class="feat-grid">${feat.map((f) => `<a class="feat-card" href="#p=${f.id}">
      <div class="fc-k"><span class="fc-e">${f.e}</span>${esc(f.k)}</div>
      <div class="fc-t">${esc(f.t)}</div><div class="fc-d">${esc(f.d)}</div></a>`).join("")}</div>
  </section>
  ${how}
  ${featNote(en)}
  ${homeTiles()}`
}
function tileHtml(f) {
  const lead = leadPost(f.id); const count = f.subs.reduce((a, s) => a + s.posts.length, 0)
  return `<a class="tile" href="#f=${f.id}" style="--hue:${hueHex(f.hue)}">
    <div class="th"><span class="dot"></span><h3>${esc(fname(f))}</h3><span class="ct">${count}</span></div>
    <div class="desc">${esc(f.desc)}</div>
    ${lead ? `<div class="lead"><div class="k">${isEn() ? "Featured" : "대표 노트"}</div><div class="t">${esc(pt(lead))}</div><div class="s">${esc(ps(lead))}</div></div>` : ""}
    <div class="chips">${f.subs.map((s) => `<span class="subchip">${esc(sname(s))}</span>`).join("")}</div>
  </a>`
}
function homeTiles() {
  const groups = folderGroups()
  if (!groups) return `<div class="tiles">${FOLDERS.map(tileHtml).join("")}</div>`
  return groups.map((g) => {
    const count = g.folders.reduce((a, f) => a + f.subs.reduce((b, s) => b + s.posts.length, 0), 0)
    return `<section class="tile-group">
      <div class="tile-group-head" style="--hue:${g.color}"><span class="dot"></span><h2>${esc(isEn() ? g.en : g.label)}</h2><span class="ct">${count}</span></div>
      <div class="tiles">${g.folders.map(tileHtml).join("")}</div>
    </section>`
  }).join("")
}

function viewFolder(id) {
  const f = folderById(id); if (!f) return viewHome()
  const count = f.subs.reduce((a, s) => a + s.posts.length, 0)
  return `<section style="--hue:${hueHex(f.hue)}">
    <div class="fhead"><span class="dot"></span><h1>${esc(fname(f))}</h1><span class="ct">${count}${T().notes}</span></div>
    <p class="fdesc">${esc(f.desc)}</p>
    ${f.subs.map((s) => `<div class="subsec">
      <a class="subhead" href="#s=${s.id}"><h2>${esc(sname(s))}</h2><span class="sd">${esc(s.desc)}</span><span class="ct">${s.posts.length}</span></a>
      <div class="pcards">${s.posts.map(pcard).join("")}</div>
    </div>`).join("")}
  </section>`
}

function viewSub(id) {
  const s = subById(id); if (!s) return viewHome()
  const f = folderById(s.folderId)
  return `<section style="--hue:${hueHex(f.hue)}">
    <a class="crumb" href="#f=${f.id}" style="display:inline-block;font-family:var(--mono);font-size:11px;color:var(--text-faint);margin-bottom:6px">← ${esc(fname(f))}</a>
    <div class="fhead"><span class="dot"></span><h1>${esc(sname(s))}</h1></div>
    <p class="fdesc">${esc(s.desc)}</p>
    <div class="pcards">${s.posts.map(pcard).join("")}</div>
  </section>`
}

function viewPost(id) {
  const p = postById(id); if (!p) return viewHome()
  const f = folderById(p.folderId)
  const noTrans = isEn() && !p.md_en
  const html = window.marked ? window.marked.parse(linkifyWikilinks(pmd(p) || "")) : esc(pmd(p) || "")
  const related = (p.links || []).map(postById).filter(Boolean)
  return `<section style="--hue:${hueHex(p.hue)}">
    <article class="post">
      <div class="crumb"><a href="#f=${f.id}">${esc(fnameById(p.folderId))}</a><span>/</span><a href="#s=${p.subId}">${esc(p.subName)}</a></div>
      <h1 class="title">${esc(pt(p))}</h1>
      <div class="meta"><span class="dot"></span>${layerTag(p.layer)}<span>${esc(p.dateISO)}</span><span>·</span><span>${esc(p.read)}</span></div>
      ${p.hero ? `<img class="postHero" src="${esc(p.hero)}" alt="${esc(pt(p))}" loading="lazy">` : ""}
      ${p.audio ? `<div class="audiowrap"><span class="ap-ic">🎙️</span><div class="ap-body"><div class="ap-cap">${isEn() ? "Audio briefing (Korean)" : "오디오로 듣기 — 수진·민호의 브리핑"}</div><audio controls preload="none" src="${esc(p.audio)}"></audio></div></div>` : ""}
      ${noTrans ? `<div class="notrans">${T().notrans}</div>` : ""}
      <div class="md" id="md">${html}</div>
      <div class="taglist">${p.tags.map((t) => `<a href="#t=${encodeURIComponent(t)}">#${esc(t)}</a>`).join("")}</div>
    </article>
    ${related.length ? `<div class="relwrap"><div class="k">${T().related}</div>
      <div class="related">${related.map(pcard).join("")}</div></div>` : ""}
  </section>`
}

function viewTag(tag) {
  const posts = postsByTag(tag)
  return `<section>
    <div class="pen" style="font-weight:600;color:var(--accent)">${T().tag}</div>
    <div class="fhead"><h1>#${esc(tag)}</h1></div>
    <p class="fdesc">${posts.length}${T().notes}</p>
    <div class="pcards">${posts.map(pcard).join("")}</div>
  </section>`
}

function searchOverlay() {
  if (!state.search) return ""
  const res = searchPosts(state.query)
  const body = state.query.trim()
    ? (res.length ? res.map((p) => `<a class="result" href="#p=${p.id}" data-close style="--hue:${hueHex(p.hue)}">
        <span class="dot"></span><div style="min-width:0;flex:1"><div class="t">${esc(pt(p))}</div><div class="s">${esc(ps(p))}</div></div>
        <span class="f">${esc(fnameById(p.folderId))}</span></a>`).join("")
       : `<div class="empty">${T().noResult}</div>`)
    : `<div class="empty">${T().searchHint}</div>`
  return `<div class="searchwrap" data-action="search-bg"><div class="searchbox" data-stop>
    <div class="top"><b>${T().find}</b><input id="searchInput" placeholder="${T().searchPh}" value="${esc(state.query)}"><kbd style="font-family:var(--mono);font-size:10px;color:var(--text-faint);border:1px solid var(--line);border-radius:5px;padding:1px 6px">esc</kbd></div>
    <div class="results kg-scroll">${body}</div>
  </div></div>`
}

/* ---------- diagrams: Mermaid(손그림=Excalidraw 스타일) + Excalidraw 씬 ---------- */
let _mermaid = null
async function ensureMermaid() {
  if (!_mermaid) _mermaid = import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs").then((m) => m.default)
  return _mermaid
}
async function renderDiagrams(container) {
  // Mermaid → handDrawn(엑스칼리드로 손그림 룩)
  const mer = [...container.querySelectorAll("code.language-mermaid")]
  if (mer.length) {
    try {
      const mm = await ensureMermaid()
      mm.initialize({
        startOnLoad: false, securityLevel: "loose", look: "handDrawn",
        theme: state.theme === "dark" ? "dark" : "default",
        fontFamily: "Pretendard, sans-serif",
        themeVariables: { fontSize: "17px" },
        flowchart: { htmlLabels: true, useMaxWidth: true, nodeSpacing: 54, rankSpacing: 62, padding: 12, curve: "basis" },
      })
      mer.forEach((c) => { const pre = c.closest("pre") || c; const d = document.createElement("div"); d.className = "mermaid"; d.textContent = c.textContent; pre.replaceWith(d) })
      await mm.run({ nodes: container.querySelectorAll(".mermaid") })
      fixDiagramReadability(container)
    } catch (e) { console.error("mermaid", e) }
  }
  // Excalidraw 씬(JSON) → SVG 뷰어
  const exc = [...container.querySelectorAll("code.language-excalidraw")]
  for (const c of exc) {
    const pre = c.closest("pre") || c
    const box = document.createElement("div"); box.className = "excalidraw-embed"; box.innerHTML = `<div class="dgloading">Excalidraw 불러오는 중…</div>`
    pre.replaceWith(box)
    try {
      const scene = JSON.parse(c.textContent)
      const { exportToSvg } = await import("https://esm.sh/@excalidraw/excalidraw@0.17.6")
      const svg = await exportToSvg({ elements: scene.elements || [], appState: { ...(scene.appState || {}), exportBackground: false, exportWithDarkMode: state.theme === "dark" }, files: scene.files || null })
      svg.style.maxWidth = "100%"; svg.style.height = "auto"
      box.innerHTML = ""; box.appendChild(svg)
    } catch (e) { box.innerHTML = `<div class="dgloading">✎ Excalidraw 그림 — 씬 렌더 실패(JSON 확인) · <a href="https://excalidraw.com" target="_blank">excalidraw.com에서 열기</a></div>` }
  }
}

/* ---------- 다이어그램 가독성 안전망 ----------
   ① 축소 렌더 감지: SVG가 원본(viewBox) 폭의 80% 미만으로 줄어들면 원본 크기로 복원
      → 부모(.mermaid)가 overflow-x:auto라 가로 스크롤로 보되 글자는 원본 크기 유지.
   ② 대비 자동 보정: 노드 도형의 fill 휘도를 계산해 라벨 색을 검정/흰색으로 강제
      → fill과 글자색이 비슷해 안 읽히는 실수를 렌더 단계에서 원천 차단. */
function fixDiagramReadability(container) {
  container.querySelectorAll(".mermaid svg").forEach((svg) => {
    try {
      // ① 스케일 플로어 (+가로 스크롤 힌트 배지)
      const vb = svg.viewBox && svg.viewBox.baseVal
      if (vb && vb.width > 0) {
        const w = svg.getBoundingClientRect().width
        if (w > 0 && w < vb.width * 0.8) {
          svg.style.minWidth = Math.min(vb.width, 1500) + "px"
          const wrap = svg.closest(".mermaid")
          if (wrap && !wrap.querySelector(".dg-scrollhint")) {
            const hint = document.createElement("div")
            hint.className = "dg-scrollhint"; hint.textContent = "← 옆으로 스크롤 →"
            wrap.appendChild(hint)
            wrap.addEventListener("scroll", () => hint.remove(), { once: true })
          }
        }
      }
      // ② 노드 배경-글자 대비 보정
      svg.querySelectorAll("g.node").forEach((node) => {
        let fillRGB = null
        for (const shape of node.querySelectorAll("rect,circle,ellipse,polygon,path")) {
          const f = getComputedStyle(shape).fill
          const m = f && f.match(/rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/)
          if (m) { fillRGB = [+m[1], +m[2], +m[3]]; break }
        }
        if (!fillRGB) return
        const lum = (0.2126 * fillRGB[0] + 0.7152 * fillRGB[1] + 0.0722 * fillRGB[2]) / 255
        const c = lum > 0.45 ? "#1a1a1a" : "#f2f2f2"
        node.querySelectorAll(".nodeLabel, foreignObject div, foreignObject span, foreignObject p").forEach((el) => { el.style.color = c })
        node.querySelectorAll("text").forEach((el) => el.setAttribute("fill", c))
      })
    } catch (e) { /* 안전망 실패는 조용히 무시 */ }
  })
}

/* ---------- render ---------- */
function render() {
  try {
  const route = parseRoute()
  try { document.documentElement.lang = isEn() ? "en" : "ko" } catch (e) {}
  let main = ""
  if (route.kind === "home") main = viewHome()
  else if (route.kind === "folder") main = viewFolder(route.id)
  else if (route.kind === "sub") main = viewSub(route.id)
  else if (route.kind === "post") main = viewPost(route.id)
  else if (route.kind === "tag") main = viewTag(route.id)

  root.innerHTML = `<a class="skip-link" href="#main-content" data-action="skip">${isEn() ? "Skip to content" : "본문 바로가기"}</a>` +
    header(route) +
    `<div class="grid">${explorer(route)}<main class="main" id="main-content" tabindex="-1">${main}</main>${asideRight(route)}</div>` +
    footer() +
    searchOverlay()

  // post: 헤딩 id + 목차
  if (route.kind === "post") {
    const md = document.getElementById("md")
    const toc = document.getElementById("toc")
    if (md && toc) {
      const hs = md.querySelectorAll("h1,h2,h3")
      let items = ""
      hs.forEach((h, i) => { h.id = "h-" + i; items += `<a data-scroll="h-${i}">${esc(h.textContent)}</a>` })
      toc.innerHTML = items || `<div style="font-size:12px;color:var(--text-faint)">목차 없음</div>`
    }
    if (md) { neutralizeExternalLinks(md); renderDiagrams(md).then(() => autolinkTerms(md)).catch((e) => reportErr(e, "diagrams")) }
  }
  if (state.search) { const i = document.getElementById("searchInput"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length) } }
  if (state.keepScroll != null) { const y = state.keepScroll; state.keepScroll = null; window.scrollTo(0, y) }
  else if (route.kind !== "post" || !location.hash.includes("#h-")) window.scrollTo(0, 0)
  } catch (e) {
    reportErr(e, "render " + location.hash)
    root.innerHTML = `<div class="renderfail"><h2>표시 중 문제가 생겼어요</h2><p>이 페이지를 그리는 중 오류가 났습니다.</p><div class="rf-btns"><a href="#home">홈으로</a><button onclick="location.reload()">새로고침</button></div><pre>${esc(String((e && e.stack) || (e && e.message) || e))}</pre></div>`
  }
}

/* ---------- events ---------- */
root.addEventListener("click", (e) => {
  // 모바일 드로어: 탐색 링크를 누르거나 바깥(오버레이)을 누르면 닫힘(내비게이션은 그대로 진행)
  if (document.body.classList.contains("menu-open")) {
    if (e.target.closest(".exrail a") || (!e.target.closest(".exrail") && !e.target.closest('[data-action="menu"]'))) {
      document.body.classList.remove("menu-open")
    }
  }
  const undef = e.target.closest("a.undef")
  if (undef) { e.preventDefault(); state.search = true; state.query = undef.getAttribute("data-q") || ""; render(); return }
  const gx = e.target.closest("[data-gx]")
  if (gx) { const b = document.getElementById("gxbody"); setGx(!!(b && b.hasAttribute("hidden"))); return }
  const gxo = e.target.closest("[data-gx-open]")
  if (gxo) setGx(true)   // return 하지 않는다 → 바로 아래 [data-scroll] 처리로 이어져 그 위치로 스크롤된다
  const scroll = e.target.closest("[data-scroll]")
  if (scroll) { const t = document.getElementById(scroll.getAttribute("data-scroll")); if (t) t.scrollIntoView({ behavior: "smooth" }); return }
  const act = e.target.closest("[data-action]")
  if (act) {
    const a = act.getAttribute("data-action")
    if (a === "theme") { state.theme = state.theme === "dark" ? "light" : "dark"; try { localStorage.setItem("cosmos-theme", state.theme) } catch (x) {}; applyTheme(state.theme); render(); return }
    if (a === "lang") { state.lang = isEn() ? "ko" : "en"; try { localStorage.setItem("cosmos-lang", state.lang) } catch (x) {}; state.keepScroll = window.scrollY; render(); return }
    if (a === "search") { state.search = true; render(); return }
    if (a === "search-bg") { state.search = false; render(); return }
    if (a === "menu") { document.body.classList.toggle("menu-open"); return }
    if (a === "skip") { e.preventDefault(); const m = document.getElementById("main-content"); if (m) { m.focus(); m.scrollIntoView() } return }
  }
  if (e.target.closest("[data-close]")) { state.search = false; setTimeout(render, 0); return }
  const more = e.target.closest("[data-more]")
  if (more) { const id = more.getAttribute("data-more"); state.showAll = state.showAll || {}; state.showAll[id] = !state.showAll[id]; render(); return }
  const tog = e.target.closest("[data-toggle]")
  if (tog && !e.target.closest("a")) { const id = tog.getAttribute("data-toggle"); state.open[id] = !(state.open[id] ?? tog.classList.contains("open")); render() }
})
/* 모바일 드로어: 스크림(바깥) 탭 시 닫기 — 스크림은 #root 밖이라 document에서 처리 */
document.addEventListener("click", (e) => {
  if (!document.body.classList.contains("menu-open")) return
  if (e.target.closest(".exrail") || e.target.closest('[data-action="menu"]')) return
  document.body.classList.remove("menu-open")
})
document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.body.classList.remove("menu-open") })

/* 그래프 뷰: 노드 호버 → 캡션에 전체 제목·계층 표시 + 노드/이웃 강조 */
/* 그래프 가이드 접기/펼치기 — render()를 부르면 안 된다(render 말미 512행에서 window.scrollTo(0,0)).
   상태는 localStorage에만 남긴다. render()가 root.innerHTML을 전면 교체하므로 DOM 상태는 사라진다. */
function setGx(open) {
  const body = document.getElementById("gxbody"); if (!body) return
  if (open) body.removeAttribute("hidden"); else body.setAttribute("hidden", "")
  const tog = document.querySelector("[data-gx]")
  if (tog) {
    tog.setAttribute("aria-expanded", open ? "true" : "false")
    const car = tog.querySelector(".gx-car"); if (car) car.textContent = open ? "▴" : "▾"
  }
  try { localStorage.setItem("cosmos-gx", open ? "1" : "0") } catch (x) {}
}
function graphHover(e, on) {
  const g = e.target.closest(".gnode"); if (!g) return
  const svg = g.closest(".graphsvg"); const cap = (g.closest(".rail") || document).querySelector(".graph-cap")
  if (!svg || !cap) return
  const id = g.getAttribute("data-id")
  svg.querySelectorAll(".gedge").forEach((ln) => ln.classList.toggle("hot", on && (ln.getAttribute("data-a") === id || ln.getAttribute("data-b") === id)))
  svg.querySelectorAll(".gnode").forEach((nn) => { if (nn !== g) nn.classList.toggle("dim", on) })
  g.classList.toggle("hot", on)
  if (on) { const t = g.getAttribute("data-t"), l = g.getAttribute("data-l"); cap.textContent = l ? `${t}  ·  ${T().layer[l] || l}` : t; cap.classList.add("on") }
  else { cap.textContent = cap.getAttribute("data-default") || ""; cap.classList.remove("on") }
}
root.addEventListener("pointerover", (e) => graphHover(e, true))
root.addEventListener("pointerout", (e) => graphHover(e, false))
root.addEventListener("input", (e) => {
  if (e.target.id === "searchInput") {
    state.query = e.target.value
    const wrap = document.querySelector(".results")
    if (wrap) {
      const res = searchPosts(state.query)
      wrap.innerHTML = state.query.trim()
        ? (res.length ? res.map((p) => `<a class="result" href="#p=${p.id}" data-close style="--hue:${hueHex(p.hue)}"><span class="dot"></span><div style="min-width:0;flex:1"><div class="t">${esc(pt(p))}</div><div class="s">${esc(ps(p))}</div></div><span class="f">${esc(fnameById(p.folderId))}</span></a>`).join("") : `<div class="empty">${T().noResult}</div>`)
        : `<div class="empty">${T().searchHint}</div>`
    }
  }
})
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !state.search) { const t = e.target.tagName; if (t !== "INPUT" && t !== "TEXTAREA") { e.preventDefault(); state.search = true; render() } }
  else if (e.key === "Escape" && state.search) { state.search = false; render() }
})
window.addEventListener("hashchange", () => { if (state.search) state.search = false; render() })

/* ---------- boot ---------- */
try { state.theme = localStorage.getItem("cosmos-theme") || "dark" } catch (e) {}
if (window.marked) window.marked.use({ gfm: true, breaks: false })
const canvas = document.getElementById("galaxy-canvas")
const reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)
try { galaxy = createGalaxy(canvas, { theme: state.theme, reducedMotion: reduced, focal: { x: 0.66, y: 0.30 } }) } catch (e) { console.error("galaxy", e) }
applyTheme(state.theme)
render()

/* ---------- 데이터 업데이트 감지 (야간 자동 생성 반영) ---------- */
let _dataV = null
async function checkUpdate() {
  try {
    const r = await fetch("/api/version", { cache: "no-store" })
    const j = await r.json()
    if (_dataV === null) { _dataV = j.v; return }
    if (j.v && j.v !== _dataV) { _dataV = j.v; showUpdateBanner() }
  } catch (e) {}
}
function showUpdateBanner() {
  if (document.getElementById("upd-banner")) return
  const b = document.createElement("div")
  b.id = "upd-banner"
  b.innerHTML = `<span>🌌 새 노트가 추가됐어요</span><button>새로고침</button>`
  b.querySelector("button").onclick = () => location.reload()
  document.body.appendChild(b)
}
if (IS_LOCAL) { setInterval(checkUpdate, 90000); checkUpdate() }  // 공개 정적 호스트에선 /api 없음 → 폴링 생략

/* ---------- 에러 안전장치 (블랙화면 방지 + 서버 보고) ---------- */
function reportErr(e, where) { try { if (IS_LOCAL) fetch("/api/clientlog", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ where, msg: String((e && e.message) || e), stack: String((e && e.stack) || ""), hash: location.hash }) }) } catch (x) {} }
window.addEventListener("error", (ev) => reportErr(ev.error || ev.message, "window"))
window.addEventListener("unhandledrejection", (ev) => reportErr(ev.reason, "promise"))

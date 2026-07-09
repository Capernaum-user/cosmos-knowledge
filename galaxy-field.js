// galaxy-field.js — interactive deep-space galaxy: a blazing sun with countless
// stars orbiting around it like a slowly rotating galaxy disk. Pure canvas 2D,
// additive glow, pointer parallax. Theme-aware (dark night cosmos / light day).
// Exported as an ES module; also attaches to window for classic-script harnesses.

export function createGalaxy(canvas, opts = {}) {
  const ctx = canvas.getContext('2d', { alpha: true });
  let theme = opts.theme || 'dark';
  let reduced = !!opts.reducedMotion;
  let focal = opts.focal || { x: 0.62, y: 0.40 };
  let intensity = opts.intensity == null ? 1 : opts.intensity;

  let W = 0, H = 0, DPR = 1;
  let raf = 0, running = true;
  const t0 = performance.now();
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  // ---- palette ----------------------------------------------------------
  const PAL = {
    dark: {
      warm: ['#FFFFFF', '#FFEFC6', '#FFD587', '#FBB45C'],
      cool: ['#CBE3F4', '#DAD3F2', '#C9E8DC', '#F4D2DD', '#DDE8AE'],
      field: '#D6E4FF',
      sun: { core: '#FFFDF5', hot: '#FFE6A6', mid: '#FFB85A', outer: '#F47A33' },
      neb: ['rgba(110,140,210,0.085)', 'rgba(190,150,220,0.07)', 'rgba(244,170,120,0.06)'],
      coreGlow: 1
    },
    light: {
      warm: ['#FFFFFF', '#F0C27A', '#E0A65C', '#CC8746'],
      cool: ['#6E93C4', '#8A7CC0', '#67AE90', '#C97FA0', '#A7B86A'],
      field: '#69799B',
      sun: { core: '#FFFFFF', hot: '#FFE5B8', mid: '#FFC879', outer: '#EFA055' },
      neb: ['rgba(120,150,210,0.05)', 'rgba(190,150,220,0.045)', 'rgba(244,180,140,0.045)'],
      coreGlow: 0.6
    }
  };

  // ---- glow sprites (pre-rendered, tinted) ------------------------------
  const spriteCache = new Map();
  function hexToRgb(h) {
    const n = h.replace('#', '');
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  }
  function sprite(color) {
    if (spriteCache.has(color)) return spriteCache.get(color);
    const S = 64, s = document.createElement('canvas'); s.width = s.height = S;
    const c = s.getContext('2d');
    const [r, g, b] = hexToRgb(color);
    const grd = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(255,255,255,0.96)');
    grd.addColorStop(0.16, `rgba(${r},${g},${b},0.92)`);
    grd.addColorStop(0.45, `rgba(${r},${g},${b},0.30)`);
    grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
    c.fillStyle = grd; c.fillRect(0, 0, S, S);
    spriteCache.set(color, s); return s;
  }

  // ---- field generation -------------------------------------------------
  const DISK = [], FIELD = [];
  const rand = (a, b) => a + Math.random() * (b - a);
  function build() {
    DISK.length = 0; FIELD.length = 0;
    const area = W * H;
    const n = Math.max(240, Math.min(760, Math.floor(area / 2500)));
    const arms = 2, tight = 2.5;
    for (let i = 0; i < n; i++) {
      const rr = Math.pow(Math.random(), 0.6);          // denser toward center
      const r = 0.05 + rr * 0.95;                        // normalized orbit radius
      const arm = Math.floor(Math.random() * arms);
      const spiral = r * tight * Math.PI;
      const scatter = rand(-0.6, 0.6) * (0.35 + 0.65 * r);
      const theta = arm * (Math.PI * 2 / arms) + spiral + scatter;
      const omega = (0.10 / (0.30 + r)) * rand(0.85, 1.15); // inner faster (rad/s)
      const warm = Math.random() < (1 - r) * 0.8 + 0.06;
      const arrName = warm ? 'warm' : 'cool';
      DISK.push({
        r, theta, omega, arrName,
        ci: Math.floor(Math.random() * PAL[theme][arrName].length),
        size: rand(0.7, 2.3) * (0.65 + 0.7 * (1 - r)),
        tw: Math.random() * 6.28, tws: rand(0.5, 1.9), br: rand(0.55, 1)
      });
    }
    const fn = Math.max(120, Math.min(320, Math.floor(area / 7000)));
    for (let i = 0; i < fn; i++)
      FIELD.push({ x: Math.random(), y: Math.random(), size: rand(0.4, 1.5), tw: Math.random() * 6.28, tws: rand(0.4, 1.3), depth: rand(0.2, 0.85) });
  }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, rect.width); H = Math.max(1, rect.height);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }

  // disk tilt (perspective) — open enough to read as a disk
  const TILT = 1.02, cosT = Math.cos(TILT), sinT = Math.sin(TILT);

  function star(spr, x, y, rad, alpha) {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(spr, x - rad, y - rad, rad * 2, rad * 2);
  }

  function dot(x, y, r, color, alpha) {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }

  // soft warm daytime sun (normal blend, reads on a pale sky)
  function drawSunLight(cx, cy, R, t) {
    const flick = reduced ? 1 : (1 + 0.03 * Math.sin(t * 7.7));
    ctx.globalAlpha = 1;
    let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 5.5 * flick);
    g.addColorStop(0, 'rgba(255,176,86,0.46)'); g.addColorStop(0.4, 'rgba(255,190,112,0.15)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - R * 6, cy - R * 6, R * 12, R * 12);
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.7 * flick);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.5, '#FFD89A'); g.addColorStop(0.85, '#F2A45C'); g.addColorStop(1, 'rgba(242,164,92,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
  }

  function drawSun(cx, cy, R, t) {
    const P = PAL[theme].sun;
    const flick = reduced ? 1 : (1 + 0.045 * Math.sin(t * 8.3) + 0.03 * Math.sin(t * 13.9 + 1.3));
    const rot = reduced ? 0 : t * 0.18;
    ctx.globalAlpha = 1;
    // outer halo
    let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 7.5 * flick);
    g.addColorStop(0, P.outer); g.addColorStop(0.18, 'rgba(244,122,51,0.34)');
    g.addColorStop(0.5, 'rgba(244,122,51,0.10)'); g.addColorStop(1, 'rgba(244,122,51,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - R * 8, cy - R * 8, R * 16, R * 16);
    // rotating asymmetric corona (two offset lobes => "burning")
    for (let k = 0; k < 2; k++) {
      const a = rot + k * Math.PI, ox = Math.cos(a) * R * 0.7, oy = Math.sin(a) * R * 0.7;
      const gg = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, R * 3.6 * flick);
      gg.addColorStop(0, 'rgba(255,200,110,0.40)'); gg.addColorStop(0.5, 'rgba(255,170,80,0.10)');
      gg.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = gg; ctx.fillRect(cx - R * 5, cy - R * 5, R * 10, R * 10);
    }
    // mid body
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.3 * flick);
    g.addColorStop(0, P.hot); g.addColorStop(0.45, P.mid);
    g.addColorStop(0.8, 'rgba(255,150,70,0.30)'); g.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - R * 3, cy - R * 3, R * 6, R * 6);
    // diffraction rays
    if (!reduced) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * 0.5);
      for (let k = 0; k < 4; k++) {
        ctx.rotate(Math.PI / 2);
        const rg = ctx.createLinearGradient(0, 0, R * 6.5 * flick, 0);
        rg.addColorStop(0, 'rgba(255,230,170,0.5)'); rg.addColorStop(1, 'rgba(255,230,170,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(0, -R * 0.16);
        ctx.lineTo(R * 6.5 * flick, 0); ctx.lineTo(0, R * 0.16); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // white-hot core
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * flick);
    g.addColorStop(0, P.core); g.addColorStop(0.6, P.hot); g.addColorStop(1, 'rgba(255,225,160,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - R * 1.5, cy - R * 1.5, R * 3, R * 3);
  }

  function frame(now) {
    if (!running) return;
    cancelAnimationFrame(raf);
    try {
    const t = (now - t0) / 1000;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    const px = reduced ? 0 : pointer.x, py = reduced ? 0 : pointer.y;

    const cx = W * focal.x, cy = H * focal.y;
    const R = Math.min(W, H);
    const diskR = R * 0.66;
    const sunR = Math.max(16, R * 0.05);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);

    // nebula haze (soft, drifting)
    const neb = PAL[theme].neb;
    const spots = [[0.30, 0.30], [0.72, 0.62], [0.84, 0.26]];
    for (let i = 0; i < neb.length; i++) {
      const dx = Math.sin(t * 0.05 + i) * 18, dy = Math.cos(t * 0.04 + i) * 14;
      const x = W * spots[i][0] + dx + px * 6, y = H * spots[i][1] + dy + py * 6;
      const rr = R * (0.5 + i * 0.12);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, neb[i]); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }

    const dark = theme === 'dark';
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';

    // far field stars (slow parallax)
    const fspr = sprite(PAL[theme].field);
    for (const s of FIELD) {
      const x = s.x * W + px * 10 * s.depth, y = s.y * H + py * 10 * s.depth;
      const tw = reduced ? 0.7 : (0.5 + 0.5 * Math.sin(t * s.tws + s.tw));
      if (dark) star(fspr, x, y, s.size * 2.4, 0.5 * tw * s.depth * intensity);
      else dot(x, y, s.size * 0.9, PAL.light.field, 0.42 * tw * s.depth * intensity);
    }

    // disk stars — split by depth so half pass behind the sun
    const back = [], front = [];
    for (const st of DISK) {
      const ang = st.theta + (reduced ? 0 : st.omega * t);
      const dx = Math.cos(ang) * st.r * diskR, dy = Math.sin(ang) * st.r * diskR;
      const x = cx + dx + px * 26 * (0.35 + st.r);
      const y = cy + dy * cosT + py * 26 * (0.35 + st.r);
      const z = dy * sinT;                                   // depth: <0 behind
      const depthB = 0.62 + 0.38 * (z / diskR);              // brighter in front
      const tw = reduced ? 0.85 : (0.45 + 0.55 * Math.sin(t * st.tws + st.tw));
      const col = PAL[theme][st.arrName][st.ci];
      if (dark) {
        const rad = st.size * (1.7 + 1.3 * (z > 0 ? 1 : 0.5)) * 2.0;
        const a = st.br * tw * depthB * intensity * 0.95;
        (z < 0 ? back : front).push([col, x, y, rad, a, true]);
      } else {
        const rad = st.size * (0.8 + 0.5 * (z > 0 ? 1 : 0.4));
        const a = st.br * tw * depthB * intensity * 0.62;
        (z < 0 ? back : front).push([col, x, y, rad, a, false]);
      }
    }
    const paint = d => d[5] ? star(sprite(d[0]), d[1], d[2], d[3], d[4]) : dot(d[1], d[2], d[3], d[0], d[4]);
    for (const d of back) paint(d);
    if (dark) drawSun(cx + px * 12, cy + py * 12, sunR, t);
    else drawSunLight(cx + px * 12, cy + py * 12, sunR, t);
    for (const d of front) paint(d);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (!reduced && !opts.manual) raf = requestAnimationFrame(frame);
    } catch (e) { console.error('GALAXY frame error:', e && e.message, e && e.stack); }
  }

  // ---- pointer ----------------------------------------------------------
  function onMove(e) {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    pointer.tx = nx; pointer.ty = ny;
  }
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('resize', resize);

  resize();
  // paint one frame synchronously so the canvas is never blank (covers throttled
  // rAF in hidden/background iframes); animation continues via rAF when visible.
  frame(performance.now());

  return {
    setTheme(next) { theme = next; spriteCache.clear(); build(); frame(performance.now()); },
    setReduced(v) { reduced = v; running = true; frame(performance.now()); },
    setFocal(f) { focal = f; frame(performance.now()); },
    setIntensity(v) { intensity = v; frame(performance.now()); },
    redraw() { frame(performance.now()); },
    step(n) { frame(n == null ? performance.now() : n); },
    destroy() {
      running = false; cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
    }
  };
}

if (typeof window !== 'undefined') window.createGalaxy = createGalaxy;

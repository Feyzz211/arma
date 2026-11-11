"use strict";
/* ═══════════════════════════════════════════════
   ARMA SPA — ENGINE v3
   Flow: Loader (1.5s) → App (home) directly
   ─────────────────────────────────────────────
   1. Helpers
   2. Loader  (fast, beautiful)
   3. Explosion particles
   4. Aurora background (home)
   5. Constellation background (team / about)
   6. SPA Router
   7. Navbar
   8. Team page
   9. About page
  10. Boot
═══════════════════════════════════════════════ */

/* ── 1. HELPERS ─────────────────────────────── */
const qs   = s => document.querySelector(s);
const qsa  = s => document.querySelectorAll(s);
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const rInt = (lo, hi) => Math.floor(rand(lo, hi + 1));

/* ── 2. LOADER ──────────────────────────────── */
const loaderScene  = qs('#loader-scene');
const loaderLogo   = qs('#loader-logo');
const loaderBarFill= qs('#loader-bar-fill');
const loaderPct    = qs('#loader-pct');
const morphedBall  = qs('#morphed-ball');
const pCanvas      = qs('#particle-canvas');
const appScene     = qs('#app-scene');

/* Loader ambient canvas (aurora behind the spinner) */
const lCanvas = qs('#loader-canvas');
const lCtx    = lCanvas.getContext('2d');
let   loaderRaf = null;

function resizeLoaderCanvas() {
  lCanvas.width  = window.innerWidth;
  lCanvas.height = window.innerHeight;
  pCanvas.width  = window.innerWidth;
  pCanvas.height = window.innerHeight;
}
resizeLoaderCanvas();
window.addEventListener('resize', resizeLoaderCanvas);

/* Draw slow breathing glow during load */
let loaderGlowT = 0;
function drawLoaderAmbient() {
  loaderGlowT++;
  lCtx.clearRect(0, 0, lCanvas.width, lCanvas.height);
  const cx = lCanvas.width / 2, cy = lCanvas.height / 2;
  const pulse = 0.5 + 0.5 * Math.sin(loaderGlowT * 0.018);
  const r = 240 + pulse * 60;

  /* Central glow */
  const g = lCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0,   `rgba(198,244,50,${0.06 + pulse * 0.04})`);
  g.addColorStop(0.4, `rgba(198,244,50,${0.03 + pulse * 0.02})`);
  g.addColorStop(1,   'transparent');
  lCtx.fillStyle = g;
  lCtx.fillRect(0, 0, lCanvas.width, lCanvas.height);

  /* Outer halo flicker */
  const g2 = lCtx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.5);
  g2.addColorStop(0, 'transparent');
  g2.addColorStop(0.5, `rgba(198,244,50,${0.015 * pulse})`);
  g2.addColorStop(1, 'transparent');
  lCtx.fillStyle = g2;
  lCtx.fillRect(0, 0, lCanvas.width, lCanvas.height);

  loaderRaf = requestAnimationFrame(drawLoaderAmbient);
}

function runLoader() {
  drawLoaderAmbient();

  const tl = gsap.timeline();

  /* Pct label appears */
  tl.to(loaderPct, { opacity: 1, duration: 0.3 }, 0.1);

  /* Bar fills in 1.4 seconds */
  const proxy = { v: 0 };
  tl.to(proxy, {
    v: 100, duration: 1.4, ease: 'power2.inOut',
    onUpdate() {
      const p = Math.round(proxy.v);
      loaderBarFill.style.width = `${proxy.v}%`;
      loaderPct.textContent     = `${p}%`;
    }
  }, 0.15);

  /* Logo glow pulse during load */
  tl.to('#loader-logo', {
    textShadow: '0 0 60px rgba(198,244,50,.5)',
    duration: 0.7, repeat: 1, yoyo: true, ease: 'sine.inOut'
  }, 0.2);

  /* Bar complete → morph to ball */
  tl.add(() => {
    cancelAnimationFrame(loaderRaf);
    const rect = qs('#loader-bar-track').getBoundingClientRect();
    const bx = rect.left + rect.width / 2;
    const by = rect.top  + rect.height / 2;

    /* Hide bar + pct */
    gsap.to(['#loader-bar-wrap', '#loader-rings'], { opacity: 0, duration: 0.2 });

    /* Logo zoom + fade */
    gsap.to('#loader-logo', {
      scale: 1.15, opacity: 0, duration: 0.35, ease: 'power2.in'
    });

    gsap.set(morphedBall, {
      left: bx - 3, top: by - 3,
      width: 6, height: 6, opacity: 0, scale: 1
    });
    setTimeout(() => {
      gsap.to(morphedBall, { opacity: 1, duration: 0.1 });
      gsap.to(morphedBall, {
        width: 44, height: 44, left: bx - 22, top: by - 22,
        duration: 0.3, ease: 'back.out(1.6)',
        onComplete: () => spinAndExplode(bx, by)
      });
    }, 180);
  }, 1.55);
}

function spinAndExplode(bx, by) {
  gsap.to(morphedBall, {
    rotation: 360, duration: 0.5, ease: 'power1.inOut',
    onComplete: () => explodeBall(bx, by)
  });
}

function explodeBall(bx, by) {
  gsap.to(morphedBall, {
    boxShadow: '0 0 60px 20px rgba(198,244,50,.95), 0 0 120px 50px rgba(198,244,50,.4)',
    scale: 2.6, duration: 0.16, ease: 'power2.out',
    onComplete() {
      gsap.to(morphedBall, { opacity: 0, scale: 3.5, duration: 0.22 });
      /* Canvas particles */
      pCanvas.style.opacity = '1';
      spawnParticles(bx, by, 100);
      animateExplosion();
      setTimeout(launchApp, 280);
    }
  });
}

/* ── 3. EXPLOSION PARTICLES ─────────────────── */
const pCtx = pCanvas.getContext('2d');
let explPts = [];

class ExPt {
  constructor(x, y) {
    const a = Math.random() * Math.PI * 2;
    const s = 2 + Math.random() * 8;
    this.x = x; this.y = y;
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
    this.r = 1 + Math.random() * 3.5;
    this.life = 1; this.decay = 0.018 + Math.random() * 0.025;
    this.col = Math.random() > 0.4 ? '#C6F432' : '#FFFFFF';
  }
  tick() {
    this.x += this.vx; this.y += this.vy;
    this.vy += 0.1; this.vx *= 0.98; this.life -= this.decay;
  }
  paint(c) {
    c.save(); c.globalAlpha = Math.max(0, this.life);
    c.shadowBlur = 8; c.shadowColor = this.col;
    c.fillStyle = this.col;
    c.beginPath(); c.arc(this.x, this.y, Math.max(0, this.r * this.life), 0, Math.PI * 2); c.fill();
    c.restore();
  }
}

function spawnParticles(x, y, n) {
  for (let i = 0; i < n; i++) explPts.push(new ExPt(x, y));
}

let exRaf = null;
function animateExplosion() {
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  explPts = explPts.filter(p => p.life > 0);
  explPts.forEach(p => { p.tick(); p.paint(pCtx); });
  if (explPts.length) exRaf = requestAnimationFrame(animateExplosion);
  else {
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    gsap.to(pCanvas, { opacity: 0, duration: 0.4 });
  }
}

/* ── 4. AURORA BACKGROUND (home) ────────────── */
const homeCanvas = qs('#home-canvas');
const hCtx       = homeCanvas.getContext('2d');
let   homeRunning = false, homeRaf = null, homeTime = 0;

/* Aurora orbs */
class AuroraOrb {
  constructor(w, h) {
    this.reset(w, h, true);
  }
  reset(w, h, rand_pos = false) {
    this.w = w; this.h = h;
    this.x  = rand_pos ? rand(0, w) : rand(-100, w + 100);
    this.y  = rand_pos ? rand(0, h) : rand(-100, h + 100);
    this.r  = rand(180, 420);
    this.vx = rand(-0.12, 0.12);
    this.vy = rand(-0.08, 0.08);
    this.phase      = rand(0, Math.PI * 2);
    this.phaseSpeed = rand(0.003, 0.009);
    this.maxOp      = rand(0.055, 0.14);
    /* Green palette */
    const palettes = [
      [198, 244, 50],
      [140, 220, 40],
      [80,  200, 60],
      [170, 255, 70],
    ];
    this.rgb = palettes[rInt(0, palettes.length - 1)];
  }
  update(t) {
    this.x += this.vx + Math.sin(t * 0.0009 + this.phase) * 0.4;
    this.y += this.vy + Math.cos(t * 0.0007 + this.phase) * 0.3;
    if (this.x < -this.r * 1.5) this.x = this.w + this.r;
    if (this.x > this.w + this.r * 1.5) this.x = -this.r;
    if (this.y < -this.r * 1.5) this.y = this.h + this.r;
    if (this.y > this.h + this.r * 1.5) this.y = -this.r;
  }
  draw(c, t) {
    const op = this.maxOp * (0.5 + 0.5 * Math.sin(t * this.phaseSpeed + this.phase));
    const [r, g, b] = this.rgb;
    const gr = c.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r);
    gr.addColorStop(0,    `rgba(${r},${g},${b},${op})`);
    gr.addColorStop(0.35, `rgba(${r},${g},${b},${op * 0.5})`);
    gr.addColorStop(0.7,  `rgba(${r},${g},${b},${op * 0.15})`);
    gr.addColorStop(1,    'transparent');
    c.fillStyle = gr;
    c.beginPath(); c.arc(this.x, this.y, this.r, 0, Math.PI * 2); c.fill();
  }
}

/* Constellation particles */
class StarPt {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.x     = rand(0, w);
    this.y     = rand(0, h);
    this.vx    = rand(-0.18, 0.18);
    this.vy    = rand(-0.14, 0.14);
    this.r     = rand(0.5, 2.2);
    this.baseOp= rand(0.12, 0.65);
    this.phase = rand(0, Math.PI * 2);
    this.pulse = rand(0.007, 0.02);
    this.green = Math.random() > 0.5;
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    if (this.x < 0) this.x = this.w;
    if (this.x > this.w) this.x = 0;
    if (this.y < 0) this.y = this.h;
    if (this.y > this.h) this.y = 0;
  }
  draw(c, t) {
    const op = this.baseOp * (0.5 + 0.5 * Math.sin(t * this.pulse + this.phase));
    c.beginPath(); c.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    if (this.green) {
      c.fillStyle = `rgba(198,244,50,${op})`;
      if (this.r > 1.5) { c.shadowBlur = 8; c.shadowColor = 'rgba(198,244,50,.5)'; }
    } else {
      c.fillStyle = `rgba(255,255,255,${op * 0.5})`;
      c.shadowBlur = 0;
    }
    c.fill(); c.shadowBlur = 0;
  }
}

let auroraOrbs  = [];
let homeStars   = [];

function initHomeCanvas() {
  homeCanvas.width  = window.innerWidth;
  homeCanvas.height = window.innerHeight;
  auroraOrbs = Array.from({ length: 7 }, () => new AuroraOrb(homeCanvas.width, homeCanvas.height));
  const starCount = Math.max(60, Math.floor(homeCanvas.width * homeCanvas.height / 11000));
  homeStars = Array.from({ length: starCount }, () => new StarPt(homeCanvas.width, homeCanvas.height));
}

function drawHome() {
  if (!homeRunning) return;
  homeTime++;
  hCtx.clearRect(0, 0, homeCanvas.width, homeCanvas.height);

  /* Aurora orb layer */
  auroraOrbs.forEach(o => { o.update(homeTime); o.draw(hCtx, homeTime); });

  /* Constellation connections */
  const D = 100;
  for (let i = 0; i < homeStars.length; i++) {
    for (let j = i + 1; j < homeStars.length; j++) {
      const dx = homeStars[i].x - homeStars[j].x;
      const dy = homeStars[i].y - homeStars[j].y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < D) {
        hCtx.beginPath();
        hCtx.strokeStyle = `rgba(198,244,50,${(1 - d / D) * 0.055})`;
        hCtx.lineWidth   = 0.5;
        hCtx.moveTo(homeStars[i].x, homeStars[i].y);
        hCtx.lineTo(homeStars[j].x, homeStars[j].y);
        hCtx.stroke();
      }
    }
  }

  /* Stars */
  homeStars.forEach(s => { s.update(); s.draw(hCtx, homeTime); });

  /* Grid vignette feel — dark corner overlay */
  const vig = hCtx.createRadialGradient(
    homeCanvas.width/2, homeCanvas.height/2, homeCanvas.height * 0.2,
    homeCanvas.width/2, homeCanvas.height/2, homeCanvas.height * 0.95
  );
  vig.addColorStop(0, 'transparent');
  vig.addColorStop(1, 'rgba(11,11,12,0.6)');
  hCtx.fillStyle = vig;
  hCtx.fillRect(0, 0, homeCanvas.width, homeCanvas.height);

  homeRaf = requestAnimationFrame(drawHome);
}

function startHomeCanvas() {
  if (homeRunning) return;
  homeRunning = true;
  initHomeCanvas();
  drawHome();
}
function stopHomeCanvas() {
  homeRunning = false;
  if (homeRaf) { cancelAnimationFrame(homeRaf); homeRaf = null; }
}

/* ── 5. CONSTELLATION BG (team / about) ─────── */
class ConstellationSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.pts    = [];
    this.raf    = null;
    this.alive  = false;
    this.t      = 0;
  }
  init() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    const n = Math.max(55, Math.floor(this.canvas.width * this.canvas.height / 13000));
    this.pts = Array.from({ length: n }, () => ({
      x:  rand(0, this.canvas.width),
      y:  rand(0, this.canvas.height),
      vx: rand(-0.22, 0.22),
      vy: rand(-0.18, 0.18),
      r:  rand(0.6, 2.4),
      op: rand(0.1, 0.65),
      phase: rand(0, Math.PI * 2),
      pulse: rand(0.006, 0.02),
      green: Math.random() > 0.5,
    }));
  }
  draw() {
    if (!this.alive) return;
    this.t++;
    const { canvas, ctx, pts, t } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* Connections */
    const D = 115;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < D) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(198,244,50,${(1 - d / D) * 0.065})`;
          ctx.lineWidth   = 0.5;
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    }

    /* Dots */
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;  if (p.x > canvas.width)  p.x = 0;
      if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
      const op = p.op * (0.5 + 0.5 * Math.sin(t * p.pulse + p.phase));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      if (p.green) {
        ctx.fillStyle = `rgba(198,244,50,${op})`;
        if (p.r > 1.5) { ctx.shadowBlur = 7; ctx.shadowColor = 'rgba(198,244,50,.4)'; }
      } else {
        ctx.fillStyle = `rgba(255,255,255,${op * 0.45})`;
        ctx.shadowBlur = 0;
      }
      ctx.fill(); ctx.shadowBlur = 0;
    });

    this.raf = requestAnimationFrame(() => this.draw());
  }
  start() { if (this.alive) return; this.alive = true; this.init(); this.draw(); }
  stop()  { this.alive = false; if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; } }
  resize(){ if (!this.alive) return; this.init(); }
}

const teamPS  = new ConstellationSystem(qs('#team-canvas'));
const aboutPS = new ConstellationSystem(qs('#about-canvas'));

window.addEventListener('resize', () => {
  teamPS.resize(); aboutPS.resize();
  if (homeRunning) initHomeCanvas();
});

/* ── 6. SPA ROUTER ──────────────────────────── */
let currentPage = null;
let pageTransitionTimeout = null;

const pageMap = {
  home:  { el: qs('#page-home'),  startBg: startHomeCanvas,       stopBg: stopHomeCanvas        },
  team:  { el: qs('#page-team'),  startBg: () => teamPS.start(),  stopBg: () => teamPS.stop()   },
  about: { el: qs('#page-about'), startBg: () => aboutPS.start(), stopBg: () => aboutPS.stop()  },
};

function navigateTo(key, instant = false) {
  if (!Object.prototype.hasOwnProperty.call(pageMap, key) || key === currentPage) return;
  if (pageTransitionTimeout !== null) {
    clearTimeout(pageTransitionTimeout);
    pageTransitionTimeout = null;
  }
  if (currentPage && pageMap[currentPage]) pageMap[currentPage].stopBg();

  const prev = qs('.page.active');
  const next  = pageMap[key].el;
  currentPage = key;
  qsa('.page').forEach(page => gsap.killTweensOf(page));

  updateNavbar(key);

  if (instant) {
    qsa('.page.active').forEach(page => {
      page.classList.remove('active');
      gsap.set(page, { opacity: 0, y: 0 });
    });
    next.classList.add('active'); gsap.set(next, { opacity: 1, y: 0 });
    pageMap[key].startBg(); onPageEnter(key); return;
  }

  if (prev) {
    gsap.to(prev, { opacity: 0, y: -14, duration: 0.28, ease: 'power2.in',
      onComplete() { prev.classList.remove('active'); gsap.set(prev, { y: 0 }); }
    });
  }

  pageTransitionTimeout = setTimeout(() => {
    pageTransitionTimeout = null;
    if (currentPage !== key) return;
    qsa('.page.active').forEach(page => {
      if (page !== next) page.classList.remove('active');
    });
    next.classList.add('active');
    gsap.fromTo(next, { opacity: 0, y: 22 }, {
      opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
      onComplete() { pageMap[key].startBg(); onPageEnter(key); }
    });
  }, prev ? 240 : 0);
}

function onPageEnter(key) {
  if (key === 'home')  animateHomeEntry();
  if (key === 'team')  animateTeamEntry();
  if (key === 'about') animateAboutEntry();
}

/* ── 7. NAVBAR ──────────────────────────────── */
const navItems    = qsa('.nav-item');
const navIndicator = qs('#nav-indicator');
let navReady = false;

function updateNavbar(key) {
  navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.page === key);
  });

  /* Only move indicator for team/about (not home since ARMA is in top-left) */
  const item = qs(`#nav-${key}`);
  if (!item) {
    /* home — hide indicator smoothly */
    gsap.to(navIndicator, { opacity: 0, duration: 0.3 });
    return;
  }

  const inner = qs('#nav-inner');
  const iR = item.getBoundingClientRect();
  const pR = inner.getBoundingClientRect();

  if (!navReady) {
    gsap.set(navIndicator, { left: iR.left - pR.left, top: iR.top - pR.top, width: iR.width, height: iR.height, opacity: 1 });
    navReady = true;
  } else {
    gsap.to(navIndicator, {
      left: iR.left - pR.left, top: iR.top - pR.top,
      width: iR.width, height: iR.height,
      opacity: 1, duration: 0.38, ease: 'power3.inOut'
    });
  }
}

navItems.forEach(item => {
  item.addEventListener('click', e => { e.preventDefault(); navigateTo(item.dataset.page); });
});

/* Logo click → home */
qs('#app-logo').addEventListener('click', () => navigateTo('home'));

/* CTA buttons */
qs('#cta-team').addEventListener('click',    () => navigateTo('team'));
qs('#cta-explore').addEventListener('click', () => navigateTo('about')); /* Keşfet → about page */

/* ── 8. TEAM PAGE ───────────────────────────── */
/* Organic positions: left%, top% of viewport */
const teamPositions = {
  'card-poyraz': { left: '3%',  top: '14%' },   // En üstte sol
  'card-ruzgar': { left: '30%', top: '37%' },   // Poyraz'ın biraz altında
  'card-mert':   { left: '78%', top: '30%' },   // Ortalarda sağ
  'card-msaid':  { left: '57%', top: '52%' },   // Alt kısım
};

let teamAnimated = false;
let teamConnectionTweens = [];

function positionTeamCards() {
  for (const [id, pos] of Object.entries(teamPositions)) {
    const el = qs(`#${id}`);
    if (el) { el.style.left = pos.left; el.style.top = pos.top; }
  }
}

function drawTeamConnections() {
  const svg = qs('#team-svg');
  teamConnectionTweens.forEach(tween => tween.kill());
  teamConnectionTweens = [];
  svg.innerHTML = '';

  function center(el) {
    const r = el.getBoundingClientRect();
    const p = qs('#team-content').getBoundingClientRect();
    return { x: r.left - p.left + r.width / 2, y: r.top - p.top + r.height / 2 };
  }

  const cards = ['card-poyraz','card-ruzgar','card-msaid','card-mert']
    .map(id => qs(`#${id}`))
    .filter(Boolean)
    .map(el => ({ el, c: center(el) }));

  /* Connect: poyraz↔ruzgar, ruzgar↔msaid, msaid↔mert, poyraz↔mert */
  const edges = [[0,1],[1,2],[2,3],[0,3],[1,3]]
    .filter(([a, b]) => cards[a] && cards[b]);
  edges.forEach(([ai, bi]) => {
    const a = cards[ai].c, b = cards[bi].c;
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    line.setAttribute('stroke', 'rgba(198,244,50,0.14)');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-dasharray', '4 7');
    svg.appendChild(line);

    /* Animated dot */
    const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
    dot.setAttribute('r', '3'); dot.setAttribute('fill', '#C6F432');
    dot.style.filter = 'drop-shadow(0 0 4px #C6F432)';
    svg.appendChild(dot);

    const dur   = 2.5 + Math.random() * 2;
    const delay = Math.random() * 2;
    const proxy = { px: a.x, py: a.y };
    const tween = gsap.to(proxy, {
      px: b.x, py: b.y,
      duration: dur, delay, ease: 'none', repeat: -1,
      onUpdate() {
        dot.setAttribute('cx', proxy.px);
        dot.setAttribute('cy', proxy.py);
        const progress = (proxy.px - a.x) * (b.x - a.x) + (proxy.py - a.y) * (b.y - a.y);
        const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
        const ratio = lengthSquared ? Math.max(0, Math.min(1, progress / lengthSquared)) : 0;
        dot.setAttribute('opacity', 1 - ratio * 0.6);
      }
    });
    teamConnectionTweens.push(tween);
  });
}

function animateTeamEntry() {
  positionTeamCards();
  setTimeout(() => {
    if (currentPage === 'team') drawTeamConnections();
  }, 120);

  if (teamAnimated) return;
  teamAnimated = true;

  gsap.from('.page-heading', { opacity: 0, y: -20, duration: 0.5, ease: 'power3.out' });
  gsap.from('.team-card', {
    opacity: 0, scale: 0.88, y: 20,
    duration: 0.55, stagger: 0.1, ease: 'back.out(1.5)', delay: 0.1
  });
}

window.addEventListener('resize', () => {
  if (currentPage === 'team') {
    positionTeamCards();
    drawTeamConnections();
  }
});

/* ── 9. ABOUT PAGE ──────────────────────────── */
let aboutAnimated = false;
function animateAboutEntry() {
  if (aboutAnimated) return;
  aboutAnimated = true;
  gsap.from('#glass-window', { opacity: 0, y: 36, scale: 0.97, duration: 0.65, ease: 'power3.out' });
}

/* Streamable video player */
function playStreamableVideo() {
  const placeholder = document.querySelector('#video-placeholder');
  const iframe = document.querySelector('#streamable-video');
  
  if (placeholder && iframe) {
    // Placeholder'ı gizle
    gsap.to(placeholder, {
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        placeholder.style.display = 'none';
        // Video iframe'i göster ve autoplay ile yeniden yükle
        iframe.style.display = 'block';
        iframe.src = 'https://streamable.com/e/cikp1a?autoplay=1';
        gsap.fromTo(iframe, 
          { opacity: 0 }, 
          { opacity: 1, duration: 0.4 }
        );
      }
    });
  }
}

/* ── HOME ENTRY ─────────────────────────────── */
let homeAnimated = false;
function animateHomeEntry() {
  if (homeAnimated) return;
  homeAnimated = true;
  gsap.from('#home-title', { opacity: 0, y: -40, scale: 0.9, duration: 0.8, ease: 'power3.out' });
  gsap.from('#home-cta-group', { opacity: 0, y: 28, duration: 0.65, ease: 'power3.out', delay: 0.3 });
}

/* ── LAUNCH APP ─────────────────────────────── */
function launchApp() {
  gsap.to(loaderScene, {
    opacity: 0, duration: 0.45, ease: 'power2.in',
    onComplete() { loaderScene.style.display = 'none'; }
  });

  appScene.classList.add('active');
  gsap.to(appScene, { opacity: 1, duration: 0.5, ease: 'power2.out' });
  gsap.to('#navbar',   { opacity: 1, duration: 0.5, delay: 0.1 });
  gsap.to('#app-logo', { opacity: 1, duration: 0.5, delay: 0.15 });

  setTimeout(() => navigateTo('home', true), 300);
}

/* ── 10. BOOT ───────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  gsap.set('#app-logo', { opacity: 0 });
  gsap.set('#navbar',   { opacity: 0 });
  gsap.set(appScene,    { opacity: 0 });
  qsa('.page').forEach(p => { p.classList.remove('active'); gsap.set(p, { opacity: 0 }); });

  setTimeout(runLoader, 100);

  // Make team cards draggable
  makeDraggable('.team-card');
  // Make about window draggable
  makeDraggable('#glass-window');
});

/* ── DRAGGABLE SYSTEM ───────────────────────── */
function makeDraggable(selector) {
  const elements = typeof selector === 'string' ? qsa(selector) : [selector];
  
  elements.forEach(el => {
    let isDragging = false;
    let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

    el.addEventListener('pointerdown', (e) => {
      // Skip if clicking on interactive elements
      if (e.target.closest('button, a, input, .slot') || e.button !== 0) return;
      
      isDragging = true;
      el.classList.add('dragging');
      
      const rect = el.getBoundingClientRect();
      const parent = el.offsetParent.getBoundingClientRect();
      
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = rect.left - parent.left;
      initialTop = rect.top - parent.top;
      
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    el.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      el.style.left = `${initialLeft + deltaX}px`;
      el.style.top = `${initialTop + deltaY}px`;
    });

    const stopDragging = () => {
      if (isDragging) {
        isDragging = false;
        el.classList.remove('dragging');
      }
    };
    el.addEventListener('pointerup', stopDragging);
    el.addEventListener('pointercancel', stopDragging);
  });
}

(() => {
  "use strict";

  const MOCHI = [
    { name: "Kome",     r: 16, fill: "#fff3df", mid: "#f0d7b4", deep: "#d9b78a", speck: "#c9a57a", score: 1 },
    { name: "Kinako",   r: 21, fill: "#f0c56a", mid: "#d9a43b", deep: "#b88422", speck: "#8a5e14", score: 3 },
    { name: "Sakura",   r: 27, fill: "#f3b7c4", mid: "#e48aa0", deep: "#c4627c", speck: "#fff0f4", score: 6 },
    { name: "Matcha",   r: 34, fill: "#9dbe7c", mid: "#6f9a55", deep: "#4e7438", speck: "#d7e8c4", score: 10 },
    { name: "Yuzu",     r: 41, fill: "#f4d45c", mid: "#e2b42a", deep: "#c49212", speck: "#fff1b0", score: 16 },
    { name: "Azuki",    r: 50, fill: "#c85c58", mid: "#a53d3d", deep: "#7a2428", speck: "#e8a09a", score: 24 },
    { name: "Goma",     r: 60, fill: "#4a433e", mid: "#2e2926", deep: "#1a1614", speck: "#8a8078", score: 36 },
    { name: "Ichigo",   r: 71, fill: "#e56b6b", mid: "#c43d44", deep: "#92282e", speck: "#ffd0d0", score: 52 },
    { name: "Kuri",     r: 84, fill: "#c8884c", mid: "#a06632", deep: "#75461c", speck: "#efd0a8", score: 74 },
    { name: "Daifuku",  r: 98, fill: "#f7e4ee", mid: "#e4b8cc", deep: "#c98aa8", speck: "#fff", score: 108 },
    { name: "O-Daifuku", r: 114, fill: "#ead4a0", mid: "#d4b46a", deep: "#b89040", speck: "#fff6d8", score: 160 }
  ];
  const MAX_TYPE = MOCHI.length - 1;
  const DROP_MAX = 4;
  const WORLD_W = 420;
  const WORLD_H = 720;
  const BOWL = { left: 38, right: 382, top: 168, bottom: 678 };
  const DANGER = 196;
  const GRAVITY = 1680;
  const REST = 0.18;
  const FRICTION = 0.78;
  const AIR = 0.996;
  const ITER = 10;
  const HS_KEY = "mochi-drop-best";
  const MUTE_KEY = "mochi-drop-mute";

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const screens = {
    start: document.getElementById("screen-start"),
    pause: document.getElementById("screen-pause"),
    over: document.getElementById("screen-over")
  };
  const el = {
    score: document.getElementById("score"),
    best: document.getElementById("best"),
    startBest: document.getElementById("start-best"),
    overScore: document.getElementById("over-score"),
    overBest: document.getElementById("over-best"),
    overFinest: document.getElementById("over-finest"),
    nextOrb: document.getElementById("next-orb"),
    mute: document.getElementById("mute-btn"),
    pause: document.getElementById("pause-btn"),
    legend: document.querySelector(".legend")
  };

  let dpr = 1, scale = 1, ox = 0, oy = 0;
  let mode = "start";
  let balls = [];
  let particles = [];
  let floaters = [];
  let nextId = 1;
  let score = 0;
  let best = Number(localStorage.getItem(HS_KEY) || 0);
  let finest = 0;
  let current = 0;
  let nextType = 1;
  let aimX = WORLD_W / 2;
  let canDrop = true;
  let dropLockUntil = 0;
  let lastDropped = null;
  let overflowTimer = 0;
  let combo = 0;
  let comboUntil = 0;
  let shake = 0;
  let muted = localStorage.getItem(MUTE_KEY) === "1";
  let audioCtx = null;
  let lastT = 0;
  let keys = Object.create(null);
  let pointerDown = false;
  let pointerId = null;

  function randDrop() {
    const w = [5, 4, 3.2, 2.2, 1.2];
    let t = w.reduce((a, b) => a + b, 0) * Math.random();
    for (let i = 0; i < w.length; i++) {
      t -= w[i];
      if (t <= 0) return i;
    }
    return 0;
  }

  function paintNext() {
    const m = MOCHI[nextType];
    el.nextOrb.style.background = `radial-gradient(circle at 32% 30%, ${m.fill}, ${m.mid} 62%, ${m.deep})`;
    el.nextOrb.setAttribute("aria-label", `Next mochi: ${m.name}`);
  }

  function setScore(n) {
    score = n;
    if (score > best) {
      best = score;
      localStorage.setItem(HS_KEY, String(best));
    }
    el.score.textContent = String(score);
    el.best.textContent = String(best);
    el.startBest.textContent = String(best);
  }

  function showScreen(name) {
    mode = name === "playing" ? "playing" : name;
    overlay.dataset.screen = name === "playing" ? "hidden" : name;
    for (const k of Object.keys(screens)) screens[k].classList.toggle("hidden", k !== name);
    if (name === "start") screens.start.querySelector(".primary").focus();
    if (name === "pause") screens.pause.querySelector(".primary").focus();
    if (name === "over") screens.over.querySelector(".primary").focus();
  }

  function buildLegend() {
    el.legend.innerHTML = "";
    MOCHI.forEach((m, i) => {
      const li = document.createElement("li");
      const s = 8 + i * 2.1;
      li.style.width = li.style.height = s + "px";
      li.style.background = `radial-gradient(circle at 35% 30%, ${m.fill}, ${m.deep})`;
      li.title = m.name;
      el.legend.appendChild(li);
    });
  }

  function ctxAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
  function tone(freq, dur, type, vol, slide) {
    if (muted) return;
    try {
      const ac = ctxAudio();
      const o = ac.createOscillator();
      const g = ac.createGain();
      const f = ac.createBiquadFilter();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, ac.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, ac.currentTime + dur * 0.8);
      f.type = "lowpass";
      f.frequency.value = 1800;
      g.gain.setValueAtTime(vol || 0.08, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0008, ac.currentTime + dur);
      o.connect(f); f.connect(g); g.connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + dur + 0.02);
    } catch (_) { /* ignore */ }
  }
  function sndDrop() { tone(320, 0.09, "sine", 0.05, 180); }
  function sndMerge(type, cbo) {
    tone(240 + type * 42, 0.16, "triangle", 0.07 + Math.min(0.06, cbo * 0.012), 420 + type * 30);
    if (cbo > 1) tone(520 + cbo * 40, 0.12, "sine", 0.05);
  }
  function sndOver() { tone(180, 0.4, "sine", 0.07, 70); }
  function sndUi() { tone(520, 0.06, "triangle", 0.04); }

  function setMuted(v) {
    muted = v;
    localStorage.setItem(MUTE_KEY, v ? "1" : "0");
    el.mute.setAttribute("aria-pressed", v ? "true" : "false");
    el.mute.setAttribute("aria-label", v ? "Unmute sound" : "Mute sound");
  }

  function spawnBall(x, y, type, falling) {
    const m = MOCHI[type];
    const b = {
      id: nextId++,
      x, y, vx: 0, vy: falling ? 40 : -20,
      r: m.r, type, mass: m.r * m.r,
      sx: reduced ? 1 : 0.55,
      sy: reduced ? 1 : 1.28,
      alive: true,
      settled: false,
      born: performance.now()
    };
    balls.push(b);
    return b;
  }

  function burst(x, y, color, n, power) {
    const count = reduced ? Math.min(6, n) : n;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.4 + Math.random()) * power;
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: 1,
        decay: 0.012 + Math.random() * 0.02,
        r: 2 + Math.random() * 4,
        color
      });
    }
  }

  function floatText(x, y, text) {
    floaters.push({ x, y, text, life: 1 });
  }

  function mergePair(a, b) {
    if (!a.alive || !b.alive || a.type !== b.type || a.type >= MAX_TYPE) return false;
    a.alive = b.alive = false;
    const type = a.type + 1;
    const tot = a.mass + b.mass;
    const x = (a.x * a.mass + b.x * b.mass) / tot;
    const y = (a.y * a.mass + b.y * b.mass) / tot;
    const now = performance.now();
    if (now < comboUntil) combo += 1;
    else combo = 1;
    comboUntil = now + 900;
    const gained = MOCHI[type].score * combo;
    setScore(score + gained);
    if (type > finest) finest = type;
    const nb = spawnBall(x, y, type, false);
    nb.vx = (a.vx + b.vx) * 0.25;
    nb.vy = Math.min((a.vy + b.vy) * 0.2, -30);
    burst(x, y, MOCHI[type].mid, 10 + type * 2, 120 + type * 12);
    floatText(x, y - nb.r, combo > 1 ? `combo ×${combo}  +${gained}` : `+${gained}`);
    sndMerge(type, combo);
    if (!reduced) shake = Math.min(14, 3 + type * 0.7 + combo);
    if (navigator.vibrate && !muted) navigator.vibrate(combo > 2 ? 24 : 12);
    return true;
  }

  function walls(b) {
    const rest = reduced ? 0.04 : REST;
    if (b.x - b.r < BOWL.left) {
      b.x = BOWL.left + b.r;
      b.vx = Math.abs(b.vx) * rest;
    }
    if (b.x + b.r > BOWL.right) {
      b.x = BOWL.right - b.r;
      b.vx = -Math.abs(b.vx) * rest;
    }
    if (b.y + b.r > BOWL.bottom) {
      b.y = BOWL.bottom - b.r;
      if (b.vy > 0) {
        b.vy *= -rest;
        b.vx *= FRICTION;
        if (Math.abs(b.vy) < 28) b.vy = 0;
      }
    }
  }

  function collide(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const min = a.r + b.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) return;
    if (d2 === 0) { a.x -= 0.35; return; }
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const ny = dy / d;
    const overlap = min - d;
    const inv = 1 / (a.mass + b.mass);
    a.x -= nx * overlap * b.mass * inv;
    a.y -= ny * overlap * b.mass * inv;
    b.x += nx * overlap * a.mass * inv;
    b.y += ny * overlap * a.mass * inv;
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv < 0) {
      const e = reduced ? 0.05 : REST;
      const j = -(1 + e) * rv / (1 / a.mass + 1 / b.mass);
      a.vx -= j * nx / a.mass;
      a.vy -= j * ny / a.mass;
      b.vx += j * nx / b.mass;
      b.vy += j * ny / b.mass;
      const tx = -ny, ty = nx;
      const rt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
      const ft = rt / (1 / a.mass + 1 / b.mass) * 0.35;
      a.vx += ft * tx / a.mass;
      a.vy += ft * ty / a.mass;
      b.vx -= ft * tx / b.mass;
      b.vy -= ft * ty / b.mass;
    }
    if (!reduced) {
      const k = Math.min(0.16, overlap / min);
      a.sx = 1 - Math.abs(nx) * k;
      a.sy = 1 - Math.abs(ny) * k;
      b.sx = 1 - Math.abs(nx) * k;
      b.sy = 1 - Math.abs(ny) * k;
    }
  }

  function stepPhysics(dt) {
    const g = GRAVITY;
    for (const b of balls) {
      if (!b.alive) continue;
      b.vy += g * dt;
      b.vx *= AIR;
      b.vy *= AIR;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      walls(b);
      const rec = reduced ? 0.45 : 0.18;
      b.sx += (1 - b.sx) * rec;
      b.sy += (1 - b.sy) * rec;
    }
    for (let k = 0; k < ITER; k++) {
      for (let i = 0; i < balls.length; i++) {
        if (!balls[i].alive) continue;
        walls(balls[i]);
        for (let j = i + 1; j < balls.length; j++) {
          if (!balls[j].alive) continue;
          collide(balls[i], balls[j]);
        }
      }
    }
    const live = balls.filter((b) => b.alive);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j];
        if (a.type !== b.type || a.type >= MAX_TYPE) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const lim = (a.r + b.r) * 0.92;
        if (dx * dx + dy * dy < lim * lim) mergePair(a, b);
      }
    }
    balls = balls.filter((b) => b.alive);
    for (const b of balls) {
      const spd = Math.hypot(b.vx, b.vy);
      b.settled = spd < 18 && b.y + b.r > BOWL.top + 40;
    }
  }

  function stepFx(dt) {
    for (const p of particles) {
      p.vy += 420 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * (reduced ? 1.8 : 1);
    }
    particles = particles.filter((p) => p.life > 0);
    for (const f of floaters) {
      f.y -= 28 * dt;
      f.life -= dt * 0.7;
    }
    floaters = floaters.filter((f) => f.life > 0);
    shake *= reduced ? 0.4 : 0.86;
    if (shake < 0.2) shake = 0;
  }

  function resetGame() {
    balls = [];
    particles = [];
    floaters = [];
    score = 0;
    finest = 0;
    combo = 0;
    shake = 0;
    overflowTimer = 0;
    canDrop = true;
    lastDropped = null;
    current = randDrop();
    nextType = randDrop();
    aimX = WORLD_W / 2;
    setScore(0);
    paintNext();
  }

  function dropNow() {
    if (mode !== "playing" || !canDrop) return;
    const r = MOCHI[current].r;
    const x = Math.max(BOWL.left + r, Math.min(BOWL.right - r, aimX));
    lastDropped = spawnBall(x, 78, current, true);
    sndDrop();
    current = nextType;
    nextType = randDrop();
    paintNext();
    canDrop = false;
    dropLockUntil = performance.now() + 380;
  }

  function maybeUnlockDrop(now) {
    if (canDrop || mode !== "playing") return;
    if (now < dropLockUntil) return;
    const last = lastDropped;
    if (!last || !last.alive) { canDrop = true; return; }
    if (last.settled || last.y > DANGER + last.r * 0.35 || now > dropLockUntil + 1100) canDrop = true;
  }

  function checkOverflow(dt) {
    if (mode !== "playing") return;
    let over = false;
    const now = performance.now();
    for (const b of balls) {
      const slow = Math.hypot(b.vx, b.vy) < 42;
      if (now - b.born > 850 && slow && b.y - b.r < DANGER) {
        over = true;
        break;
      }
    }
    if (over) overflowTimer += dt;
    else overflowTimer = Math.max(0, overflowTimer - dt * 0.6);
    if (overflowTimer > 1.15) gameOver();
  }

  function gameOver() {
    if (mode !== "playing") return;
    mode = "over";
    sndOver();
    el.overScore.textContent = String(score);
    el.overBest.textContent = String(best);
    el.overFinest.textContent = MOCHI[finest].name;
    showScreen("over");
  }

  function play() {
    resetGame();
    showScreen("playing");
    mode = "playing";
    sndUi();
  }

  function pause() {
    if (mode !== "playing") return;
    showScreen("pause");
    mode = "pause";
  }

  function resume() {
    if (mode !== "pause") return;
    showScreen("playing");
    mode = "playing";
    lastT = performance.now();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    scale = Math.min(canvas.width / WORLD_W, canvas.height / WORLD_H);
    ox = (canvas.width - WORLD_W * scale) / 2;
    oy = (canvas.height - WORLD_H * scale) / 2;
  }

  function worldFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) * dpr - ox) / scale;
    return cx;
  }

  function drawMochi(b, ghost) {
    const m = MOCHI[b.type];
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(b.sx || 1, b.sy || 1);
    ctx.globalAlpha = ghost ? 0.42 : 1;
    if (!ghost) {
      ctx.beginPath();
      ctx.ellipse(2, m.r * 0.82, m.r * 0.72, m.r * 0.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(12,8,18,0.28)";
      ctx.fill();
    }
    const g = ctx.createRadialGradient(-m.r * 0.32, -m.r * 0.36, m.r * 0.08, m.r * 0.1, m.r * 0.15, m.r);
    g.addColorStop(0, m.fill);
    g.addColorStop(0.55, m.mid);
    g.addColorStop(1, m.deep);
    ctx.beginPath();
    ctx.arc(0, 0, m.r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-m.r * 0.28, -m.r * 0.32, m.r * 0.38, m.r * 0.22, -0.45, 0, Math.PI * 2);
    ctx.fillStyle = ghost ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.38)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, m.r - 0.8, 0, Math.PI * 2);
    ctx.stroke();
    const specks = 4 + (b.type % 4);
    ctx.fillStyle = m.speck;
    ctx.globalAlpha = ghost ? 0.2 : 0.28;
    for (let i = 0; i < specks; i++) {
      const a = i * 2.4 + b.type;
      const rr = m.r * (0.18 + (i % 3) * 0.16);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rr * 0.7, Math.sin(a) * rr * 0.55, 1.1 + b.type * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBowl() {
    const { left, right, top, bottom } = BOWL;
    ctx.save();
    const bg = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    bg.addColorStop(0, "#1a1426");
    bg.addColorStop(1, "#120e1a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    const lanterns = [
      [70, 48, 26, "rgba(240,180,90,0.16)"],
      [350, 42, 22, "rgba(232,154,171,0.12)"],
      [210, 30, 18, "rgba(125,155,106,0.1)"]
    ];
    for (const [x, y, r, c] of lanterns) {
      const lg = ctx.createRadialGradient(x, y, 2, x, y, r * 3);
      lg.addColorStop(0, c);
      lg.addColorStop(1, "transparent");
      ctx.fillStyle = lg;
      ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    }
    ctx.beginPath();
    ctx.moveTo(left - 10, top - 8);
    ctx.lineTo(left, bottom);
    ctx.quadraticCurveTo(WORLD_W / 2, bottom + 22, right, bottom);
    ctx.lineTo(right + 10, top - 8);
    ctx.closePath();
    const ceramic = ctx.createLinearGradient(left, top, right, bottom);
    ceramic.addColorStop(0, "#2a2236");
    ceramic.addColorStop(0.5, "#3a2e28");
    ceramic.addColorStop(1, "#241c22");
    ctx.fillStyle = ceramic;
    ctx.fill();
    const rimY = 88;
    ctx.beginPath();
    ctx.moveTo(left, rimY);
    ctx.lineTo(left, bottom);
    ctx.quadraticCurveTo(WORLD_W / 2, bottom + 16, right, bottom);
    ctx.lineTo(right, rimY);
    ctx.strokeStyle = "rgba(212,165,116,0.5)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "rgba(212,165,116,0.12)";
    ctx.fillRect(left - 7, rimY - 6, 7, 12);
    ctx.fillRect(right, rimY - 6, 7, 12);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, 88, right - left, bottom - 88);
    ctx.clip();
    const paper = ctx.createLinearGradient(0, 88, 0, bottom);
    paper.addColorStop(0, "#2a2433");
    paper.addColorStop(1, "#1c1824");
    ctx.fillStyle = paper;
    ctx.fillRect(left, 88, right - left, bottom - 88);
    ctx.restore();
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = overflowTimer > 0.4 ? "rgba(232,154,171,0.85)" : "rgba(212,165,116,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left + 6, DANGER);
    ctx.lineTo(right - 6, DANGER);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "600 10px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = "rgba(212,165,116,0.7)";
    ctx.fillText("RIM", left + 8, DANGER - 6);
    ctx.restore();
  }

  function drawAim() {
    if (mode !== "playing" || !canDrop) return;
    const m = MOCHI[current];
    const x = Math.max(BOWL.left + m.r, Math.min(BOWL.right - m.r, aimX));
    ctx.save();
    ctx.setLineDash([4, 7]);
    ctx.strokeStyle = "rgba(243,230,208,0.28)";
    ctx.beginPath();
    ctx.moveTo(x, 78);
    ctx.lineTo(x, DANGER + 8);
    ctx.stroke();
    ctx.setLineDash([]);
    drawMochi({ x, y: 78, type: current, sx: 1, sy: 1 }, true);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const jx = reduced ? 0 : (Math.random() - 0.5) * shake;
    const jy = reduced ? 0 : (Math.random() - 0.5) * shake;
    ctx.setTransform(scale, 0, 0, scale, ox + jx * scale, oy + jy * scale);
    drawBowl();
    drawAim();
    ctx.save();
    ctx.beginPath();
    ctx.rect(BOWL.left, 0, BOWL.right - BOWL.left, BOWL.bottom);
    ctx.clip();
    const ordered = balls.slice().sort((a, b) => a.y - b.y);
    for (const b of ordered) drawMochi(b, false);
    ctx.restore();
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = "650 16px Fraunces, serif";
    ctx.textAlign = "center";
    for (const f of floaters) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = "#fff6e8";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
  }

  function frame(t) {
    const dt = Math.min(0.033, (t - lastT) / 1000) || 0.016;
    lastT = t;
    if (mode === "playing") {
      if (keys.ArrowLeft || keys.a || keys.A) aimX -= 280 * dt;
      if (keys.ArrowRight || keys.d || keys.D) aimX += 280 * dt;
      const r = MOCHI[current].r;
      aimX = Math.max(BOWL.left + r, Math.min(BOWL.right - r, aimX));
      stepPhysics(dt);
      stepFx(dt);
      maybeUnlockDrop(t);
      checkOverflow(dt);
    } else {
      stepFx(dt * 0.4);
    }
    render();
    requestAnimationFrame(frame);
  }

  function onKey(e, down) {
    keys[e.key] = down;
    if (!down) return;
    if (e.key === "m" || e.key === "M") {
      setMuted(!muted);
      return;
    }
    if (mode === "start" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      play();
      return;
    }
    if (mode === "over" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      play();
      return;
    }
    if (mode === "pause" && (e.key === "Enter" || e.key === " " || e.key === "Escape")) {
      e.preventDefault();
      resume();
      return;
    }
    if (mode === "playing") {
      if (e.key === "Escape") { e.preventDefault(); pause(); return; }
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); dropNow(); }
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (mode !== "playing") return;
    canvas.setPointerCapture(e.pointerId);
    pointerDown = true;
    pointerId = e.pointerId;
    aimX = worldFromEvent(e);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (mode !== "playing") return;
    if (pointerDown && e.pointerId !== pointerId && e.pointerType === "touch") return;
    aimX = worldFromEvent(e);
  });
  canvas.addEventListener("pointerup", (e) => {
    if (mode !== "playing") return;
    if (pointerDown) {
      aimX = worldFromEvent(e);
      dropNow();
    }
    pointerDown = false;
    pointerId = null;
  });
  canvas.addEventListener("pointercancel", () => {
    pointerDown = false;
    pointerId = null;
  });

  window.addEventListener("keydown", (e) => onKey(e, true));
  window.addEventListener("keyup", (e) => onKey(e, false));
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && mode === "playing") pause();
  });

  document.getElementById("play-btn").addEventListener("click", play);
  document.getElementById("resume-btn").addEventListener("click", resume);
  document.getElementById("retry-btn").addEventListener("click", play);
  document.getElementById("restart-from-pause").addEventListener("click", play);
  el.pause.addEventListener("click", () => {
    if (mode === "playing") pause();
    else if (mode === "pause") resume();
  });
  el.mute.addEventListener("click", () => setMuted(!muted));

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  buildLegend();
  setMuted(muted);
  setScore(0);
  current = randDrop();
  nextType = randDrop();
  paintNext();
  showScreen("start");
  resize();
  lastT = performance.now();
  requestAnimationFrame(frame);
})();

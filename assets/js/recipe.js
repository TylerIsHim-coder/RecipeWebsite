/* EasyRecipes — interactive recipe pages: servings scaler, checklists, timers, cook mode. */
(function () {
  "use strict";

  const ER = window.ER;
  const article = document.querySelector(".recipe");
  if (!ER || !article) return;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const id = article.dataset.recipeId;
  const recipe = ER.byId[id] || { id, title: $(".recipe-title").textContent, categories: [] };
  const progressKey = `er-progress-${id}`;
  const saved = ER.store.get(progressKey, { ing: [], steps: [] });
  ER.recent.add(id);

  const ICON = {
    print: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><path d="M6 14h12v7H6z"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22c4 0 7-2.7 7-7 0-4-3-6.5-4-10-2 2-2.5 4-2.5 5.5C11 9 10 7.5 10 6c-3 2.5-5 5.6-5 9 0 4.3 3 7 7 7z"/></svg>',
    timer: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>',
  };

  /* ---------- action bar ---------- */
  const actions = $("#recipe-actions");
  const wakeSupported = "wakeLock" in navigator;
  actions.innerHTML = `
    <button class="btn btn-primary" type="button" data-fav="${id}" aria-pressed="false">${ER.ICONS.heart}<span class="fav-label">Save</span></button>
    <button class="btn" type="button" id="cook-mode" aria-pressed="false" title="${wakeSupported ? "Keeps your screen awake and enlarges the steps" : "Enlarges the steps for cooking"}">${ICON.flame}Cook mode</button>
    <button class="btn" type="button" id="print-recipe">${ICON.print}Print</button>
    <button class="btn" type="button" id="share-recipe">${ICON.share}Share</button>`;
  ER.syncFavorites();

  $("#print-recipe").addEventListener("click", () => window.print());
  $("#share-recipe").addEventListener("click", async () => {
    const data = { title: recipe.title, text: `${recipe.title} on EasyRecipes`, url: location.href };
    if (navigator.share) { try { await navigator.share(data); } catch (e) { /* cancelled */ } return; }
    try { await navigator.clipboard.writeText(location.href); ER.toast("Link copied to clipboard"); } catch (e) { ER.toast("Copy the link from your address bar"); }
  });

  let wakeLock = null;
  const cookBtn = $("#cook-mode");
  async function requestWake() {
    if (!wakeSupported) return;
    try { wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { wakeLock = null; }
  }
  cookBtn.addEventListener("click", async () => {
    const on = !document.body.classList.contains("cook-mode");
    document.body.classList.toggle("cook-mode", on);
    cookBtn.setAttribute("aria-pressed", on);
    if (on) { await requestWake(); ER.toast(wakeSupported ? "Cook mode on: your screen will stay awake" : "Cook mode on"); }
    else { if (wakeLock) wakeLock.release(); wakeLock = null; }
    markCurrent();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && document.body.classList.contains("cook-mode")) requestWake();
  });

  /* ---------- quantities & scaling ---------- */
  const FRACTIONS = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875, "⅕": 0.2, "⅙": 1 / 6 };
  const F = "¼½¾⅓⅔⅛⅜⅝⅞⅕⅙";
  const NUM = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\s*[${F}]|\\d+\\/\\d+|\\d*\\.\\d+|\\d+|[${F}])`;
  const QTY_RE = new RegExp(`^(\\s*)(${NUM})(?:(\\s*(?:-|–|to)\\s*)(${NUM}))?(?![\\d/])`);

  function parseNum(s) {
    s = s.trim();
    let m;
    if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return +m[1] + m[2] / m[3];
    if ((m = s.match(new RegExp(`^(\\d+)\\s*([${F}])$`)))) return +m[1] + FRACTIONS[m[2]];
    if ((m = s.match(/^(\d+)\/(\d+)$/))) return m[1] / m[2];
    if (FRACTIONS[s] !== undefined) return FRACTIONS[s];
    return parseFloat(s);
  }

  function formatNum(n) {
    if (n <= 0) return "0";
    const whole = Math.floor(n + 1e-9);
    const frac = n - whole;
    if (frac < 0.04) return String(whole);
    if (frac > 0.96) return String(whole + 1);
    const nice = [[1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"], [1 / 2, "½"], [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"]];
    const hit = nice.find(([v]) => Math.abs(v - frac) < 0.04);
    if (hit) return whole ? `${whole} ${hit[1]}` : hit[1];
    return String(Math.round(n * 10) / 10);
  }

  const qtySpans = [];
  $$(".ingredient-list li").forEach((li, i) => {
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = saved.ing.includes(i);
    box.addEventListener("change", () => {
      saved.ing = box.checked ? [...saved.ing, i] : saved.ing.filter((x) => x !== i);
      ER.store.set(progressKey, saved);
      paintProgress();
    });
    const span = document.createElement("span");
    while (li.firstChild) span.appendChild(li.firstChild);
    const first = span.firstChild;
    if (first && first.nodeType === Node.TEXT_NODE) {
      const m = first.textContent.match(QTY_RE);
      if (m) {
        const q = document.createElement("span");
        q.className = "qty";
        q.dataset.a = parseNum(m[2]);
        if (m[4]) { q.dataset.b = parseNum(m[4]); q.dataset.sep = m[3]; }
        q.textContent = m[0].trim();
        first.textContent = first.textContent.slice(m[0].length);
        span.insertBefore(q, first);
        qtySpans.push(q);
      }
    }
    label.append(box, span);
    li.appendChild(label);
  });

  function applyScale(factor) {
    qtySpans.forEach((q) => {
      const a = formatNum(q.dataset.a * factor);
      q.textContent = q.dataset.b ? `${a}${q.dataset.sep}${formatNum(q.dataset.b * factor)}` : a;
      q.classList.toggle("scaled", factor !== 1);
    });
  }

  const ingHead = $(".recipe-ingredients .panel-head");
  const base = parseInt(article.dataset.yields, 10);
  if (qtySpans.length && ingHead) {
    const scaler = document.createElement("div");
    scaler.className = "scaler";
    if (base) {
      let servings = base;
      scaler.innerHTML = `<button type="button" aria-label="Fewer servings">−</button><output aria-live="polite" title="Ingredient amounts update automatically"></output><button type="button" aria-label="More servings">+</button>`;
      const [minus, plus] = $$("button", scaler);
      const out = $("output", scaler);
      const paint = () => { out.textContent = `${servings} serving${servings === 1 ? "" : "s"}`; applyScale(servings / base); minus.disabled = servings <= 1; };
      minus.addEventListener("click", () => { servings = Math.max(1, servings - 1); paint(); });
      plus.addEventListener("click", () => { servings = Math.min(base * 10, servings + 1); paint(); });
      paint();
    } else {
      scaler.setAttribute("role", "group");
      scaler.setAttribute("aria-label", "Scale recipe");
      scaler.innerHTML = [0.5, 1, 2, 3].map((f) => `<button type="button" data-factor="${f}" aria-pressed="${f === 1}">${f === 0.5 ? "½" : f}×</button>`).join("");
      scaler.addEventListener("click", (e) => {
        const b = e.target.closest("[data-factor]");
        if (!b) return;
        $$("button", scaler).forEach((x) => x.setAttribute("aria-pressed", x === b));
        applyScale(+b.dataset.factor);
      });
    }
    ingHead.appendChild(scaler);
  }

  /* ---------- steps: progress + timers ---------- */
  const steps = $$(".step-list li");
  const dirHead = $(".recipe-directions .panel-head");
  const progress = document.createElement("div");
  progress.className = "progress";
  progress.innerHTML = `<span class="progress-text"></span><span class="progress-bar"><span></span></span><button class="link-btn" type="button" hidden>Reset</button>`;
  if (dirHead && steps.length) dirHead.appendChild(progress);
  const resetBtn = $("button", progress);

  function markCurrent() {
    steps.forEach((s) => s.classList.remove("current"));
    if (!document.body.classList.contains("cook-mode")) return;
    const next = steps.find((s) => !s.classList.contains("done"));
    if (next) { next.classList.add("current"); next.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }

  function paintProgress() {
    const done = steps.filter((s) => s.classList.contains("done")).length;
    $(".progress-text", progress).textContent = done === steps.length && done ? "All done. Enjoy!" : `${done} of ${steps.length} done`;
    $(".progress-bar span", progress).style.width = `${steps.length ? (done / steps.length) * 100 : 0}%`;
    resetBtn.hidden = !done && !saved.ing.length;
  }

  function addTimers(li, stepNo) {
    const re = /(\d+(?:\.\d+)?|½)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;
    const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) if (!walker.currentNode.parentElement.closest("a")) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const text = node.textContent;
      const frag = document.createDocumentFragment();
      let last = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(text))) {
        const n = m[1] === "½" ? 0.5 : parseFloat(m[1]);
        const unit = m[3].toLowerCase();
        const secs = Math.round(n * (unit.startsWith("h") ? 3600 : unit.startsWith("s") ? 1 : 60));
        if (!secs || secs > 12 * 3600) continue;
        frag.append(text.slice(last, m.index));
        const b = document.createElement("button");
        b.type = "button";
        b.className = "timer-chip";
        b.title = `Start a ${m[0]} timer`;
        b.innerHTML = ICON.timer;
        b.append(m[0]);
        const label = `Step ${stepNo} · ${m[0]}`;
        b.addEventListener("click", (e) => { e.stopPropagation(); startTimer(secs, label); });
        frag.append(b);
        last = m.index + m[0].length;
      }
      if (!last) return;
      frag.append(text.slice(last));
      node.replaceWith(frag);
    });
  }

  steps.forEach((li, i) => {
    li.tabIndex = 0;
    li.setAttribute("role", "checkbox");
    const setDone = (on) => { li.classList.toggle("done", on); li.setAttribute("aria-checked", on); };
    setDone(saved.steps.includes(i));
    const toggle = () => {
      const on = !li.classList.contains("done");
      setDone(on);
      saved.steps = on ? [...saved.steps, i] : saved.steps.filter((x) => x !== i);
      ER.store.set(progressKey, saved);
      paintProgress();
      markCurrent();
    };
    li.addEventListener("click", (e) => { if (!e.target.closest("a, button")) toggle(); });
    li.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && e.target === li) { e.preventDefault(); toggle(); } });
    addTimers(li, i + 1);
  });
  resetBtn.addEventListener("click", () => {
    saved.ing = []; saved.steps = [];
    ER.store.remove(progressKey);
    steps.forEach((s) => { s.classList.remove("done"); s.setAttribute("aria-checked", "false"); });
    $$(".ingredient-list input").forEach((b) => { b.checked = false; });
    paintProgress(); markCurrent();
  });
  paintProgress();

  /* ---------- timer tray ---------- */
  let tray;
  const timers = new Set();
  let audioCtx;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach((t) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = 880; o.type = "sine";
        g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.28);
        o.connect(g).connect(audioCtx.destination);
        o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.3);
      });
    } catch (e) { /* audio unavailable */ }
  }
  const fmt = (s) => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(x).padStart(2, "0")}`; };

  function startTimer(seconds, label) {
    if (!tray) { tray = document.createElement("div"); tray.className = "timer-tray"; tray.setAttribute("aria-live", "polite"); document.body.appendChild(tray); }
    if ("Notification" in window && Notification.permission === "default") { try { Notification.requestPermission(); } catch (e) { /* ignore */ } }
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === "suspended") audioCtx.resume(); } catch (e) { /* ignore */ }
    const el = document.createElement("div");
    el.className = "timer";
    el.innerHTML = `<div class="timer-label"><span>${ER.esc(label)}</span></div><div class="timer-time">${fmt(seconds)}</div>
      <div class="timer-buttons"><button type="button" data-act="add" title="Add 1 minute">+1m</button><button type="button" data-act="pause">Pause</button><button type="button" data-act="close" aria-label="Dismiss timer">✕</button></div>`;
    tray.appendChild(el);
    const t = { el, label, end: Date.now() + seconds * 1000, remaining: seconds * 1000, paused: false, finished: false, ringTimer: null };
    timers.add(t);
    ER.toast(`Timer started: ${fmt(seconds)}`);
    el.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]");
      if (!act) return;
      if (act.dataset.act === "close") { clearInterval(t.ringTimer); timers.delete(t); el.remove(); }
      if (act.dataset.act === "add") {
        if (t.finished) {
          t.finished = false; clearInterval(t.ringTimer);
          el.classList.remove("finished"); $('[data-act="pause"]', el).hidden = false;
          t.end = Date.now() + 60000;
        } else if (t.paused) t.remaining += 60000; else t.end += 60000;
        tick();
      }
      if (act.dataset.act === "pause" && !t.finished) {
        t.paused = !t.paused;
        if (t.paused) t.remaining = t.end - Date.now(); else t.end = Date.now() + t.remaining;
        act.textContent = t.paused ? "Resume" : "Pause";
        el.classList.toggle("paused", t.paused);
      }
    });
    tick();
  }

  function tick() {
    timers.forEach((t) => {
      if (t.finished) return;
      const left = t.paused ? t.remaining : t.end - Date.now();
      $(".timer-time", t.el).textContent = fmt(left / 1000);
      if (left <= 0 && !t.paused) {
        t.finished = true;
        t.el.classList.add("finished");
        $(".timer-time", t.el).textContent = "Done!";
        $('[data-act="pause"]', t.el).hidden = true;
        beep();
        t.ringTimer = setInterval(beep, 4000);
        setTimeout(() => clearInterval(t.ringTimer), 30000);
        if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
        if ("Notification" in window && Notification.permission === "granted" && document.hidden) new Notification("Timer done", { body: `${recipe.title}: ${t.label}`, icon: "images/brand/logo.png" });
        ER.toast(`Timer done: ${t.label}`);
      }
    });
    const running = [...timers].filter((t) => !t.finished && !t.paused);
    document.title = running.length ? `⏱ ${fmt(Math.min(...running.map((t) => t.end - Date.now())) / 1000)} · ${recipe.title}` : `${recipe.title} | EasyRecipes`;
  }
  setInterval(() => { if (timers.size) tick(); }, 500);
  window.addEventListener("beforeunload", (e) => { if ([...timers].some((t) => !t.finished)) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- related recipes ---------- */
  const related = $("#related");
  if (related && recipe.categories.length) {
    const specific = recipe.categories.filter((c) => c !== "main" && c !== "tyler");
    const picks = ER.recipes.filter((r) => r.id !== id).map((r) => {
      let s = 0;
      r.categories.forEach((c) => { if (specific.includes(c)) s += 3; else if (recipe.categories.includes(c)) s += 1; });
      return { r, s };
    }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.r.title.localeCompare(b.r.title)).slice(0, 4).map((x) => x.r);
    if (picks.length) {
      related.hidden = false;
      related.innerHTML = `<div class="section-head"><h2>You might also like</h2></div><div class="card-grid card-grid-compact"></div>`;
      ER.renderCards($(".card-grid", related), picks);
      ER.syncFavorites();
    }
  }
})();

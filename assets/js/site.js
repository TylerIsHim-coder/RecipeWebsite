/* EasyRecipes — shared behaviour for every page (header, search, cards, favorites). */
(function () {
  "use strict";

  const DATA = window.EASY_RECIPES || { categories: [], recipes: [] };
  const recipes = DATA.recipes;
  const categories = DATA.categories;
  const byId = Object.fromEntries(recipes.map((r) => [r.id, r]));
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const topCategories = categories.filter((c) => !c.parent);

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const ICONS = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    heart: '<svg class="heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    users: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M21 19v-1a4 4 0 0 0-3-3.9M15.5 4.1a3.5 3.5 0 0 1 0 6.8"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dice: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/></svg>',
    folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  };

  /* ---------- storage ---------- */
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ } },
    remove(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } },
  };

  const favorites = {
    list: () => store.get("er-favs", []).filter((id) => byId[id]),
    has: (id) => favorites.list().includes(id),
    toggle(id) {
      const list = favorites.list();
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1); else list.unshift(id);
      store.set("er-favs", list);
      syncFavorites();
      return i < 0;
    },
  };

  const recent = {
    list: () => store.get("er-recent", []).filter((id) => byId[id]),
    add(id) { store.set("er-recent", [id, ...recent.list().filter((x) => x !== id)].slice(0, 8)); },
  };

  /* ---------- category helpers ---------- */
  function descendants(catId) {
    const out = [catId];
    categories.forEach((c) => { if (c.parent === catId) out.push(...descendants(c.id)); });
    return out;
  }
  function ancestors(catId) {
    const out = [];
    let c = catById[catId];
    while (c) { out.unshift(c.id); c = catById[c.parent]; }
    return out;
  }
  function inCategory(recipe, catId) {
    const ids = descendants(catId);
    return recipe.categories.some((c) => ids.includes(c));
  }
  function primaryCategory(r) {
    const c = r.categories.find((x) => x !== "main" && x !== "tyler") || r.categories[0];
    return catById[c];
  }
  function countIn(catId) { return recipes.filter((r) => inCategory(r, catId)).length; }

  const newestIds = recipes.slice().sort((a, b) => (b.added || "").localeCompare(a.added || "")).slice(0, 6).map((r) => r.id);

  /* ---------- cards ---------- */
  function shortTime(r) {
    if (!r.minutes) return null;
    const h = Math.floor(r.minutes / 60), m = r.minutes % 60;
    return h ? `${h} hr${m ? ` ${m} min` : ""}` : `${m} min`;
  }

  function cardHTML(r) {
    const cat = primaryCategory(r);
    const fav = favorites.has(r.id);
    const time = shortTime(r);
    return `<article class="recipe-card" data-id="${r.id}">
      <a class="card-link" href="${r.id}.html">
        <div class="card-media"><img src="images/thumbs/${r.id}.webp" alt="" loading="lazy" width="640" height="480"></div>
        <div class="card-body">
          ${cat ? `<p class="card-kicker">${esc(cat.name)}</p>` : ""}
          <h3 class="card-title">${esc(r.title)}</h3>
          <p class="card-meta">${time ? `<span>${ICONS.clock}${time}</span>` : ""}${r.servings ? `<span>${ICONS.users}${esc(r.servings)}</span>` : ""}</p>
        </div>
      </a>
      ${newestIds.includes(r.id) ? '<span class="card-badge">New</span>' : ""}
      <button class="fav-btn" type="button" data-fav="${r.id}" aria-pressed="${fav}" aria-label="${fav ? "Remove from" : "Save to"} favorites: ${esc(r.title)}">${ICONS.heart}</button>
    </article>`;
  }

  function renderCards(el, list) {
    if (!el) return;
    el.innerHTML = list.map(cardHTML).join("");
    $$(".recipe-card", el).forEach((card, i) => { card.style.animationDelay = `${Math.min(i, 12) * 30}ms`; });
  }

  function syncFavorites() {
    const list = favorites.list();
    $$("[data-fav]").forEach((b) => {
      const on = list.includes(b.dataset.fav);
      b.setAttribute("aria-pressed", on);
      const title = byId[b.dataset.fav] ? byId[b.dataset.fav].title : "";
      if (b.classList.contains("fav-btn")) b.setAttribute("aria-label", `${on ? "Remove from" : "Save to"} favorites: ${title}`);
      const label = $(".fav-label", b);
      if (label) label.textContent = on ? "Saved" : "Save";
    });
    $$("[data-fav-count]").forEach((el) => { el.textContent = list.length || ""; });
  }

  document.addEventListener("click", (e) => {
    const favBtn = e.target.closest("[data-fav]");
    if (favBtn) {
      e.preventDefault();
      const added = favorites.toggle(favBtn.dataset.fav);
      favBtn.classList.remove("pop"); void favBtn.offsetWidth; favBtn.classList.add("pop");
      toast(added ? "Saved to favorites" : "Removed from favorites");
      if (document.body.dataset.page === "favorites" && !added) renderFavoritesPage();
      return;
    }
    if (e.target.closest("[data-surprise]")) {
      const pick = recipes[Math.floor(Math.random() * recipes.length)];
      location.href = `${pick.id}.html`;
    }
  });

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    let el = $(".toast");
    if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ---------- search ---------- */
  const normalize = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const singular = (w) => (w.length > 3 && /(ch|sh|ss|x|o)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
  const STOPWORDS = new Set(["a", "an", "and", "the", "with", "of", "in", "recipe", "recipes", "dish", "dishes", "food", "easy", "best", "how", "to", "make", "for", "my"]);

  function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        best = Math.min(best, cur[j]);
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  const index = recipes.map((r) => {
    const catNames = r.categories.flatMap((c) => ancestors(c)).map((c) => catById[c].name + " " + (catById[c].aliases || []).join(" "));
    const fields = { title: normalize(r.title), aliases: r.aliases.map(normalize), cats: normalize(catNames.join(" ")), ingredients: normalize(r.ingredients) };
    const words = (s) => s.split(" ").filter(Boolean).map(singular);
    return { r, fields, titleWords: words(fields.title), aliasWords: words(fields.aliases.join(" ")), catWords: words(fields.cats), ingWords: words(fields.ingredients) };
  });

  function matchWord(q, words) {
    let best = 0;
    for (const w of words) {
      if (w === q) return 1;
      if (w.startsWith(q) && q.length >= 2) best = Math.max(best, 0.85);
      else if (q.length >= 4 && w.includes(q)) best = Math.max(best, 0.6);
      else if (q.length >= 4) {
        const max = q.length >= 7 ? 2 : 1;
        const d = editDistance(q, w, max);
        if (d <= max) best = Math.max(best, d === 1 ? 0.7 : 0.5);
      }
    }
    return best;
  }

  /** Understands phrases like "under 30 min" or "quick" as a time limit. */
  function parseQuery(raw) {
    let q = normalize(raw);
    let maxMinutes = null;
    const m = q.match(/\b(?:under|less than|in|within|max)\s*(\d+)\s*(min|mins|minute|minutes|m|hour|hours|hr|hrs|h)?\b/);
    if (m) {
      maxMinutes = parseInt(m[1], 10) * (/^h/.test(m[2] || "") ? 60 : 1);
      q = q.replace(m[0], " ");
    } else if (/\b(quick|fast|weeknight)\b/.test(q)) {
      maxMinutes = 30;
      q = q.replace(/\b(quick|fast|weeknight)\b/, " ");
    }
    const terms = q.split(" ").filter((t) => t && !STOPWORDS.has(t)).map(singular);
    return { text: normalize(q), terms, maxMinutes };
  }

  function search(raw) {
    const { text, terms, maxMinutes } = parseQuery(raw);
    let results = [];
    if (!terms.length) {
      results = recipes.map((r) => ({ r, score: 0 }));
    } else {
      for (const item of index) {
        let score = 0;
        let allMatched = true;
        if (item.fields.title === text) score += 100;
        else if (item.fields.title.startsWith(text)) score += 40;
        else if (item.fields.title.includes(text)) score += 25;
        if (item.fields.aliases.includes(text)) score += 60;
        for (const t of terms) {
          const s = Math.max(matchWord(t, item.titleWords) * 10, matchWord(t, item.aliasWords) * 8, matchWord(t, item.catWords) * 6, matchWord(t, item.ingWords) * 4);
          if (s === 0) allMatched = false;
          score += s;
        }
        if (allMatched && score > 0) results.push({ r: item.r, score });
      }
    }
    if (maxMinutes) results = results.filter((x) => x.r.minutes && x.r.minutes <= maxMinutes);
    results.sort((a, b) => b.score - a.score || a.r.title.localeCompare(b.r.title));
    return { results: results.map((x) => x.r), terms, maxMinutes, text };
  }

  function searchCategories(raw) {
    const t = normalize(raw);
    if (t.length < 2) return [];
    return categories.filter((c) => {
      const names = [normalize(c.name), ...(c.aliases || []).map(normalize)];
      return names.some((n) => n === t || n.startsWith(t) || (t.length >= 4 && editDistance(t, n, 1) <= 1));
    }).slice(0, 2);
  }

  function highlight(title, terms) {
    let out = esc(title);
    terms.filter((t) => t.length > 1).forEach((t) => {
      out = out.replace(new RegExp(`(^|\\s|\\()(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "$1<mark>$2</mark>");
    });
    return out;
  }

  function setupSearchBox(form) {
    const input = $("input", form);
    const pop = document.createElement("div");
    pop.className = "search-pop";
    pop.id = `pop-${Math.random().toString(36).slice(2, 8)}`;
    pop.setAttribute("role", "listbox");
    pop.hidden = true;
    form.appendChild(pop);
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", pop.id);
    input.setAttribute("aria-expanded", "false");
    let active = -1;

    const options = () => $$(".search-option", pop);
    const close = () => { pop.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; };
    const setActive = (i) => {
      const opts = options();
      opts.forEach((o, k) => o.setAttribute("aria-selected", k === i));
      active = i;
      if (opts[i]) { opts[i].scrollIntoView({ block: "nearest" }); input.setAttribute("aria-activedescendant", opts[i].id); }
    };

    function render() {
      const q = input.value.trim();
      if (!q) { close(); return; }
      const { results, terms, maxMinutes } = search(q);
      const cats = searchCategories(q);
      let html = "";
      if (cats.length) {
        html += '<div class="pop-label">Categories</div>' + cats.map((c, i) => `<a class="search-option" role="option" id="${pop.id}-c${i}" href="${c.page}"><span class="opt-icon">${ICONS.folder}</span><span><strong>${esc(c.name)}</strong><small>${countIn(c.id)} recipes</small></span></a>`).join("");
      }
      if (results.length) {
        html += `<div class="pop-label">Recipes${maxMinutes ? ` · under ${maxMinutes} min` : ""}</div>` + results.slice(0, 6).map((r, i) => `<a class="search-option" role="option" id="${pop.id}-r${i}" href="${r.id}.html"><img src="images/thumbs/${r.id}.webp" alt="" loading="lazy"><span><strong>${highlight(r.title, terms)}</strong><small>${[shortTime(r), primaryCategory(r) && primaryCategory(r).name].filter(Boolean).join(" · ")}</small></span></a>`).join("");
        html += `<a class="pop-all" href="recipes.html?q=${encodeURIComponent(q)}">See all ${results.length} result${results.length === 1 ? "" : "s"}</a>`;
      } else if (!cats.length) {
        html += `<div class="pop-empty">No recipes match “${esc(q)}”. Try an ingredient like <em>chicken</em> or <em>garlic</em>.</div>`;
      }
      pop.innerHTML = html;
      pop.hidden = false;
      input.setAttribute("aria-expanded", "true");
      active = -1;
    }

    input.addEventListener("input", render);
    input.addEventListener("focus", () => { if (input.value.trim()) render(); });
    input.addEventListener("keydown", (e) => {
      const opts = options();
      if (e.key === "ArrowDown" && opts.length) { e.preventDefault(); setActive((active + 1) % opts.length); }
      else if (e.key === "ArrowUp" && opts.length) { e.preventDefault(); setActive((active - 1 + opts.length) % opts.length); }
      else if (e.key === "Enter" && active >= 0 && opts[active]) { e.preventDefault(); location.href = opts[active].href; }
      else if (e.key === "Escape") { close(); input.blur(); }
    });
    document.addEventListener("click", (e) => { if (!form.contains(e.target)) close(); });
    form.addEventListener("submit", (e) => { if (!input.value.trim()) e.preventDefault(); });
  }

  /* ---------- header & footer ---------- */
  function currentFile() { return location.pathname.split("/").pop() || "index.html"; }

  function buildHeader() {
    const header = $("#site-header");
    if (!header) return;
    const page = currentFile();
    const pageCat = document.body.dataset.category;
    const activeTop = pageCat ? ancestors(pageCat)[0] : null;
    const navLinks = [{ name: "All recipes", page: "recipes.html" }, ...topCategories];
    header.innerHTML = `
      <div class="container header-inner">
        <a class="brand" href="index.html"><img src="images/brand/logo.png" alt="" width="30" height="30"><span>EasyRecipes</span></a>
        <form class="header-search" action="recipes.html" role="search">
          <label class="visually-hidden" for="site-q">Search recipes</label>
          <span class="search-icon">${ICONS.search}</span>
          <input id="site-q" name="q" type="search" placeholder="Search recipes or ingredients…" autocomplete="off">
          <kbd>/</kbd>
        </form>
        <div class="header-actions">
          <button class="icon-btn" type="button" data-surprise title="Surprise me with a random recipe" aria-label="Random recipe">${ICONS.dice}</button>
          <a class="icon-btn" href="favorites.html" title="My favorites" aria-label="My favorites">${ICONS.heart}<span class="label">Favorites</span><span class="badge-count" data-fav-count></span></a>
          <button class="icon-btn theme-toggle" type="button" aria-label="Toggle dark mode"></button>
        </div>
      </div>
      <nav class="cat-nav" aria-label="Recipe categories">
        <div class="container cat-nav-inner">
          ${navLinks.map((c) => `<a href="${c.page}"${c.page === page || c.id === activeTop ? ' aria-current="page"' : ""}>${esc(c.name)}</a>`).join("")}
        </div>
      </nav>`;
    const current = $('.cat-nav a[aria-current="page"]', header);
    if (current) current.parentElement.scrollLeft = current.offsetLeft - 40;

    const toggle = $(".theme-toggle", header);
    const isDark = () => (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
    const paint = () => { toggle.innerHTML = isDark() ? ICONS.sun : ICONS.moon; toggle.title = isDark() ? "Switch to light mode" : "Switch to dark mode"; };
    paint();
    toggle.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("er-theme", next); } catch (e) { /* ignore */ }
      paint();
    });

    const input = $("#site-q");
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    });
  }

  function buildFooter() {
    const footer = $("#site-footer");
    if (!footer) return;
    footer.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div>
            <a class="brand" href="index.html"><img src="images/brand/logo.png" alt="" width="30" height="30"><span>EasyRecipes</span></a>
            <p>${recipes.length} home-cooked recipes collected and tested by Tyler. Credit for each recipe goes to its original creator, linked on every recipe page.</p>
          </div>
          <div><h2>Categories</h2><ul>${topCategories.map((c) => `<li><a href="${c.page}">${esc(c.name)}</a></li>`).join("")}</ul></div>
          <div><h2>More</h2><ul style="columns:1"><li><a href="recipes.html">All recipes</a></li><li><a href="recipes.html?sort=newest">Newest recipes</a></li><li><a href="recipes.html?time=30">Under 30 minutes</a></li><li><a href="favorites.html">My favorites</a></li><li><a href="https://github.com/TylerIsHim-coder/RecipeWebsite">Source on GitHub</a></li></ul></div>
        </div>
        <div class="footer-bottom"><span>© ${new Date().getFullYear()} EasyRecipes</span><a href="#main">Back to top ↑</a></div>
      </div>`;
  }

  /* ---------- explorer (category pages + all recipes) ---------- */
  function renderExplorer() {
    const root = $("#explorer");
    if (!root) return;
    const fixedCat = document.body.dataset.category || null;
    const params = new URLSearchParams(location.search);
    const state = { q: params.get("q") || "", cat: params.get("cat") || "", time: params.get("time") || "", sort: params.get("sort") || "" };
    const chipCats = fixedCat ? categories.filter((c) => c.parent === fixedCat) : topCategories;

    root.innerHTML = `
      <div class="explorer-controls">
        <div class="explorer-row">
          <div class="explorer-search">
            <label class="visually-hidden" for="explorer-q">Filter recipes</label>
            <span class="search-icon">${ICONS.search}</span>
            <input id="explorer-q" type="search" placeholder="${fixedCat ? `Search ${esc(catById[fixedCat].name.toLowerCase())}…` : "Search by name or ingredient…"}" value="${esc(state.q)}" autocomplete="off">
          </div>
          <label class="visually-hidden" for="explorer-time">Cooking time</label>
          <select class="select" id="explorer-time">
            <option value="">Any cooking time</option>
            <option value="20">20 minutes or less</option>
            <option value="30">30 minutes or less</option>
            <option value="60">1 hour or less</option>
          </select>
          <label class="visually-hidden" for="explorer-sort">Sort</label>
          <select class="select" id="explorer-sort">
            <option value="">Sort: Best match</option>
            <option value="az">Sort: A–Z</option>
            <option value="quick">Sort: Quickest</option>
            <option value="newest">Sort: Newest</option>
          </select>
        </div>
        ${chipCats.length ? `<div class="chip-row" role="group" aria-label="Filter by category">
          <button class="chip" type="button" data-cat="">All</button>
          ${chipCats.map((c) => `<button class="chip" type="button" data-cat="${c.id}">${esc(c.name)}</button>`).join("")}
        </div>` : ""}
      </div>
      <p class="results-count" aria-live="polite"></p>
      <div class="card-grid" id="explorer-results"></div>
      <div class="empty-state" id="explorer-empty" hidden></div>`;

    const q = $("#explorer-q", root), time = $("#explorer-time", root), sort = $("#explorer-sort", root);
    time.value = state.time; sort.value = state.sort;
    if (!time.value) state.time = "";
    if (!sort.value) state.sort = "";

    function update() {
      let { results, maxMinutes } = search(state.q);
      if (fixedCat) results = results.filter((r) => inCategory(r, fixedCat));
      if (state.cat) results = results.filter((r) => inCategory(r, state.cat));
      if (state.time) results = results.filter((r) => r.minutes && r.minutes <= +state.time);
      const sorters = {
        az: (a, b) => a.title.localeCompare(b.title),
        quick: (a, b) => (a.minutes || 9999) - (b.minutes || 9999),
        newest: (a, b) => (b.added || "").localeCompare(a.added || ""),
      };
      if (sorters[state.sort]) results.sort(sorters[state.sort]);
      else if (!state.q.trim()) results.sort((a, b) => (b.featured - a.featured) || a.title.localeCompare(b.title));

      $$("[data-cat]", root).forEach((b) => b.setAttribute("aria-pressed", b.dataset.cat === state.cat));
      $(".results-count", root).textContent = `${results.length} recipe${results.length === 1 ? "" : "s"}${state.q.trim() ? ` for “${state.q.trim()}”` : ""}${maxMinutes ? ` under ${maxMinutes} min` : ""}`;
      renderCards($("#explorer-results", root), results);
      const empty = $("#explorer-empty", root);
      empty.hidden = results.length > 0;
      if (!results.length) {
        const ideas = ["chicken", "garlic", "salmon", "pasta", "rice", "chocolate"];
        empty.innerHTML = `<p class="empty-title">Nothing found</p><p>Try a different word, check the spelling, or clear the filters.</p>
          <div class="chip-row">${ideas.map((w) => `<button class="chip" type="button" data-idea="${w}">${w}</button>`).join("")}<button class="chip chip-accent" type="button" data-clear>Clear filters</button></div>`;
      }
      const p = new URLSearchParams();
      Object.entries(state).forEach(([k, v]) => { if (v) p.set(k, v); });
      history.replaceState(null, "", `${location.pathname}${p.toString() ? `?${p}` : ""}`);
      if (document.body.dataset.page === "all") document.title = state.q ? `“${state.q}” recipes | EasyRecipes` : "All Recipes | EasyRecipes";
      syncFavorites();
    }

    let t;
    q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { state.q = q.value; update(); }, 120); });
    time.addEventListener("change", () => { state.time = time.value; update(); });
    sort.addEventListener("change", () => { state.sort = sort.value; update(); });
    root.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-cat]");
      if (chip) { state.cat = chip.dataset.cat; update(); }
      const idea = e.target.closest("[data-idea]");
      if (idea) { state.q = q.value = idea.dataset.idea; state.cat = ""; state.time = time.value = ""; update(); }
      if (e.target.closest("[data-clear]")) { state.q = q.value = ""; state.cat = ""; state.time = time.value = ""; update(); }
    });
    update();
  }

  /* ---------- page renderers ---------- */
  function renderHome() {
    renderCards($("#featured"), recipes.filter((r) => r.featured));
    renderCards($("#newest"), newestIds.map((id) => byId[id]));
    renderCards($("#quick"), recipes.filter((r) => r.minutes && r.minutes <= 30).sort((a, b) => a.minutes - b.minutes || a.title.localeCompare(b.title)).slice(0, 8));
    const rv = recent.list();
    if (rv.length) { $("#recent-section").hidden = false; renderCards($("#recently-viewed"), rv.slice(0, 4).map((id) => byId[id])); }
    const grid = $("#category-grid");
    if (grid) {
      const used = new Set();
      grid.innerHTML = topCategories.map((c) => {
        const pool = recipes.filter((r) => inCategory(r, c.id));
        const cover = pool.find((r) => r.featured && !used.has(r.id)) || pool.find((r) => !used.has(r.id)) || pool[0];
        if (cover) used.add(cover.id);
        return `<a class="category-tile" href="${c.page}">${cover ? `<img src="images/thumbs/${cover.id}.webp" alt="" loading="lazy">` : ""}<span class="tile-text"><strong>${esc(c.name)}</strong><small>${pool.length} recipes</small></span></a>`;
      }).join("");
    }
    $$("[data-recipe-count]").forEach((el) => { el.textContent = recipes.length; });
  }

  function renderFavoritesPage() {
    const list = favorites.list().map((id) => byId[id]);
    renderCards($("#favorites"), list);
    $("#favorites-empty").hidden = list.length > 0;
  }

  /* ---------- boot ---------- */
  window.ER = { recipes, categories, byId, catById, store, favorites, recent, inCategory, primaryCategory, cardHTML, renderCards, toast, search, syncFavorites, ICONS, esc };

  buildHeader();
  buildFooter();
  $$(".header-search, .hero-search").forEach(setupSearchBox);
  const page = document.body.dataset.page;
  if (page === "home") renderHome();
  if (page === "category" || page === "all") renderExplorer();
  if (page === "favorites") renderFavoritesPage();
  syncFavorites();
})();

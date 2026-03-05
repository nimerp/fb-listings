(() => {
  // Prevent double injection
  if (document.getElementById("fb-listings-root")) return;

  // ─── Constants ───────────────────────────────────────────────────────────────
  const CACHE_PREFIX = "fb_listings_";
  const SIDEBAR_ID = "fb-listings-root";

  // ─── Styles (inlined so Shadow DOM is fully isolated from Facebook's CSS) ─────
  const STYLES = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      color: #1c1e21;
    }

    /* Host is already positioned fixed by sidebar.css — #fbl-sidebar just fills it */
    #fbl-sidebar {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      border-left: 1px solid #dddfe2;
      border-bottom: 1px solid #dddfe2;
      border-radius: 0 0 0 8px;
      box-shadow: -4px 4px 16px rgba(0,0,0,0.12);
      overflow: hidden;
      transition: width 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      color: #1c1e21;
    }

    #fbl-sidebar.fbl-collapsed { width: 36px; }

    /* Header */
    #fbl-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: #1877f2;
      color: #fff;
      flex-shrink: 0;
      user-select: none;
    }
    #fbl-logo {
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.3px;
      white-space: nowrap;
      overflow: hidden;
    }
    #fbl-header-actions { display: flex; gap: 6px; flex-shrink: 0; }
    #fbl-header-actions button {
      all: unset;
      background: rgba(255,255,255,0.2);
      color: #fff;
      width: 26px;
      height: 26px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    #fbl-header-actions button:hover { background: rgba(255,255,255,0.35); }

    /* Body */
    #fbl-body { display: flex; flex-direction: column; flex: 1; overflow: hidden; min-height: 0; }

    /* Action buttons */
    #fbl-actions { padding: 10px 12px 6px; display: flex; gap: 8px; flex-shrink: 0; }
    .fbl-primary-btn, .fbl-secondary-btn {
      all: unset;
      flex: 1;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: background 0.15s;
      text-align: center;
    }
    .fbl-primary-btn { background: #1877f2; color: #fff; }
    .fbl-primary-btn:hover:not(:disabled) { background: #166fe5; }
    .fbl-secondary-btn { background: #e4e6eb; color: #1c1e21; }
    .fbl-secondary-btn:hover:not(:disabled) { background: #d8dadf; }
    .fbl-primary-btn:disabled, .fbl-secondary-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Search */
    #fbl-search {
      all: unset;
      display: block;
      margin: 4px 12px 6px;
      padding: 7px 10px;
      border: 1px solid #dddfe2;
      border-radius: 20px;
      font-size: 13px;
      background: #f0f2f5;
      color: #1c1e21;
      flex-shrink: 0;
      width: calc(100% - 24px);
    }
    #fbl-search:focus { border-color: #1877f2; background: #fff; outline: none; }

    /* Tabs */
    #fbl-tabs {
      display: flex;
      border-bottom: 2px solid #e4e6eb;
      flex-shrink: 0;
      padding: 0 12px;
      gap: 4px;
    }
    .fbl-tab {
      all: unset;
      flex: 1;
      padding: 8px 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      color: #65676b;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: color 0.15s, border-color 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .fbl-tab:hover { color: #1877f2; }
    .fbl-tab.active { color: #1877f2; border-bottom-color: #1877f2; }
    .fbl-count {
      background: #e4e6eb;
      color: #1c1e21;
      border-radius: 10px;
      padding: 1px 7px;
      font-size: 11px;
      font-weight: 700;
    }
    .fbl-tab.active .fbl-count { background: #e7f0fd; color: #1877f2; }

    /* Status */
    .fbl-status {
      margin: 6px 12px 2px;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      display: none;
      flex-shrink: 0;
      line-height: 1.4;
    }
    .fbl-status-info    { background: #e7f0fd; color: #1877f2; display: block; }
    .fbl-status-success { background: #e6f4ea; color: #1e7e34; display: block; }
    .fbl-status-warn    { background: #fff3cd; color: #856404; display: block; }
    .fbl-status-error   { background: #fdecea; color: #c0392b; display: block; }

    /* Listings container */
    #fbl-listings-container {
      flex: 1;
      overflow-y: auto;
      padding: 6px 12px 12px;
      min-height: 0;
    }
    #fbl-listings-container::-webkit-scrollbar { width: 5px; }
    #fbl-listings-container::-webkit-scrollbar-track { background: transparent; }
    #fbl-listings-container::-webkit-scrollbar-thumb { background: #bec3c9; border-radius: 3px; }

    /* Empty state */
    .fbl-empty-state {
      text-align: center;
      color: #65676b;
      padding: 32px 16px;
      font-size: 13px;
      line-height: 1.5;
    }

    /* Cards */
    .fbl-card {
      background: #f0f2f5;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      border: 1px solid #e4e6eb;
      transition: box-shadow 0.15s;
    }
    .fbl-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .fbl-card-header { margin-bottom: 5px; }
    .fbl-listing-type {
      display: inline-block;
      background: #e7f0fd;
      color: #1877f2;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .fbl-card-title { font-weight: 700; font-size: 14px; color: #1c1e21; margin-bottom: 7px; line-height: 1.3; }
    .fbl-fields { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
    .fbl-field {
      background: #fff;
      border: 1px solid #dddfe2;
      border-radius: 4px;
      padding: 2px 7px;
      font-size: 11px;
      color: #65676b;
      white-space: nowrap;
    }
    .fbl-field-key { font-weight: 600; color: #444950; }
    .fbl-card-desc { font-size: 12px; color: #444950; line-height: 1.45; margin-bottom: 8px; }
    .fbl-card-link { display: inline-block; font-size: 12px; color: #1877f2; text-decoration: none; font-weight: 600; }
    .fbl-card-link:hover { text-decoration: underline; }
  `;

  // ─── Cache helpers ────────────────────────────────────────────────────────────
  function cacheKey() {
    return CACHE_PREFIX + normalizeGroupUrl(location.href);
  }

  function normalizeGroupUrl(url) {
    try {
      const u = new URL(url);
      return u.pathname.replace(/\/$/, "");
    } catch {
      return url;
    }
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(cacheKey());
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveCache(data) {
    try {
      localStorage.setItem(cacheKey(), JSON.stringify(data));
    } catch {}
  }

  function clearCache() {
    localStorage.removeItem(cacheKey());
  }

  // ─── DOM Extraction ───────────────────────────────────────────────────────────
  function extractGroupMeta() {
    const titleSelectors = [
      'h1[data-testid="group-name"]',
      '[data-pagelet="GroupFeed"] h1',
      'h1',
    ];
    let title = "";
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) { title = el.innerText.trim(); break; }
    }

    let description = "";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) description = metaDesc.getAttribute("content") || "";

    const aboutSelectors = [
      '[data-testid="group-description"]',
      '[id="groupsAboutSection"] span',
    ];
    for (const sel of aboutSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) { description = el.innerText.trim(); break; }
    }

    return { title: title || document.title, description };
  }

  function extractPosts() {
    const posts = [];
    const seen = new Set();
    const articles = document.querySelectorAll('[role="article"]');

    articles.forEach((article) => {
      if (article.closest('[role="article"] [role="article"]')) return;
      const text = extractPostText(article);
      if (!text || text.length < 20) return;
      const link = extractPostLink(article);
      const author = extractAuthorName(article);
      const key = text.slice(0, 100);
      if (seen.has(key)) return;
      seen.add(key);
      posts.push({ text, link, author });
    });

    return posts;
  }

  function extractPostText(article) {
    const clone = article.cloneNode(true);
    clone.querySelectorAll(
      "button, [role='button'], [aria-hidden='true'], svg, [data-visualcompletion='ignore']"
    ).forEach((n) => n.remove());
    return (clone.innerText || clone.textContent || "").trim().slice(0, 2000);
  }

  function extractPostLink(article) {
    const timeLinks = article.querySelectorAll("a[href*='/posts/'], a[href*='?story_fbid='], a[href*='/permalink/']");
    for (const a of timeLinks) {
      const href = a.getAttribute("href");
      if (href) return absoluteUrl(href);
    }
    for (const a of article.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      if (href && (href.includes("/posts/") || href.includes("story_fbid") || href.includes("/permalink/"))) {
        return absoluteUrl(href);
      }
    }
    return location.href;
  }

  function extractAuthorName(article) {
    const strongEl = article.querySelector("h2 strong, h3 strong, [data-testid='story-subtitle'] strong");
    if (strongEl) return strongEl.innerText.trim();
    const firstStrong = article.querySelector("strong");
    if (firstStrong) return firstStrong.innerText.trim();
    return "Unknown";
  }

  function absoluteUrl(href) {
    try { return new URL(href, location.origin).href; }
    catch { return href; }
  }

  // ─── Shadow DOM setup ─────────────────────────────────────────────────────────
  let shadow; // module-level ref so all helpers can query within it

  function $(id) { return shadow.getElementById(id); }
  function $$(sel) { return shadow.querySelectorAll(sel); }

  function createSidebar() {
    const host = document.createElement("div");
    host.id = SIDEBAR_ID;
    shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = STYLES;

    const container = document.createElement("div");
    container.innerHTML = `
      <div id="fbl-sidebar">
        <div id="fbl-header">
          <span id="fbl-logo">&#9776; Listings</span>
          <div id="fbl-header-actions">
            <button id="fbl-settings-btn" title="Settings">&#9881;</button>
            <button id="fbl-toggle-btn" title="Collapse">&#8249;</button>
          </div>
        </div>

        <div id="fbl-body">
          <div id="fbl-actions">
            <button id="fbl-generate-btn" class="fbl-primary-btn">&#9889; Generate Listings</button>
            <button id="fbl-refresh-btn" class="fbl-secondary-btn" style="display:none">&#8635; Refresh</button>
          </div>

          <input id="fbl-search" type="text" placeholder="Search listings..." />

          <div id="fbl-tabs">
            <button class="fbl-tab active" data-tab="offers">Offers <span class="fbl-count" id="fbl-offers-count">0</span></button>
            <button class="fbl-tab" data-tab="requests">Requests <span class="fbl-count" id="fbl-requests-count">0</span></button>
          </div>

          <div id="fbl-status" class="fbl-status"></div>

          <div id="fbl-listings-container">
            <div id="fbl-offers-panel" class="fbl-panel">
              <div class="fbl-empty-state">Click "Generate Listings" to get started.</div>
            </div>
            <div id="fbl-requests-panel" class="fbl-panel" style="display:none">
              <div class="fbl-empty-state">Click "Generate Listings" to get started.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    shadow.appendChild(style);
    shadow.appendChild(container);
    return host;
  }

  // ─── Render helpers ───────────────────────────────────────────────────────────
  function renderListings(listings) {
    const offers = listings.filter((l) => l.type === "offer");
    const requests = listings.filter((l) => l.type === "request");

    $("fbl-offers-count").textContent = offers.length;
    $("fbl-requests-count").textContent = requests.length;

    renderPanel("fbl-offers-panel", offers);
    renderPanel("fbl-requests-panel", requests);

    $("fbl-refresh-btn").style.display = "inline-flex";
    $("fbl-generate-btn").style.display = "none";
  }

  function renderPanel(panelId, listings) {
    const panel = $(panelId);
    panel.innerHTML = listings.length === 0
      ? '<div class="fbl-empty-state">No listings found.</div>'
      : listings.map(renderCard).join("");
  }

  function renderCard(listing) {
    const fieldsHtml = Object.entries(listing.fields || {})
      .map(([k, v]) =>
        `<span class="fbl-field"><span class="fbl-field-key">${escHtml(formatKey(k))}:</span> ${escHtml(String(v))}</span>`
      ).join("");

    return `
      <div class="fbl-card" data-search="${escAttr(searchableText(listing))}">
        <div class="fbl-card-header">
          <span class="fbl-listing-type">${escHtml(listing.listing_type || "")}</span>
        </div>
        <div class="fbl-card-title">${escHtml(listing.title || "")}</div>
        ${fieldsHtml ? `<div class="fbl-fields">${fieldsHtml}</div>` : ""}
        <div class="fbl-card-desc">${escHtml(listing.description || "")}</div>
        <a class="fbl-card-link" href="${escAttr(listing.link || "#")}" target="_blank" rel="noopener">View post &#8594;</a>
      </div>
    `;
  }

  function searchableText(listing) {
    return [listing.title, listing.listing_type, listing.description, ...Object.values(listing.fields || {})]
      .join(" ").toLowerCase();
  }

  function formatKey(k) {
    return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function escAttr(str) { return String(str).replace(/"/g, "&quot;"); }

  function setStatus(msg, type = "info") {
    const el = $("fbl-status");
    if (!el) return;
    el.textContent = msg;
    el.className = `fbl-status${type ? " fbl-status-" + type : ""}`;
  }

  // ─── Search ───────────────────────────────────────────────────────────────────
  function applySearch(query) {
    const q = query.toLowerCase().trim();
    $$(".fbl-card").forEach((card) => {
      card.style.display = !q || (card.dataset.search || "").includes(q) ? "" : "none";
    });
  }

  // ─── Tab switching ────────────────────────────────────────────────────────────
  function initTabs() {
    $$(".fbl-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $$(".fbl-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const target = tab.dataset.tab;
        $("fbl-offers-panel").style.display = target === "offers" ? "" : "none";
        $("fbl-requests-panel").style.display = target === "requests" ? "" : "none";
      });
    });
  }

  // ─── Core flow ────────────────────────────────────────────────────────────────
  async function generateListings(force = false) {
    if (!force) {
      const cached = loadCache();
      if (cached) {
        renderListings(cached);
        setStatus(`Showing ${cached.length} cached listings.`, "info");
        return;
      }
    }

    const posts = extractPosts();
    if (posts.length === 0) {
      setStatus("No posts found. Try scrolling down to load more.", "warn");
      return;
    }

    const { title: groupTitle, description: groupDescription } = extractGroupMeta();
    setStatus(`Processing ${posts.length} posts…`, "info");

    $("fbl-generate-btn").disabled = true;
    $("fbl-refresh-btn").disabled = true;

    chrome.runtime.sendMessage(
      { type: "PROCESS_POSTS", payload: { groupTitle, groupDescription, posts } },
      (response) => {
        $("fbl-generate-btn").disabled = false;
        $("fbl-refresh-btn").disabled = false;

        if (chrome.runtime.lastError || !response) {
          setStatus("Extension error. Please reload the page.", "error");
          return;
        }

        if (!response.success) {
          if (response.error === "NO_API_KEY") {
            setStatus("No API key set. Click ⚙ to add your OpenAI API key.", "error");
          } else {
            setStatus(`Error: ${response.error}`, "error");
          }
          return;
        }

        const listings = response.listings || [];
        saveCache(listings);
        renderListings(listings);
        setStatus(`Found ${listings.length} listing${listings.length !== 1 ? "s" : ""} from ${posts.length} posts.`, "success");
      }
    );
  }

  // ─── Collapse/expand ──────────────────────────────────────────────────────────
  function initToggle() {
    const btn = $("fbl-toggle-btn");
    const body = $("fbl-body");
    const sidebar = $("fbl-sidebar");
    let collapsed = false;

    btn.addEventListener("click", () => {
      collapsed = !collapsed;
      body.style.display = collapsed ? "none" : "";
      btn.textContent = collapsed ? "›" : "‹";
      sidebar.classList.toggle("fbl-collapsed", collapsed);
      // Also resize the host so the hit-test area matches the visible area
      const host = document.getElementById(SIDEBAR_ID);
      if (host) host.style.width = collapsed ? "36px" : "340px";
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    const host = createSidebar();
    document.body.appendChild(host);

    initTabs();
    initToggle();

    $("fbl-settings-btn").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
    });

    $("fbl-generate-btn").addEventListener("click", () => {
      generateListings(false);
    });

    $("fbl-refresh-btn").addEventListener("click", () => {
      clearCache();
      setStatus("", "");
      $("fbl-refresh-btn").style.display = "none";
      $("fbl-generate-btn").style.display = "inline-flex";
      $("fbl-offers-panel").innerHTML = '<div class="fbl-empty-state">Click "Generate Listings" to get started.</div>';
      $("fbl-requests-panel").innerHTML = '<div class="fbl-empty-state">Click "Generate Listings" to get started.</div>';
      $("fbl-offers-count").textContent = "0";
      $("fbl-requests-count").textContent = "0";
      generateListings(true);
    });

    $("fbl-search").addEventListener("input", (e) => {
      applySearch(e.target.value);
    });

    // Auto-load from cache
    const cached = loadCache();
    if (cached) {
      renderListings(cached);
      setStatus(`Showing ${cached.length} cached listings. Click Refresh to update.`, "info");
    }
  }

  if (document.readyState === "complete") {
    init();
  } else {
    window.addEventListener("load", init);
  }
})();

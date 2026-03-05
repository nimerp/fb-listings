(() => {
  // Prevent double injection
  if (document.getElementById("fb-listings-root")) return;

  // ─── Constants ───────────────────────────────────────────────────────────────
  const CACHE_PREFIX = "fb_listings_";
  const SIDEBAR_ID = "fb-listings-root";

  // ─── Cache helpers ────────────────────────────────────────────────────────────
  function cacheKey() {
    return CACHE_PREFIX + normalizeGroupUrl(location.href);
  }

  function normalizeGroupUrl(url) {
    try {
      const u = new URL(url);
      // Keep only the group path portion, drop trailing slash & query
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
    // Group title – try multiple selectors Facebook uses
    const titleSelectors = [
      'h1[data-testid="group-name"]',
      'h1.x1heor9g',
      '[data-pagelet="GroupFeed"] h1',
      'h1',
    ];
    let title = "";
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) {
        title = el.innerText.trim();
        break;
      }
    }

    // Group description – look in "About" section or meta tag
    let description = "";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) description = metaDesc.getAttribute("content") || "";

    const aboutSelectors = [
      '[data-testid="group-description"]',
      '[id="groupsAboutSection"] span',
    ];
    for (const sel of aboutSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) {
        description = el.innerText.trim();
        break;
      }
    }

    return { title: title || document.title, description };
  }

  function extractPosts() {
    const posts = [];
    const seen = new Set();

    // Facebook renders feed posts as role="article"
    const articles = document.querySelectorAll('[role="article"]');

    articles.forEach((article) => {
      // Skip nested articles (e.g. comments)
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
    // Remove UI chrome: buttons, aria-hidden spans, etc.
    const clone = article.cloneNode(true);

    // Remove elements we don't want
    const noise = clone.querySelectorAll(
      "button, [role='button'], [aria-hidden='true'], svg, [data-visualcompletion='ignore']"
    );
    noise.forEach((n) => n.remove());

    return (clone.innerText || clone.textContent || "").trim().slice(0, 2000);
  }

  function extractPostLink(article) {
    // Timestamp links in FB posts point to the individual post
    const timeLinks = article.querySelectorAll("a[href*='/posts/'], a[href*='?story_fbid='], a[href*='/permalink/']");
    for (const a of timeLinks) {
      const href = a.getAttribute("href");
      if (href) return absoluteUrl(href);
    }

    // Fallback: any anchor with a timestamp child
    const allLinks = article.querySelectorAll("a[href]");
    for (const a of allLinks) {
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
    try {
      return new URL(href, location.origin).href;
    } catch {
      return href;
    }
  }

  // ─── Sidebar HTML ─────────────────────────────────────────────────────────────
  function createSidebar() {
    const root = document.createElement("div");
    root.id = SIDEBAR_ID;

    root.innerHTML = `
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

          <div id="fbl-status"></div>

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

    return root;
  }

  // ─── Render helpers ───────────────────────────────────────────────────────────
  function renderListings(listings) {
    const offers = listings.filter((l) => l.type === "offer");
    const requests = listings.filter((l) => l.type === "request");

    document.getElementById("fbl-offers-count").textContent = offers.length;
    document.getElementById("fbl-requests-count").textContent = requests.length;

    renderPanel("fbl-offers-panel", offers);
    renderPanel("fbl-requests-panel", requests);

    document.getElementById("fbl-refresh-btn").style.display = "inline-flex";
    document.getElementById("fbl-generate-btn").style.display = "none";
  }

  function renderPanel(panelId, listings) {
    const panel = document.getElementById(panelId);
    if (listings.length === 0) {
      panel.innerHTML = '<div class="fbl-empty-state">No listings found.</div>';
      return;
    }
    panel.innerHTML = listings.map(renderCard).join("");
  }

  function renderCard(listing) {
    const fieldsHtml = Object.entries(listing.fields || {})
      .map(
        ([k, v]) =>
          `<span class="fbl-field"><span class="fbl-field-key">${escHtml(formatKey(k))}:</span> ${escHtml(String(v))}</span>`
      )
      .join("");

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
    return [
      listing.title,
      listing.listing_type,
      listing.description,
      ...Object.values(listing.fields || {}),
    ]
      .join(" ")
      .toLowerCase();
  }

  function formatKey(k) {
    return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escAttr(str) {
    return String(str).replace(/"/g, "&quot;");
  }

  function setStatus(msg, type = "info") {
    const el = document.getElementById("fbl-status");
    if (!el) return;
    el.textContent = msg;
    el.className = `fbl-status fbl-status-${type}`;
    el.style.display = msg ? "block" : "none";
  }

  // ─── Search ───────────────────────────────────────────────────────────────────
  function applySearch(query) {
    const q = query.toLowerCase().trim();
    document.querySelectorAll(".fbl-card").forEach((card) => {
      const text = card.dataset.search || "";
      card.style.display = !q || text.includes(q) ? "" : "none";
    });
  }

  // ─── Tab switching ────────────────────────────────────────────────────────────
  function initTabs() {
    document.querySelectorAll(".fbl-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".fbl-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const target = tab.dataset.tab;
        document.getElementById("fbl-offers-panel").style.display = target === "offers" ? "" : "none";
        document.getElementById("fbl-requests-panel").style.display = target === "requests" ? "" : "none";
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
      setStatus("No posts found on this page. Try scrolling down to load more.", "warn");
      return;
    }

    const { title: groupTitle, description: groupDescription } = extractGroupMeta();
    setStatus(`Processing ${posts.length} posts…`, "info");

    document.getElementById("fbl-generate-btn").disabled = true;
    document.getElementById("fbl-refresh-btn").disabled = true;

    chrome.runtime.sendMessage(
      {
        type: "PROCESS_POSTS",
        payload: { groupTitle, groupDescription, posts },
      },
      (response) => {
        document.getElementById("fbl-generate-btn").disabled = false;
        document.getElementById("fbl-refresh-btn").disabled = false;

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

  // ─── Sidebar collapse/expand ──────────────────────────────────────────────────
  function initToggle() {
    const btn = document.getElementById("fbl-toggle-btn");
    const body = document.getElementById("fbl-body");
    let collapsed = false;

    btn.addEventListener("click", () => {
      collapsed = !collapsed;
      body.style.display = collapsed ? "none" : "";
      btn.textContent = collapsed ? "›" : "‹";
      document.getElementById("fbl-sidebar").classList.toggle("fbl-collapsed", collapsed);
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    const root = createSidebar();
    document.body.appendChild(root);

    initTabs();
    initToggle();

    // Settings button → open options page
    document.getElementById("fbl-settings-btn").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
    });

    // Generate button
    document.getElementById("fbl-generate-btn").addEventListener("click", () => {
      generateListings(false);
    });

    // Refresh button
    document.getElementById("fbl-refresh-btn").addEventListener("click", () => {
      clearCache();
      setStatus("", "");
      document.getElementById("fbl-refresh-btn").style.display = "none";
      document.getElementById("fbl-generate-btn").style.display = "inline-flex";
      document.getElementById("fbl-offers-panel").innerHTML = '<div class="fbl-empty-state">Click "Generate Listings" to get started.</div>';
      document.getElementById("fbl-requests-panel").innerHTML = '<div class="fbl-empty-state">Click "Generate Listings" to get started.</div>';
      document.getElementById("fbl-offers-count").textContent = "0";
      document.getElementById("fbl-requests-count").textContent = "0";
      generateListings(true);
    });

    // Search
    document.getElementById("fbl-search").addEventListener("input", (e) => {
      applySearch(e.target.value);
    });

    // Auto-load from cache if available
    const cached = loadCache();
    if (cached) {
      renderListings(cached);
      setStatus(`Showing ${cached.length} cached listings. Click Refresh to update.`, "info");
    }
  }

  // Wait for Facebook's main content to render
  if (document.readyState === "complete") {
    init();
  } else {
    window.addEventListener("load", init);
  }
})();

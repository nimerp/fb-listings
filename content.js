(() => {
  if (document.getElementById("fb-listings-root")) return;

  const CACHE_PREFIX = "fb_listings_";
  const EXT_ORIGIN = chrome.runtime.getURL("").slice(0, -1); // e.g. chrome-extension://abc123

  // ─── Cache ────────────────────────────────────────────────────────────────────
  function cacheKey() {
    try {
      return CACHE_PREFIX + new URL(location.href).pathname.replace(/\/$/, "");
    } catch {
      return CACHE_PREFIX + location.href;
    }
  }

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(cacheKey())); } catch { return null; }
  }

  function saveCache(data) {
    try { localStorage.setItem(cacheKey(), JSON.stringify(data)); } catch {}
  }

  function clearCache() {
    localStorage.removeItem(cacheKey());
  }

  // ─── Facebook DOM extraction ──────────────────────────────────────────────────
  function extractGroupMeta() {
    let title = "";
    for (const sel of ['h1[data-testid="group-name"]', '[data-pagelet="GroupFeed"] h1', "h1"]) {
      const el = document.querySelector(sel);
      if (el?.innerText?.trim()) { title = el.innerText.trim(); break; }
    }

    let description = document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
    for (const sel of ['[data-testid="group-description"]', '[id="groupsAboutSection"] span']) {
      const el = document.querySelector(sel);
      if (el?.innerText?.trim()) { description = el.innerText.trim(); break; }
    }

    return { title: title || document.title, description };
  }

  // Wait for at least one post article to appear (polls up to ~5s)
  function waitForPosts(timeout = 5000, interval = 300) {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeout;
      const check = () => {
        const found = findArticles();
        if (found.length > 0) return resolve(found);
        if (Date.now() >= deadline) return resolve([]);
        setTimeout(check, interval);
      };
      check();
    });
  }

  // Try multiple selector strategies to find post containers
  function findArticles() {
    // Strategy 1: standard role=article, top-level only
    const byRole = Array.from(document.querySelectorAll('[role="article"]'))
      .filter((el) => !el.closest('[role="article"] [role="article"]'));
    if (byRole.length > 0) return byRole;

    // Strategy 2: Facebook feed units (data-pagelet)
    const byPagelet = Array.from(document.querySelectorAll('[data-pagelet^="FeedUnit"]'));
    if (byPagelet.length > 0) return byPagelet;

    // Strategy 3: aria-posinset items (virtualized feed)
    const byPosinset = Array.from(document.querySelectorAll('[aria-posinset]'));
    if (byPosinset.length > 0) return byPosinset;

    return [];
  }

  function articleToText(article) {
    const clone = article.cloneNode(true);
    clone.querySelectorAll("button,[role='button'],[aria-hidden='true'],svg,[data-visualcompletion='ignore'],script,style")
      .forEach((n) => n.remove());
    return (clone.innerText || clone.textContent || "").replace(/\s+/g, " ").trim().slice(0, 2000);
  }

  async function extractPosts() {
    const articles = await waitForPosts();
    const posts = [];
    const seen = new Set();

    for (const article of articles) {
      const text = articleToText(article);
      if (!text || text.length < 20) continue;
      const key = text.slice(0, 100);
      if (seen.has(key)) continue;
      seen.add(key);

      // Find post permalink
      let link = location.href;
      for (const a of article.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href");
        if (href && (href.includes("/posts/") || href.includes("story_fbid") || href.includes("/permalink/"))) {
          try { link = new URL(href, location.origin).href; } catch {}
          break;
        }
      }

      const strongEl = article.querySelector("h2 strong, h3 strong, strong");
      const author = strongEl?.innerText?.trim() || "Unknown";

      posts.push({ text, link, author });
    }

    return posts;
  }

  // ─── Inject iframe ────────────────────────────────────────────────────────────
  const iframe = document.createElement("iframe");
  iframe.id = "fb-listings-root";
  iframe.src = chrome.runtime.getURL("sidebar.html");
  iframe.allow = "";
  document.body.appendChild(iframe);

  function toSidebar(data) {
    iframe.contentWindow?.postMessage(data, EXT_ORIGIN);
  }

  // ─── Message bridge ───────────────────────────────────────────────────────────
  window.addEventListener("message", async (e) => {
    if (e.source !== iframe.contentWindow) return;
    if (e.origin !== EXT_ORIGIN) return;

    const { type } = e.data || {};

    if (type === "FBL_READY") {
      // Sidebar loaded — send cached data (or null)
      const cached = loadCache();
      toSidebar({ type: "FBL_INIT", cached, groupUrl: location.href });
    }

    if (type === "FBL_GENERATE" || type === "FBL_REFRESH") {
      if (type === "FBL_REFRESH") clearCache();

      toSidebar({ type: "FBL_STATUS", msg: "Detecting posts…", level: "info" });
      const posts = await extractPosts();
      if (posts.length === 0) {
        const articleCount = document.querySelectorAll('[role="article"]').length;
        const hint = articleCount > 0
          ? `Found ${articleCount} article elements but couldn't extract text. Try scrolling to load posts first.`
          : "No posts detected. Make sure you're on a Facebook Group feed page and posts are visible.";
        toSidebar({ type: "FBL_STATUS", msg: hint, level: "warn" });
        return;
      }

      const { title: groupTitle, description: groupDescription } = extractGroupMeta();
      toSidebar({ type: "FBL_STATUS", msg: `Processing ${posts.length} posts…`, level: "info" });

      chrome.runtime.sendMessage(
        { type: "PROCESS_POSTS", payload: { groupTitle, groupDescription, posts } },
        (response) => {
          if (chrome.runtime.lastError || !response) {
            toSidebar({ type: "FBL_STATUS", msg: "Extension error. Try reloading the page.", level: "error" });
            return;
          }
          if (!response.success) {
            const msg = response.error === "NO_API_KEY"
              ? "No API key set. Click ⚙ to add your OpenAI API key."
              : `Error: ${response.error}`;
            toSidebar({ type: "FBL_STATUS", msg, level: "error" });
            return;
          }
          const listings = response.listings || [];
          saveCache(listings);
          toSidebar({ type: "FBL_LISTINGS", listings, postCount: posts.length });
        }
      );
    }

    if (type === "FBL_OPEN_OPTIONS") {
      chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
    }

    if (type === "FBL_COLLAPSE") {
      iframe.classList.toggle("fbl-collapsed", e.data.collapsed);
    }
  });
})();

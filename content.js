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

  function extractPosts() {
    const posts = [];
    const seen = new Set();

    document.querySelectorAll('[role="article"]').forEach((article) => {
      if (article.closest('[role="article"] [role="article"]')) return;

      const clone = article.cloneNode(true);
      clone.querySelectorAll("button,[role='button'],[aria-hidden='true'],svg,[data-visualcompletion='ignore']")
        .forEach((n) => n.remove());
      const text = (clone.innerText || clone.textContent || "").trim().slice(0, 2000);

      if (!text || text.length < 20) return;
      const key = text.slice(0, 100);
      if (seen.has(key)) return;
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
    });

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

      const posts = extractPosts();
      if (posts.length === 0) {
        toSidebar({ type: "FBL_STATUS", msg: "No posts found. Scroll down to load more.", level: "warn" });
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

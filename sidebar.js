(() => {
  const PAGE_ORIGIN = "*"; // content.js checks origin on its side

  function toPage(data) {
    window.parent.postMessage(data, PAGE_ORIGIN);
  }

  // ─── DOM shortcuts ────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ─── Status ───────────────────────────────────────────────────────────────────
  function setStatus(msg, level = "info") {
    const el = $("fbl-status");
    el.textContent = msg;
    el.className = msg ? level : "";
  }

  // ─── Tabs ─────────────────────────────────────────────────────────────────────
  $$(".fbl-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".fbl-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      $("fbl-offers-panel").style.display   = target === "offers"   ? "" : "none";
      $("fbl-requests-panel").style.display = target === "requests" ? "" : "none";
    });
  });

  // ─── Collapse ─────────────────────────────────────────────────────────────────
  let collapsed = false;
  $("fbl-toggle-btn").addEventListener("click", () => {
    collapsed = !collapsed;
    $("fbl-body").style.display = collapsed ? "none" : "";
    $("fbl-toggle-btn").textContent = collapsed ? "›" : "‹";
    toPage({ type: "FBL_COLLAPSE", collapsed });
  });

  // ─── Buttons ──────────────────────────────────────────────────────────────────
  $("fbl-settings-btn").addEventListener("click", () => {
    toPage({ type: "FBL_OPEN_OPTIONS" });
  });

  $("fbl-generate-btn").addEventListener("click", () => {
    setBusy(true);
    toPage({ type: "FBL_GENERATE" });
  });

  $("fbl-refresh-btn").addEventListener("click", () => {
    resetUI();
    setBusy(true);
    toPage({ type: "FBL_REFRESH" });
  });

  // ─── Search ───────────────────────────────────────────────────────────────────
  $("fbl-search").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    $$(".fbl-card").forEach((card) => {
      card.style.display = !q || card.dataset.search.includes(q) ? "" : "none";
    });
  });

  // ─── Render ───────────────────────────────────────────────────────────────────
  function renderListings(listings) {
    const offers   = listings.filter((l) => l.type === "offer");
    const requests = listings.filter((l) => l.type === "request");

    $("fbl-offers-count").textContent   = offers.length;
    $("fbl-requests-count").textContent = requests.length;

    renderPanel("fbl-offers-panel",   offers);
    renderPanel("fbl-requests-panel", requests);

    $("fbl-generate-btn").style.display = "none";
    $("fbl-refresh-btn").style.display  = "inline-flex";
  }

  function renderPanel(panelId, listings) {
    $(panelId).innerHTML = listings.length === 0
      ? '<div class="fbl-empty-state">No listings found.</div>'
      : listings.map(renderCard).join("");
  }

  function renderCard(listing) {
    const fieldsHtml = Object.entries(listing.fields || {}).map(([k, v]) =>
      `<span class="fbl-field"><span class="fbl-field-key">${esc(fmt(k))}:</span> ${esc(String(v))}</span>`
    ).join("");

    return `
      <div class="fbl-card" data-search="${escAttr(searchable(listing))}">
        <div><span class="fbl-listing-type">${esc(listing.listing_type || "")}</span></div>
        <div class="fbl-card-title">${esc(listing.title || "")}</div>
        ${fieldsHtml ? `<div class="fbl-fields">${fieldsHtml}</div>` : ""}
        <div class="fbl-card-desc">${esc(listing.description || "")}</div>
        <a class="fbl-card-link" href="${escAttr(listing.link || "#")}" target="_blank" rel="noopener">View post &#8594;</a>
      </div>`;
  }

  function resetUI() {
    $("fbl-offers-panel").innerHTML   = '<div class="fbl-empty-state">Click "Generate Listings" to get started.</div>';
    $("fbl-requests-panel").innerHTML = '<div class="fbl-empty-state">Click "Generate Listings" to get started.</div>';
    $("fbl-offers-count").textContent   = "0";
    $("fbl-requests-count").textContent = "0";
    $("fbl-refresh-btn").style.display  = "none";
    $("fbl-generate-btn").style.display = "inline-flex";
    setStatus("", "");
  }

  function setBusy(busy) {
    $("fbl-generate-btn").disabled = busy;
    $("fbl-refresh-btn").disabled  = busy;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function searchable(l) {
    return [l.title, l.listing_type, l.description, ...Object.values(l.fields || {})].join(" ").toLowerCase();
  }
  function fmt(k) { return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
  function esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function escAttr(s) { return String(s).replace(/"/g, "&quot;"); }

  // ─── Messages from content.js ─────────────────────────────────────────────────
  window.addEventListener("message", (e) => {
    if (e.source !== window.parent) return;
    const { type } = e.data || {};

    if (type === "FBL_INIT") {
      if (e.data.cached) {
        renderListings(e.data.cached);
        setStatus(`Showing ${e.data.cached.length} cached listings. Click Refresh to update.`, "info");
      }
    }

    if (type === "FBL_STATUS") {
      setBusy(false);
      setStatus(e.data.msg, e.data.level);
    }

    if (type === "FBL_LISTINGS") {
      setBusy(false);
      renderListings(e.data.listings);
      setStatus(
        `Found ${e.data.listings.length} listing${e.data.listings.length !== 1 ? "s" : ""} from ${e.data.postCount} posts.`,
        "success"
      );
    }
  });

  // ─── Tell content.js we're ready ─────────────────────────────────────────────
  toPage({ type: "FBL_READY" });
})();

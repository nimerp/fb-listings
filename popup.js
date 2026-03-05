const statusRow = document.getElementById("status-row");
const hintText = document.getElementById("hint-text");
const settingsBtn = document.getElementById("settings-btn");

settingsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Check if API key is set
chrome.storage.sync.get("apiKey", ({ apiKey }) => {
  if (apiKey) {
    statusRow.textContent = "✓ API key is configured and ready.";
    statusRow.className = "status-row active";
  } else {
    statusRow.textContent = "⚠ No API key set. Open Settings to add your Anthropic key.";
    statusRow.className = "status-row no-key";
    hintText.textContent = "An OpenAI API key is required to process listings.";
  }
});

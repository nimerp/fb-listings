const input = document.getElementById("api-key-input");
const showBtn = document.getElementById("show-btn");
const saveBtn = document.getElementById("save-btn");
const clearBtn = document.getElementById("clear-btn");
const statusMsg = document.getElementById("status-msg");

// Load existing key on open
chrome.storage.sync.get("apiKey", ({ apiKey }) => {
  if (apiKey) {
    input.value = apiKey;
  }
});

// Toggle visibility
showBtn.addEventListener("click", () => {
  if (input.type === "password") {
    input.type = "text";
    showBtn.textContent = "Hide";
  } else {
    input.type = "password";
    showBtn.textContent = "Show";
  }
});

// Save
saveBtn.addEventListener("click", () => {
  const key = input.value.trim();
  if (!key) {
    showStatus("Please enter a valid API key.", "error");
    return;
  }
  if (!key.startsWith("sk-ant-")) {
    showStatus("That doesn't look like an Anthropic API key (should start with sk-ant-).", "error");
    return;
  }
  chrome.storage.sync.set({ apiKey: key }, () => {
    showStatus("API key saved successfully!", "success");
  });
});

// Clear
clearBtn.addEventListener("click", () => {
  chrome.storage.sync.remove("apiKey", () => {
    input.value = "";
    showStatus("API key removed.", "success");
  });
});

function showStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = `status-msg ${type}`;
  setTimeout(() => {
    statusMsg.className = "status-msg";
  }, 4000);
}

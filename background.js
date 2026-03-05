const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-6";
const BATCH_SIZE = 10;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PROCESS_POSTS") {
    handleProcessPosts(message.payload)
      .then((listings) => sendResponse({ success: true, listings }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.type === "GET_API_KEY") {
    chrome.storage.sync.get("apiKey", (data) => {
      sendResponse({ apiKey: data.apiKey || null });
    });
    return true;
  }

  if (message.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
  }
});

async function handleProcessPosts({ groupTitle, groupDescription, posts }) {
  const { apiKey } = await chrome.storage.sync.get("apiKey");
  if (!apiKey) throw new Error("NO_API_KEY");

  const batches = chunkArray(posts, BATCH_SIZE);
  const allListings = [];

  for (const batch of batches) {
    const listings = await processBatch(apiKey, groupTitle, groupDescription, batch);
    allListings.push(...listings);
  }

  return allListings;
}

async function processBatch(apiKey, groupTitle, groupDescription, posts) {
  const postsText = posts
    .map(
      (p, i) =>
        `--- POST ${i + 1} ---\nAuthor: ${p.author}\nLink: ${p.link}\nContent:\n${p.text}`
    )
    .join("\n\n");

  const prompt = `You are given posts from a Facebook group titled: "${groupTitle}"
Description: "${groupDescription}"

Your task is to process these posts into structured listings.

INSTRUCTIONS:
1. Ignore posts unrelated to the group's main topic.
2. For each relevant post:
   a. Classify whether it is an OFFER (offering something) or a REQUEST (looking for something).
   b. Detect the LISTING TYPE automatically (e.g., Apartment Rental, House Sitting, Job Offer, Item Sale, Service, Event, etc.).
   c. Extract all meaningful attributes based on the detected listing type.
      - Attributes may include: price, location, dates, size, number of pets, salary, colors, condition, payment terms, etc.
      - Output ONLY attributes explicitly mentioned in the post.
   d. Generate a short, descriptive TITLE.
   e. Create a concise SUMMARY description (1-2 sentences).
   f. Include the provided POST LINK in the output.

OUTPUT FORMAT (respond with ONLY a valid JSON array, no markdown, no explanation):
[
  {
    "type": "offer",
    "listing_type": "Auto-detected from context",
    "title": "Short descriptive title",
    "fields": {
      "field_name": "value"
    },
    "description": "Concise summary of the post",
    "link": "https://facebook.com/..."
  }
]

If no posts are relevant, respond with an empty array: []

POSTS TO PROCESS:
${postsText}`;

  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const rawText = data.content?.[0]?.text || "[]";

  try {
    const parsed = JSON.parse(rawText);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Try to extract JSON array from response if model included extra text
    const match = rawText.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return [];
      }
    }
    return [];
  }
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

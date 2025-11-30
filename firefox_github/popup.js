(() => {
  const shared = globalThis.prCopyShared;
  if (!shared) {
    console.warn("[PR-Copy] Shared helpers missing; popup not initialized.");
    return;
  }

  const { browserApi, DEFAULT_PROMPTS, createLogger, makeStorage } = shared;
  const { warn } = createLogger();
  const storage = makeStorage(browserApi);

  const inlineInput = document.getElementById("inlinePrompt");
  const reviewInput = document.getElementById("reviewPrompt");
  const statusEl = document.getElementById("status");
  const saveBtn = document.getElementById("saveBtn");
  const resetBtn = document.getElementById("resetBtn");

  function showStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.style.color = isError ? "#fca5a5" : "#a5f3fc";
    if (text) {
      setTimeout(() => (statusEl.textContent = ""), 1800);
    }
  }

  async function load() {
    const result = await storage.get(["inlinePromptTemplate", "reviewPromptTemplate"]);
    inlineInput.value = result.inlinePromptTemplate || DEFAULT_PROMPTS.inline;
    reviewInput.value = result.reviewPromptTemplate || DEFAULT_PROMPTS.review;
  }

  async function save() {
    const inlineValue = inlineInput.value.trim() || DEFAULT_PROMPTS.inline;
    const reviewValue = reviewInput.value.trim() || DEFAULT_PROMPTS.review;
    await storage.set({
      inlinePromptTemplate: inlineValue,
      reviewPromptTemplate: reviewValue,
    });
    showStatus("Saved");
  }

  async function reset() {
    await storage.set({
      inlinePromptTemplate: DEFAULT_PROMPTS.inline,
      reviewPromptTemplate: DEFAULT_PROMPTS.review,
    });
    await load();
    showStatus("Reset to defaults");
  }

  saveBtn.addEventListener("click", () => save().catch((err) => warn("Save failed", err)));
  resetBtn.addEventListener("click", () => reset().catch((err) => warn("Reset failed", err)));

  load().catch((err) => warn("Load failed", err));
})();

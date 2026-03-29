(() => {
  const shared = globalThis.prCopyShared;
  if (!shared) {
    console.warn("[PR-Copy] Shared helpers missing; background init skipped.");
    return;
  }

  const { browserApi, DEFAULT_PROMPTS, createLogger, makeStorage } = shared;
  const { log, warn } = createLogger();
  const storage = makeStorage(browserApi);

  async function ensureDefaults() {
    const existing = await storage.get(["inlinePromptTemplate", "reviewPromptTemplate"]);
    const updates = {};

    if (!existing.inlinePromptTemplate) updates.inlinePromptTemplate = DEFAULT_PROMPTS.inline;
    if (!existing.reviewPromptTemplate) updates.reviewPromptTemplate = DEFAULT_PROMPTS.review;

    if (Object.keys(updates).length) {
      await storage.set(updates);
      log("Default prompt templates set");
    }
  }

  if (browserApi?.runtime?.onInstalled?.addListener) {
    browserApi.runtime.onInstalled.addListener(ensureDefaults);
  }

  // Run once on load so defaults exist during development reloads.
  ensureDefaults().catch((err) => warn("Failed to seed defaults", err));
})();

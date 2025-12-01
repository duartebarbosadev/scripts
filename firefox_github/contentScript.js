(function () {
  const shared = globalThis.prCopyShared;
  if (!shared) {
    console.warn("[PR-Copy] Shared helpers missing; content script aborted.");
    return;
  }

  const { browserApi, DEFAULT_PROMPTS, createLogger, makeStorage, applyTemplate } = shared;
  const { log, warn } = createLogger();
  const storage = makeStorage(browserApi);

  const BUTTON_CLASS = "gh-ai-copy-button";
  const REVIEW_BUTTON_CLASS = "gh-ai-copy-review-button";

  const promptTemplates = {
    inline: DEFAULT_PROMPTS.inline,
    review: DEFAULT_PROMPTS.review,
  };

  async function loadTemplates() {
    const result = await storage.get(["inlinePromptTemplate", "reviewPromptTemplate"]);
    promptTemplates.inline = result.inlinePromptTemplate || DEFAULT_PROMPTS.inline;
    promptTemplates.review = result.reviewPromptTemplate || DEFAULT_PROMPTS.review;
    log("Prompt templates loaded");
  }

  const storageApi = browserApi?.storage;
  if (storageApi?.onChanged?.addListener) {
    storageApi.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.inlinePromptTemplate) {
        promptTemplates.inline =
          changes.inlinePromptTemplate.newValue || DEFAULT_PROMPTS.inline;
        log("Inline prompt template updated from storage");
      }
      if (changes.reviewPromptTemplate) {
        promptTemplates.review =
          changes.reviewPromptTemplate.newValue || DEFAULT_PROMPTS.review;
        log("Review prompt template updated from storage");
      }
    });
  }

  loadTemplates();

  const createButton = (label, className) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.className = `btn btn-sm ${className}`;
    btn.style.marginLeft = "8px";
    return btn;
  };

  function buildInlinePrompt({ filePath, lineStart, lineEnd, commentText, codeText }) {
    return applyTemplate(promptTemplates.inline, {
      filePath: filePath || "unknown file",
      lineStart: lineStart || "?",
      lineEnd: lineEnd || lineStart || "?",
      commentText: commentText || "(no comment text found)",
      codeText: codeText || "// no code snippet found",
    });
  }

  function buildReviewPrompt(reviewText) {
    return applyTemplate(promptTemplates.review, {
      reviewText: reviewText || "(no review text found)",
    });
  }

  function extractDataFromThread(thread) {
    const timelineBody =
      thread.closest("details.review-thread-component") ||
      thread.closest(".js-comment-container") ||
      thread.closest(".TimelineItem-body") ||
      document;

    const fileLink = timelineBody.querySelector(
      "a.text-mono.text-small.Link--primary"
    );
    const filePath = fileLink ? fileLink.textContent.trim() : null;

    const lineStartEl = timelineBody.querySelector(".js-multi-line-preview-start");
    const lineEndEl = timelineBody.querySelector(".js-multi-line-preview-end");

    const lineStart = lineStartEl ? lineStartEl.textContent.trim() : null;
    const lineEnd = lineEndEl ? lineEndEl.textContent.trim() : null;

    let commentBody = thread.classList?.contains("js-comment-body")
      ? thread
      : thread.querySelector(".comment-body.markdown-body.js-comment-body");

    let commentText = "";
    if (commentBody) {
      // Clone to avoid modifying the DOM
      const clone = commentBody.cloneNode(true);
      // Remove noise like the "Implement suggestion" button or other interactive elements
      const buttons = clone.querySelectorAll("button, .react-partial, .js-complete-transition");
      buttons.forEach((btn) => btn.remove());
      commentText = clone.innerText.trim();
    }

    const inlineContainer = thread.closest(".js-inline-comments-container");
    const siblingDiffTable =
      inlineContainer?.previousElementSibling?.querySelector?.(
        "table.js-diff-table"
      );
    const diffTable = siblingDiffTable || timelineBody.querySelector("table.js-diff-table") || null;

    const codeLines = [];
    if (diffTable) {
      const codeSpans = diffTable.querySelectorAll(".blob-code-inner");
      codeSpans.forEach((span) => {
        codeLines.push(span.innerText);
      });
    }

    return {
      filePath,
      lineStart,
      lineEnd,
      commentText,
      codeText: codeLines.join("\n"),
    };
  }

  async function withCopyFeedback(button, action, labels = {}) {
    const { success = "Copied!", errorText = "Copy failed", originalText } = labels;
    const original = originalText || button.textContent;
    try {
      await action();
      button.textContent = success;
      button.disabled = true;
      setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
      }, 1500);
    } catch (err) {
      warn("Clipboard write failed", err);
      button.textContent = errorText;
      setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
      }, 2000);
    }
  }

  async function handleCopyClick(thread, button) {
    const data = extractDataFromThread(thread);
    log("Copying inline comment", {
      filePath: data.filePath,
      lineStart: data.lineStart,
      lineEnd: data.lineEnd,
      hasCode: Boolean(data.codeText),
    });

    const prompt = buildInlinePrompt(data);
    await withCopyFeedback(button, () => navigator.clipboard.writeText(prompt));
  }

  function enhanceThread(thread) {
    if (thread.dataset.aiCopyButtonInjected === "true") return;
    thread.dataset.aiCopyButtonInjected = "true";

    const header = thread.querySelector(".ml-n1.flex-items-center");
    if (!header) {
      warn("No header found for thread", thread.id);
      return;
    }

    const actionsBar = header.querySelector(".timeline-comment-actions");
    if (!actionsBar) {
      warn("No actions bar found for thread", thread.id);
      return;
    }

    const button = createButton("Copy for AI", BUTTON_CLASS);
    actionsBar.prepend(button);

    button.addEventListener("click", () => handleCopyClick(thread, button));
  }

  async function handleCopyReview(container, button) {
    const originalLabel = button.textContent;
    button.textContent = "Copying...";
    button.disabled = true;

    const reviewGroup = container?.closest(".timeline-comment-group") || container;
    const reviewIdMatch = reviewGroup?.id?.match(/pullrequestreview-(\d+)/);
    const reviewId = reviewIdMatch ? reviewIdMatch[1] : null;
    const collected = [];
    let overviewBlocks = 0;
    let hiddenIdsCount = 0;
    let hiddenFoundCount = 0;

    // Try to find the outermost wrapper for this review to capture all visible inline comments
    let root = reviewGroup;
    if (reviewId) {
      const wrapper = document.getElementById(`pullrequestreview-${reviewId}`);
      if (wrapper) root = wrapper;
    }

    const collectBodies = (node) => {
      const bodies = node?.querySelectorAll(
        ".comment-body.markdown-body.js-comment-body"
      );
      if (!bodies || !bodies.length) return;
      bodies.forEach((el) => {
        const data = extractDataFromThread(el);
        if (data.filePath) {
          collected.push(buildInlinePrompt(data));
        } else {
          collected.push(data.commentText);
        }
      });
    };

    collectBodies(root);
    overviewBlocks = collected.length;

    // Collect inline comment bodies that belong to this review, using hidden comment ids list.
    if (reviewId) {
      const hiddenForm = Array.from(
        document.querySelectorAll(".js-review-hidden-comment-ids")
      ).find((form) => {
        const action = form.getAttribute("action") || "";
        return action.includes(`/reviews/${reviewId}/`);
      });

      const ids =
        hiddenForm
          ?.getAttribute("data-hidden-comment-ids")
          ?.split(",")
          .map((s) => s.trim())
          .filter(Boolean) || [];
      hiddenIdsCount = ids.length;

      const beforeHidden = collected.length;
      const missing = [];

      ids.forEach((id) => {
        const node = document.getElementById(`discussion_r${id}`);
        if (node) {
          // Only collect if not already found in the root scan
          if (!root.contains(node)) {
            collectBodies(node);
          }
        } else {
          missing.push(id);
        }
      });
      hiddenFoundCount = collected.length - beforeHidden;

      if (missing.length && hiddenForm) {
        const action = hiddenForm.getAttribute("action");
        if (action) {
          const url = new URL(action, window.location.origin).toString();
          log("Fetching hidden review threads", { reviewId, missing: missing.length });
          try {
            const res = await fetch(url, { credentials: "same-origin" });
            if (res.ok) {
              const html = await res.text();
              const temp = document.createElement("div");
              temp.innerHTML = html;
              const beforeFetch = collected.length;
              missing.forEach((id) => {
                const node = temp.querySelector(`#discussion_r${id}`);
                if (node) collectBodies(node);
              });
              hiddenFoundCount = collected.length - beforeHidden;
              const newlyFound = collected.length - beforeFetch;
              log("Fetched hidden threads", {
                reviewId,
                newlyFound,
                totalHiddenFound: hiddenFoundCount,
              });
            } else {
              warn("Failed to fetch hidden threads", res.status);
            }
          } catch (err) {
            warn("Error fetching hidden threads", err);
          }
        }
      }
    }

    const commentText = collected.length
      ? collected.join("\n\n---\n\n")
      : "(no review text found)";

    log("Copying full review", {
      reviewId: reviewId || reviewGroup?.id || "unknown",
      totalBlocks: collected.length,
      overviewBlocks,
      hiddenIds: hiddenIdsCount,
      hiddenFound: hiddenFoundCount,
    });
    const reviewPrompt = buildReviewPrompt(commentText);
    await withCopyFeedback(button, () => navigator.clipboard.writeText(reviewPrompt), {
      errorText: "Copy failed",
      originalText: originalLabel,
    });
  }

  function enhanceReviewComment(commentBody) {
    if (!commentBody) return;
    if (commentBody.closest(".js-inline-comments-container")) return;

    const container = commentBody.closest(".js-comment-container, .js-comment");
    if (!container) return;
    if (container.dataset.aiCopyReviewButtonInjected === "true") return;

    const actionsBar =
      container.querySelector(".timeline-comment-actions") ||
      commentBody.closest(".timeline-comment-group")?.querySelector(".timeline-comment-actions");
    if (!actionsBar) return;

    const button = createButton("Copy review", REVIEW_BUTTON_CLASS);
    actionsBar.prepend(button);
    container.dataset.aiCopyReviewButtonInjected = "true";

    button.addEventListener("click", () => handleCopyReview(container, button));
  }

  function scan() {
    const threads = document.querySelectorAll(
      ".timeline-comment-group.review-comment.js-minimizable-comment-group"
    );

    threads.forEach(enhanceThread);

    const reviewBodies = document.querySelectorAll(
      ".comment-body.markdown-body.js-comment-body.soft-wrap.user-select-contain"
    );
    reviewBodies.forEach(enhanceReviewComment);

    log("Scan complete", {
      inlineThreads: threads.length,
      reviewBodies: reviewBodies.length,
    });
  }

  scan();

  const observer = new MutationObserver(() => {
    scan();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();

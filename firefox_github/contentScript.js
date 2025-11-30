(function () {
  const BUTTON_CLASS = "gh-ai-copy-button";
  const REVIEW_BUTTON_CLASS = "gh-ai-copy-review-button";
  const LOG_PREFIX = "[PR-Copy]";

  const log = (...args) => console.log(LOG_PREFIX, ...args);
  const warn = (...args) => console.warn(LOG_PREFIX, ...args);

  function createCopyButton() {
    const btn = document.createElement("button");
    btn.textContent = "Copy for AI";
    btn.className = "btn btn-sm " + BUTTON_CLASS;
    btn.style.marginLeft = "8px";
    return btn;
  }

  function createCopyReviewButton() {
    const btn = document.createElement("button");
    btn.textContent = "Copy review";
    btn.className = "btn btn-sm " + REVIEW_BUTTON_CLASS;
    btn.style.marginLeft = "8px";
    return btn;
  }

  function buildPrompt({ filePath, lineStart, lineEnd, commentText, codeText }) {
    return (
`An AI wrote this GitHub PR review. Fix it if you think it's correct and follows good practices. If not, or if you have questions, ask.

File: ${filePath || "unknown file"}
Lines: ${lineStart || "?"}–${lineEnd || "?"}

Review comment:
${commentText || "(no comment text found)"}

Relevant code:
\`\`\`
${codeText || "// no code snippet found"}
\`\`\`
`
    );
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

    const commentBody = thread.querySelector(".comment-body.markdown-body.js-comment-body");
    const commentText = commentBody ? commentBody.innerText.trim() : "";

    const inlineContainer = thread.closest(".js-inline-comments-container");
    const siblingDiffTable =
      inlineContainer?.previousElementSibling?.querySelector?.(
        "table.js-diff-table"
      );
    const diffTable = siblingDiffTable || timelineBody.querySelector("table.js-diff-table") || null;

    let codeLines = [];
    if (diffTable) {
      const codeSpans = diffTable.querySelectorAll(".blob-code-inner");
      codeSpans.forEach((span) => {
        codeLines.push(span.innerText);
      });
    }

    const codeText = codeLines.join("\n");

    return {
      filePath,
      lineStart,
      lineEnd,
      commentText,
      codeText,
    };
  }

  async function handleCopyClick(thread, button) {
    const data = extractDataFromThread(thread);
    log("Copying inline comment", {
      filePath: data.filePath,
      lineStart: data.lineStart,
      lineEnd: data.lineEnd,
      hasCode: Boolean(data.codeText),
    });
    const prompt = buildPrompt(data);

    try {
      await navigator.clipboard.writeText(prompt);
      const original = button.textContent;
      button.textContent = "Copied!";
      button.disabled = true;
      setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
      }, 1500);
    } catch (e) {
      console.error(LOG_PREFIX, "Failed to copy PR snippet:", e);
      button.textContent = "Copy failed";
      setTimeout(() => {
        button.textContent = "Copy for AI";
      }, 2000);
    }
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

    const button = createCopyButton();
    actionsBar.prepend(button);

    button.addEventListener("click", () => handleCopyClick(thread, button));
  }

  async function handleCopyReview(container, button) {
    const reviewGroup = container?.closest(".timeline-comment-group") || container;
    const reviewIdMatch = reviewGroup?.id?.match(/pullrequestreview-(\d+)/);
    const reviewId = reviewIdMatch ? reviewIdMatch[1] : null;
    const collected = [];
    let overviewBlocks = 0;
    let hiddenIdsCount = 0;
    let hiddenFoundCount = 0;

    const collectBodies = (root) => {
      const bodies = root?.querySelectorAll(
        ".comment-body.markdown-body.js-comment-body"
      );
      if (!bodies || !bodies.length) return;
      bodies.forEach((el) => {
        const text = el.innerText.trim();
        if (text) collected.push(text);
      });
    };

    collectBodies(reviewGroup);
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
          collectBodies(node);
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
    const reviewPrompt = `Full review:\n${commentText}`;

    try {
      await navigator.clipboard.writeText(reviewPrompt);
      const original = button.textContent;
      button.textContent = "Copied!";
      button.disabled = true;
      setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
      }, 1500);
    } catch (e) {
      console.error(LOG_PREFIX, "Failed to copy review text:", e);
      button.textContent = "Copy failed";
      setTimeout(() => {
        button.textContent = "Copy review";
      }, 2000);
    }
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

    const button = createCopyReviewButton();
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

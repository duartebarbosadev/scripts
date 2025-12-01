(() => {
  if (globalThis.prCopyShared) return;

  const browserApi = globalThis.browser || globalThis.chrome || null;
  const LOG_PREFIX = "[PR-Copy]";

  const DEFAULT_PROMPTS = Object.freeze({
    inline: `An AI wrote this GitHub PR review. Read the review and if you think it's correct fix it using good practices

File: {{filePath}}
Lines: {{lineStart}}–{{lineEnd}}

Review comment:
{{commentText}}

Relevant code:
\`\`\`
{{codeText}}
\`\`\`
`,
    review: `{{reviewText}}`,
  });

  const createLogger = (prefix = LOG_PREFIX) => ({
    log: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  });

  function makeStorage(api = browserApi) {
    const { warn } = createLogger();
    const storage = api?.storage?.local;

    const isPromise = (value) => value && typeof value.then === "function";

    const get = async (keys) => {
      if (!storage?.get) return {};
      try {
        const maybePromise = storage.get(keys);
        if (isPromise(maybePromise)) {
          return (await maybePromise) || {};
        }
      } catch (err) {
        warn("Storage get failed", err);
        return {};
      }

      return new Promise((resolve) => {
        try {
          storage.get(keys, (res) => {
            if (api?.runtime?.lastError) {
              warn("Storage get failed", api.runtime.lastError);
              resolve({});
            } else {
              resolve(res || {});
            }
          });
        } catch (err) {
          warn("Storage get failed", err);
          resolve({});
        }
      });
    };

    const set = async (values) => {
      if (!storage?.set) return;
      try {
        const maybePromise = storage.set(values);
        if (isPromise(maybePromise)) {
          await maybePromise;
          return;
        }
      } catch (err) {
        warn("Storage set failed", err);
        return;
      }

      return new Promise((resolve) => {
        try {
          storage.set(values, () => {
            if (api?.runtime?.lastError) {
              warn("Storage set failed", api.runtime.lastError);
            }
            resolve();
          });
        } catch (err) {
          warn("Storage set failed", err);
          resolve();
        }
      });
    };

    return { get, set, raw: storage };
  }

  function applyTemplate(template, data) {
    return Object.entries(data || {}).reduce((output, [key, value]) => {
      const pattern = new RegExp(`{{${key}}}`, "g");
      return output.replace(pattern, value ?? "");
    }, template);
  }

  globalThis.prCopyShared = Object.freeze({
    LOG_PREFIX,
    browserApi,
    DEFAULT_PROMPTS,
    createLogger,
    makeStorage,
    applyTemplate,
  });
})();

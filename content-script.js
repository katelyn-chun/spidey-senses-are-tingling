(() => {
  const state = {
    enabled: true,
    threshold: 0.8,
    pausedForSite: false,
    scanned: 0,
    blurred: 0,
    queued: new Set(),
    processed: new WeakMap(),
  };

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ enabled: true, threshold: 0.8 }, resolve);
    });
  }

  function ensurePositioning(image) {
    const parent = image.parentElement;
    if (!parent) return null;
    const computed = getComputedStyle(parent);
    if (computed.position === 'static') parent.style.position = 'relative';
    return parent;
  }

  function blurImage(image, confidence) {
    if (image.dataset.spiderShieldBlurred === 'true') return;
    const parent = ensurePositioning(image);
    if (!parent) return;
    image.dataset.spiderShieldBlurred = 'true';
    image.dataset.spiderShieldConfidence = String(confidence);
    const overlay = document.createElement('span');
    overlay.className = 'spider-shield-overlay';
    overlay.style.left = `${image.offsetLeft}px`;
    overlay.style.top = `${image.offsetTop}px`;
    overlay.style.width = `${image.offsetWidth}px`;
    overlay.style.height = `${image.offsetHeight}px`;
    const reveal = document.createElement('button');
    reveal.type = 'button';
    reveal.textContent = 'Watch out! Sp*der alert! Click to reveal at your own risk.';
    reveal.addEventListener('click', () => {
      image.style.filter = 'none';
      image.dataset.spiderShieldBlurred = 'false';
      overlay.remove();
    });
    overlay.append(reveal);
    parent.append(overlay);
    state.blurred += 1;
  }

  function imageFingerprint(image) {
    return [image.currentSrc, image.src, image.srcset, image.alt, image.title, image.getAttribute('aria-label')].join('|');
  }

  async function inspectImage(image) {
    const fingerprint = imageFingerprint(image);
    if (state.pausedForSite || !state.enabled || state.processed.get(image) === fingerprint) return;
    if (!image.complete || image.naturalWidth < 80 || image.naturalHeight < 80) return;
    state.processed.set(image, fingerprint);
    state.scanned += 1;
    const result = await globalThis.spiderShieldDetector.classifyImage(image);
    if (result.confidence >= state.threshold) blurImage(image, result.confidence);
  }

  function queueImage(image) {
    if (state.queued.has(image)) return;
    state.queued.add(image);
    const run = () => inspectImage(image).finally(() => state.queued.delete(image));
    if (image.complete) run();
    else image.addEventListener('load', run, { once: true });
  }

  function scan(root = document) {
    if (root instanceof HTMLImageElement) queueImage(root);
    root.querySelectorAll?.('img').forEach(queueImage);
    root.querySelectorAll?.('*').forEach((element) => {
      if (element.shadowRoot) scan(element.shadowRoot);
    });
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) scan(node);
    }));
    mutations.forEach((mutation) => {
      if (mutation.type !== 'attributes') return;
      const target = mutation.target.closest?.('a') || mutation.target;
      scan(target);
    });
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'get-status') sendResponse({ scanned: state.scanned, blurred: state.blurred });
    if (message?.type === 'settings-updated' && message.settings) {
      state.enabled = Boolean(message.settings.enabled);
      state.threshold = Number(message.settings.threshold) || 0.8;
      if (state.enabled) scan();
    }
    if (message?.type === 'pause-site') state.pausedForSite = true;
  });

  getSettings().then((settings) => {
    state.enabled = settings.enabled;
    state.threshold = settings.threshold;
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['alt', 'aria-label', 'data-image-title', 'src', 'srcset', 'title'],
    });
    scan();
  });
})();

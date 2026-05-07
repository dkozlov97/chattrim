const VISIBLE_COUNT = 10;
const TURN_SELECTOR = '[data-testid^="conversation-turn-"]';
const FALLBACK_TURN_SELECTOR = "article";
const STYLE_ID = "chattrim-style";
const CONTROL_ID = "chattrim-controls";
const DEBUG_PANEL_ID = "chattrim-debug-panel";
const DEBUG_FLAG_KEY = "CHATTRIM_DEBUG";
const DEBUG_CONSOLE_FLAG_KEY = "CHATTRIM_DEBUG_CONSOLE";
const MODE_KEY = "CHATTRIM_MODE";
const MODE_AGGRESSIVE = "aggressive";
const MODE_SAFE = "safe";

let currentMode = MODE_AGGRESSIVE;
let lastKnownUrl = location.href;
let chatContainer = null;
let observedTarget = null;
let sessionPrunedTurns = 0;
let lastRemovedTurns = 0;
let lastProcessedTurnCount = -1;
let controlRoot = null;
let controlSummary = null;
let controlButtons = null;
let controlToggleButton = null;
let controlPanel = null;
let controlExpanded = false;
let observer = null;

function readDebugStorageFlag(key) {
  try {
    return localStorage.getItem(key) === "1" || sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function hasDebugToken(token) {
  return location.search.includes(token) || location.hash.includes(token);
}

function isDebugEnabled() {
  return readDebugStorageFlag(DEBUG_FLAG_KEY) || hasDebugToken("chattrim_debug=1");
}

function isConsoleDebugEnabled() {
  return isDebugEnabled() && (readDebugStorageFlag(DEBUG_CONSOLE_FLAG_KEY) || hasDebugToken("chattrim_console=1"));
}

function getStoredMode() {
  try {
    const storedMode = localStorage.getItem(MODE_KEY);
    return storedMode === MODE_SAFE ? MODE_SAFE : MODE_AGGRESSIVE;
  } catch {
    return MODE_AGGRESSIVE;
  }
}

function persistMode(mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    return;
  }
}

function setMode(mode, reason) {
  if (mode !== MODE_AGGRESSIVE && mode !== MODE_SAFE) {
    return;
  }

  currentMode = mode;
  persistMode(mode);
  lastProcessedTurnCount = -1;
  profiler.recordModeChange(mode, reason);
  renderControl();
}

currentMode = getStoredMode();

const profiler = createProfiler();

function injectStyle() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const debugPanelStyle = profiler.enabled
    ? `
    #${DEBUG_PANEL_ID} {
      position: fixed;
      right: 12px;
      bottom: 12px;
      z-index: 2147483647;
      width: 320px;
      max-width: calc(100vw - 24px);
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(8, 17, 29, 0.94);
      color: #dff9ff;
      border: 1px solid rgba(79, 209, 247, 0.35);
      box-shadow: 0 20px 48px rgba(2, 8, 23, 0.45);
      backdrop-filter: blur(10px);
      font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      white-space: pre-wrap;
      cursor: pointer;
      user-select: text;
    }
    #${DEBUG_PANEL_ID} strong {
      display: block;
      margin-bottom: 8px;
      color: #8be9ff;
      font-size: 12px;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    #${DEBUG_PANEL_ID} .muted {
      color: #93c5d8;
    }
    `
    : "";

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${CONTROL_ID} {
      display: flex;
      justify-content: center;
      position: sticky;
      top: 20px;
      z-index: 8;
      margin: 0 0 12px;
      pointer-events: none;
    }
    #${CONTROL_ID} .chattrim-shell {
      position: relative;
      display: grid;
      justify-items: center;
      gap: 8px;
      width: fit-content;
      max-width: min(100%, 420px);
      pointer-events: auto;
    }
    #${CONTROL_ID} .chattrim-toggle {
      appearance: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: rgba(255, 255, 255, 0.88);
      color: rgba(17, 24, 39, 0.92);
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
      backdrop-filter: blur(12px);
      cursor: pointer;
      max-width: 100%;
      transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
    }
    #${CONTROL_ID} .chattrim-toggle:hover {
      transform: translateY(-1px);
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
      background: rgba(255, 255, 255, 0.94);
    }
    #${CONTROL_ID} .chattrim-toggle::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #10a37f;
      box-shadow: 0 0 0 4px rgba(16, 163, 127, 0.12);
      flex: 0 0 auto;
    }
    #${CONTROL_ID}[data-mode="safe"] .chattrim-toggle::before {
      background: #f59e0b;
      box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.12);
    }
    #${CONTROL_ID} .chattrim-panel {
      display: none;
      width: min(320px, calc(100vw - 32px));
      padding: 12px;
      border-radius: 18px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: rgba(255, 255, 255, 0.94);
      color: rgba(17, 24, 39, 0.92);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
      backdrop-filter: blur(18px);
    }
    #${CONTROL_ID} .chattrim-toggle,
    #${CONTROL_ID} .chattrim-panel {
      margin-left: auto;
      margin-right: auto;
    }
    #${CONTROL_ID}[data-expanded="true"] .chattrim-panel {
      display: grid;
      gap: 10px;
    }
    #${CONTROL_ID} strong {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: rgba(17, 24, 39, 0.92);
    }
    #${CONTROL_ID} p {
      margin: 0;
      color: rgba(55, 65, 81, 0.9);
      font-size: 12px;
      line-height: 1.5;
    }
    #${CONTROL_ID} .chattrim-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    #${CONTROL_ID} .chattrim-actions button {
      appearance: none;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: rgba(243, 244, 246, 0.95);
      color: rgba(17, 24, 39, 0.92);
      border-radius: 999px;
      padding: 7px 11px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 120ms ease, background 120ms ease, border-color 120ms ease, color 120ms ease;
    }
    #${CONTROL_ID} .chattrim-actions button:hover:not(:disabled) {
      transform: translateY(-1px);
      background: rgba(229, 231, 235, 0.98);
      border-color: rgba(0, 0, 0, 0.14);
    }
    #${CONTROL_ID} .chattrim-actions button:disabled {
      cursor: default;
      opacity: 0.5;
    }
    #${CONTROL_ID} .chattrim-actions button.is-active {
      background: rgba(16, 163, 127, 0.12);
      border-color: rgba(16, 163, 127, 0.28);
      color: #0f766e;
      opacity: 1;
    }
    @media (prefers-color-scheme: dark) {
      #${CONTROL_ID} .chattrim-toggle {
        border-color: rgba(255, 255, 255, 0.08);
        background: rgba(52, 53, 65, 0.88);
        color: rgba(236, 236, 241, 0.95);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
      }
      #${CONTROL_ID} .chattrim-toggle:hover {
        background: rgba(64, 65, 79, 0.92);
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
      }
      #${CONTROL_ID} .chattrim-panel {
        border-color: rgba(255, 255, 255, 0.08);
        background: rgba(52, 53, 65, 0.94);
        color: rgba(236, 236, 241, 0.95);
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
      }
      #${CONTROL_ID} strong {
        color: rgba(236, 236, 241, 0.95);
      }
      #${CONTROL_ID} p {
        color: rgba(217, 217, 227, 0.88);
      }
      #${CONTROL_ID} .chattrim-actions button {
        border-color: rgba(255, 255, 255, 0.08);
        background: rgba(64, 65, 79, 0.92);
        color: rgba(236, 236, 241, 0.95);
      }
      #${CONTROL_ID} .chattrim-actions button:hover:not(:disabled) {
        background: rgba(86, 88, 105, 0.98);
        border-color: rgba(255, 255, 255, 0.14);
      }
      #${CONTROL_ID} .chattrim-actions button.is-active {
        background: rgba(16, 163, 127, 0.2);
        border-color: rgba(16, 163, 127, 0.32);
        color: #9ff3e0;
      }
    }
    ${debugPanelStyle}
  `;

  (document.head || document.documentElement).appendChild(style);
}

function formatCount(count, singular, plural) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function formatCompactCount(count) {
  return new Intl.NumberFormat().format(count);
}

function describeObserverTarget(target) {
  if (!target) {
    return "none";
  }

  if (target === document.body) {
    return "body";
  }

  if (target === document.documentElement) {
    return "document";
  }

  const tagName = target.tagName ? target.tagName.toLowerCase() : "node";
  const idSuffix = target.id ? `#${target.id}` : "";
  return `${tagName}${idSuffix}`;
}

function nodeMatchesTurn(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  if (node.id === CONTROL_ID || node.id === DEBUG_PANEL_ID) {
    return false;
  }

  if (typeof node.matches === "function" && (node.matches(TURN_SELECTOR) || node.matches(FALLBACK_TURN_SELECTOR))) {
    return true;
  }

  if (typeof node.querySelector === "function" && (node.querySelector(TURN_SELECTOR) || node.querySelector(FALLBACK_TURN_SELECTOR))) {
    return true;
  }

  return false;
}

function mutationMayAffectTurnCount(records) {
  return records.some((record) => {
    return Array.from(record.addedNodes).some(nodeMatchesTurn) || Array.from(record.removedNodes).some(nodeMatchesTurn);
  });
}

function queryConversationTurnsInRoot(root) {
  let turns = Array.from(root.querySelectorAll(TURN_SELECTOR));
  if (turns.length > 0) {
    return {
      turns,
      source: root === document ? "document:data-testid" : "container:data-testid",
    };
  }

  if (root === document) {
    const main = document.querySelector("main");
    if (main) {
      turns = Array.from(main.querySelectorAll(FALLBACK_TURN_SELECTOR));
      if (turns.length > 0) {
        return {
          turns,
          source: "main:article",
        };
      }
    }
  } else {
    turns = Array.from(root.querySelectorAll(FALLBACK_TURN_SELECTOR));
    if (turns.length > 0) {
      return {
        turns,
        source: "container:article",
      };
    }
  }

  return {
    turns: [],
    source: root === document ? "document:none" : "container:none",
  };
}

function getConversationTurns() {
  const startedAt = performance.now();
  const roots = [];

  if (chatContainer && chatContainer.isConnected) {
    roots.push(chatContainer);
  }

  roots.push(document);

  for (const root of roots) {
    const result = queryConversationTurnsInRoot(root);
    if (result.turns.length > 0) {
      profiler.recordGetConversationTurns(performance.now() - startedAt, result.turns.length, result.source);
      return result.turns;
    }
  }

  profiler.recordGetConversationTurns(performance.now() - startedAt, 0, "none");
  return [];
}

function findTurnsContainer(turns) {
  if (turns.length === 0) {
    return document.querySelector("main") || document.body;
  }

  const firstTurn = turns[0];
  const lastTurn = turns[turns.length - 1];
  let container = firstTurn.parentElement;

  while (container && !container.contains(lastTurn)) {
    container = container.parentElement;
  }

  return container || document.querySelector("main") || firstTurn.parentElement || document.body;
}

function getTurnRootNode(turn, container) {
  if (!turn || !container) {
    return turn;
  }

  let node = turn;
  while (node.parentElement && node.parentElement !== container) {
    node = node.parentElement;
  }

  return node;
}

function getScrollTarget(element) {
  let node = element ? element.parentElement : null;

  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const canScroll = /(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight + 1;
    if (canScroll) {
      return node;
    }
    node = node.parentElement;
  }

  return document.scrollingElement || document.documentElement;
}

function preserveScrollPosition(anchorNode, mutateDom) {
  if (!anchorNode || typeof mutateDom !== "function") {
    mutateDom();
    return;
  }

  const scrollTarget = getScrollTarget(anchorNode);
  const topBefore = anchorNode.getBoundingClientRect().top;

  mutateDom();

  const topAfter = anchorNode.getBoundingClientRect().top;
  const delta = topAfter - topBefore;

  if (Math.abs(delta) < 0.5) {
    return;
  }

  if (scrollTarget === document.scrollingElement || scrollTarget === document.documentElement || scrollTarget === document.body) {
    window.scrollBy(0, delta);
    return;
  }

  scrollTarget.scrollTop += delta;
}

function attachObserver(target) {
  if (!observer) {
    return;
  }

  const nextTarget = target && target.isConnected ? target : document.body;
  if (observedTarget === nextTarget) {
    return;
  }

  observer.disconnect();
  observer.observe(nextTarget, { childList: true, subtree: true });
  observedTarget = nextTarget;
  profiler.recordObserverTarget(describeObserverTarget(nextTarget));
}

function ensureControl(anchorEl) {
  if (!anchorEl || !anchorEl.parentNode) {
    return;
  }

  if (!controlRoot) {
    controlRoot = document.createElement("div");
    controlRoot.id = CONTROL_ID;
    controlRoot.dataset.expanded = "false";
    controlRoot.dataset.mode = currentMode;

    const shell = document.createElement("div");
    shell.className = "chattrim-shell";

    controlToggleButton = document.createElement("button");
    controlToggleButton.type = "button";
    controlToggleButton.className = "chattrim-toggle";
    controlToggleButton.textContent = "ChatTrim";
    controlToggleButton.setAttribute("aria-expanded", "false");
    controlToggleButton.addEventListener("click", () => {
      setControlExpanded(!controlExpanded);
    });

    controlPanel = document.createElement("div");
    controlPanel.className = "chattrim-panel";

    const title = document.createElement("strong");
    title.textContent = "ChatTrim";

    controlSummary = document.createElement("p");

    const actions = document.createElement("div");
    actions.className = "chattrim-actions";

    const aggressiveButton = document.createElement("button");
    aggressiveButton.type = "button";
    aggressiveButton.textContent = "Aggressive";
    aggressiveButton.addEventListener("click", () => {
      if (currentMode === MODE_AGGRESSIVE) {
        return;
      }

      setMode(MODE_AGGRESSIVE, "toggle");
      scheduleProcessChat();
    });

    const safeButton = document.createElement("button");
    safeButton.type = "button";
    safeButton.textContent = "Safe";
    safeButton.addEventListener("click", () => {
      if (currentMode === MODE_SAFE) {
        return;
      }

      setMode(MODE_SAFE, "toggle");
      location.reload();
    });

    const restoreButton = document.createElement("button");
    restoreButton.type = "button";
    restoreButton.textContent = "Restore full chat";
    restoreButton.addEventListener("click", () => {
      setMode(MODE_SAFE, "restore");
      location.reload();
    });

    actions.appendChild(aggressiveButton);
    actions.appendChild(safeButton);
    actions.appendChild(restoreButton);

    controlPanel.appendChild(title);
    controlPanel.appendChild(controlSummary);
    controlPanel.appendChild(actions);

    shell.appendChild(controlToggleButton);
    shell.appendChild(controlPanel);
    controlRoot.appendChild(shell);

    controlButtons = {
      aggressiveButton,
      safeButton,
      restoreButton,
    };

    document.addEventListener("click", (event) => {
      if (!controlExpanded || !controlRoot) {
        return;
      }

      if (controlRoot.contains(event.target)) {
        return;
      }

      setControlExpanded(false);
    });
  }

  if (controlRoot.parentNode !== anchorEl.parentNode || controlRoot.nextElementSibling !== anchorEl) {
    anchorEl.parentNode.insertBefore(controlRoot, anchorEl);
  }
}

function removeControl() {
  if (controlRoot) {
    controlRoot.remove();
  }

  controlExpanded = false;
}

function setControlExpanded(expanded) {
  controlExpanded = Boolean(expanded);

  if (!controlRoot || !controlToggleButton) {
    return;
  }

  controlRoot.dataset.expanded = controlExpanded ? "true" : "false";
  controlToggleButton.setAttribute("aria-expanded", controlExpanded ? "true" : "false");
}

function shouldShowControl(liveTurnsCount) {
  if (currentMode === MODE_SAFE) {
    return true;
  }

  return sessionPrunedTurns > 0 || liveTurnsCount > VISIBLE_COUNT;
}

function renderControl(anchorEl, liveTurnsCount = 0) {
  if (!shouldShowControl(liveTurnsCount)) {
    removeControl();
    return;
  }

  if (anchorEl) {
    ensureControl(anchorEl);
  }

  if (!controlRoot || !controlSummary || !controlButtons || !controlToggleButton) {
    return;
  }

  const prunedLabel = formatCount(sessionPrunedTurns, "older message", "older messages");
  controlRoot.dataset.mode = currentMode;

  if (currentMode === MODE_AGGRESSIVE) {
    controlToggleButton.textContent = sessionPrunedTurns > 0
      ? `ChatTrim · ${formatCompactCount(sessionPrunedTurns)} pruned`
      : "ChatTrim · Active";

    if (sessionPrunedTurns > 0) {
      controlSummary.textContent = `Aggressive mode removed ${prunedLabel} from the live DOM and keeps the latest ${VISIBLE_COUNT} turns on the page.`;
    } else if (liveTurnsCount > VISIBLE_COUNT) {
      controlSummary.textContent = `Aggressive mode is trimming older turns and keeping only the latest ${VISIBLE_COUNT} visible.`;
    } else {
      controlSummary.textContent = `Aggressive mode is on. ChatTrim will prune older turns as this chat grows beyond ${VISIBLE_COUNT} messages.`;
    }
  } else {
    controlToggleButton.textContent = "ChatTrim · Safe mode";
    controlSummary.textContent = "Safe mode leaves the full chat untouched. Switch back to aggressive mode to prune older turns again.";
  }

  controlButtons.aggressiveButton.classList.toggle("is-active", currentMode === MODE_AGGRESSIVE);
  controlButtons.safeButton.classList.toggle("is-active", currentMode === MODE_SAFE);
  controlButtons.aggressiveButton.disabled = currentMode === MODE_AGGRESSIVE;
  controlButtons.safeButton.disabled = currentMode === MODE_SAFE;
  controlButtons.restoreButton.disabled = currentMode === MODE_SAFE || sessionPrunedTurns === 0;
  controlButtons.restoreButton.hidden = currentMode === MODE_SAFE || sessionPrunedTurns === 0;

  if (currentMode === MODE_SAFE) {
    setControlExpanded(true);
    return;
  }

  if (sessionPrunedTurns === 0) {
    setControlExpanded(false);
  }
}

function pruneOlderTurns(turns) {
  if (turns.length <= VISIBLE_COUNT) {
    lastRemovedTurns = 0;
    return {
      liveTurnsCount: turns.length,
      removedTurns: 0,
      firstVisibleTurn: turns[0] || null,
      firstVisibleNode: getTurnRootNode(turns[0] || null, chatContainer),
    };
  }

  const pruneCount = turns.length - VISIBLE_COUNT;
  const removableTurns = turns.slice(0, pruneCount);
  const firstVisibleTurn = turns[pruneCount] || null;
  const firstVisibleNode = getTurnRootNode(firstVisibleTurn, chatContainer);
  const removableNodes = [];
  const seenNodes = new Set();

  removableTurns.forEach((turn) => {
    const rootNode = getTurnRootNode(turn, chatContainer);
    if (!rootNode || seenNodes.has(rootNode)) {
      return;
    }

    seenNodes.add(rootNode);
    removableNodes.push(rootNode);
  });

  preserveScrollPosition(firstVisibleNode, () => {
    removableNodes.forEach((node) => node.remove());
  });

  sessionPrunedTurns += pruneCount;
  lastRemovedTurns = pruneCount;

  return {
    liveTurnsCount: VISIBLE_COUNT,
    removedTurns: pruneCount,
    firstVisibleTurn,
    firstVisibleNode,
  };
}

function resetChatState() {
  chatContainer = null;
  sessionPrunedTurns = 0;
  lastRemovedTurns = 0;
  lastProcessedTurnCount = -1;
  removeControl();
  attachObserver(document.body);
}

function handleNavigationChange() {
  const currentUrl = location.href;
  if (currentUrl === lastKnownUrl) {
    return false;
  }

  lastKnownUrl = currentUrl;
  resetChatState();
  profiler.recordNavigationReset(currentUrl);
  setTimeout(processChat, 0);
  return true;
}

function wrapHistoryMethod(methodName) {
  const original = history[methodName];

  history[methodName] = function wrappedHistoryMethod(...args) {
    const result = original.apply(this, args);
    handleNavigationChange();
    return result;
  };
}

function processChat() {
  const startedAt = performance.now();
  const turns = getConversationTurns();
  const discoveredTurnsCount = turns.length;

  if (discoveredTurnsCount === 0) {
    removeControl();
    attachObserver(document.body);
    profiler.recordProcessPass({
      durationMs: performance.now() - startedAt,
      discoveredTurnsCount: 0,
      liveTurnsCount: 0,
      removedTurns: 0,
      prunedTurnsTotal: sessionPrunedTurns,
      skippedReason: "no-turns",
    });
    return;
  }

  chatContainer = findTurnsContainer(turns);
  attachObserver(chatContainer);

  const anchorTurn = turns[Math.max(0, turns.length - Math.min(turns.length, VISIBLE_COUNT))] || turns[0];
  const anchorNode = getTurnRootNode(anchorTurn, chatContainer);
  renderControl(anchorNode, discoveredTurnsCount);

  if (currentMode === MODE_SAFE) {
    lastProcessedTurnCount = discoveredTurnsCount;
    profiler.recordProcessPass({
      durationMs: performance.now() - startedAt,
      discoveredTurnsCount,
      liveTurnsCount: discoveredTurnsCount,
      removedTurns: 0,
      prunedTurnsTotal: sessionPrunedTurns,
      skippedReason: "safe-mode",
    });
    return;
  }

  if (discoveredTurnsCount === lastProcessedTurnCount) {
    profiler.recordProcessPass({
      durationMs: performance.now() - startedAt,
      discoveredTurnsCount,
      liveTurnsCount: Math.min(discoveredTurnsCount, VISIBLE_COUNT),
      removedTurns: 0,
      prunedTurnsTotal: sessionPrunedTurns,
      skippedReason: "same-turn-count",
    });
    return;
  }

  const pruneResult = pruneOlderTurns(turns);
  lastProcessedTurnCount = pruneResult.liveTurnsCount;
  renderControl(pruneResult.firstVisibleNode || anchorNode, discoveredTurnsCount);

  profiler.recordProcessPass({
    durationMs: performance.now() - startedAt,
    discoveredTurnsCount,
    liveTurnsCount: pruneResult.liveTurnsCount,
    removedTurns: pruneResult.removedTurns,
    prunedTurnsTotal: sessionPrunedTurns,
    skippedReason: "",
  });
}

function debounce(fn, ms) {
  let timerId = 0;
  return (...args) => {
    clearTimeout(timerId);
    timerId = window.setTimeout(() => fn(...args), ms);
  };
}

function createProfiler() {
  const enabled = isDebugEnabled();
  const consoleEnabled = isConsoleDebugEnabled();

  if (!enabled) {
    return {
      enabled: false,
      initialize() {},
      recordGetConversationTurns() {},
      recordMutationBatch() {},
      recordNavigationReset() {},
      recordObserverTarget() {},
      recordModeChange() {},
      recordProcessPass() {},
    };
  }

  const state = {
    startedAt: performance.now(),
    mutationBatches: 0,
    mutationRelevantBatches: 0,
    mutationRecords: 0,
    mutationMaxBatchSize: 0,
    nodesAdded: 0,
    nodesRemoved: 0,
    processPassCalls: 0,
    processPassSkipped: 0,
    processPassTotalMs: 0,
    processPassMaxMs: 0,
    lastProcessPassMs: 0,
    getTurnsCalls: 0,
    getTurnsTotalMs: 0,
    getTurnsMaxMs: 0,
    lastGetTurnsMs: 0,
    lastTurnQuerySource: "none",
    discoveredTurnsCount: 0,
    liveTurnsCount: 0,
    prunedTurnsTotal: 0,
    lastRemovedTurns: 0,
    lastSkipReason: "startup",
    observerTarget: "body",
    currentMode,
    navigationResets: 0,
    modeChanges: 0,
    longTaskCount: 0,
    longTaskTotalMs: 0,
    longTaskMaxMs: 0,
    recentLongTasksMs: [],
  };

  let panel = null;
  let panelBody = null;
  let renderTimerId = 0;
  let consoleLogTick = 0;

  function toFixed(value, digits) {
    return Number.isFinite(value) ? value.toFixed(digits) : "n/a";
  }

  function sampleHeapUsedMb() {
    if (!performance.memory || typeof performance.memory.usedJSHeapSize !== "number") {
      return null;
    }

    return performance.memory.usedJSHeapSize / (1024 * 1024);
  }

  function sampleDomElementCount() {
    try {
      return document.getElementsByTagName("*").length;
    } catch {
      return null;
    }
  }

  function sampleSnapshot() {
    const uptimeSec = (performance.now() - state.startedAt) / 1000;
    const heapUsedMb = sampleHeapUsedMb();

    return {
      uptimeSec: Number(uptimeSec.toFixed(1)),
      currentMode: state.currentMode,
      observerTarget: state.observerTarget,
      mutationBatches: state.mutationBatches,
      mutationRelevantBatches: state.mutationRelevantBatches,
      mutationRecords: state.mutationRecords,
      mutationMaxBatchSize: state.mutationMaxBatchSize,
      nodesAdded: state.nodesAdded,
      nodesRemoved: state.nodesRemoved,
      processPassCalls: state.processPassCalls,
      processPassSkipped: state.processPassSkipped,
      processPassAvgMs: state.processPassCalls ? Number((state.processPassTotalMs / state.processPassCalls).toFixed(3)) : 0,
      processPassMaxMs: Number(state.processPassMaxMs.toFixed(3)),
      processPassLastMs: Number(state.lastProcessPassMs.toFixed(3)),
      getTurnsCalls: state.getTurnsCalls,
      getTurnsAvgMs: state.getTurnsCalls ? Number((state.getTurnsTotalMs / state.getTurnsCalls).toFixed(3)) : 0,
      getTurnsMaxMs: Number(state.getTurnsMaxMs.toFixed(3)),
      getTurnsLastMs: Number(state.lastGetTurnsMs.toFixed(3)),
      lastTurnQuerySource: state.lastTurnQuerySource,
      discoveredTurnsCount: state.discoveredTurnsCount,
      liveTurnsCount: state.liveTurnsCount,
      prunedTurnsTotal: state.prunedTurnsTotal,
      lastRemovedTurns: state.lastRemovedTurns,
      lastSkipReason: state.lastSkipReason,
      navigationResets: state.navigationResets,
      modeChanges: state.modeChanges,
      longTaskCount: state.longTaskCount,
      longTaskAvgMs: state.longTaskCount ? Number((state.longTaskTotalMs / state.longTaskCount).toFixed(3)) : 0,
      longTaskMaxMs: Number(state.longTaskMaxMs.toFixed(3)),
      recentLongTasksMs: state.recentLongTasksMs.slice(),
      heapUsedMb: heapUsedMb === null ? null : Number(heapUsedMb.toFixed(1)),
      domElements: sampleDomElementCount(),
      location: location.pathname,
    };
  }

  function formatPanelText(snapshot) {
    return [
      `mode        ${snapshot.currentMode}`,
      `observer    ${snapshot.observerTarget}`,
      `mutations   ${snapshot.mutationBatches} batches / ${snapshot.mutationRelevantBatches} relevant / ${snapshot.mutationRecords} records`,
      `nodes       +${snapshot.nodesAdded} / -${snapshot.nodesRemoved} (max batch ${snapshot.mutationMaxBatchSize})`,
      `process     ${snapshot.processPassCalls} passes avg ${toFixed(snapshot.processPassAvgMs, 2)}ms max ${toFixed(snapshot.processPassMaxMs, 2)}ms`,
      `getTurns    ${snapshot.getTurnsCalls} calls avg ${toFixed(snapshot.getTurnsAvgMs, 2)}ms max ${toFixed(snapshot.getTurnsMaxMs, 2)}ms`,
      `turns       ${snapshot.liveTurnsCount} live / ${snapshot.discoveredTurnsCount} discovered / ${snapshot.prunedTurnsTotal} pruned`,
      `last pass   removed ${snapshot.lastRemovedTurns} skip=${snapshot.lastSkipReason}`,
      `long tasks  ${snapshot.longTaskCount} total max ${toFixed(snapshot.longTaskMaxMs, 1)}ms`,
      `heap / DOM  ${snapshot.heapUsedMb === null ? "n/a" : `${toFixed(snapshot.heapUsedMb, 1)} MB`} / ${snapshot.domElements === null ? "n/a" : snapshot.domElements} elements`,
      `query=${snapshot.lastTurnQuerySource} nav=${snapshot.navigationResets} modeChanges=${snapshot.modeChanges}`,
    ].join("\n");
  }

  function ensurePanel() {
    if (panel || !document.body) {
      return;
    }

    panel = document.createElement("div");
    panel.id = DEBUG_PANEL_ID;
    panel.addEventListener("click", () => {
      printSnapshot("panel-click");
    });

    const title = document.createElement("strong");
    title.textContent = "ChatTrim Debug";

    panelBody = document.createElement("div");
    panelBody.className = "muted";

    panel.appendChild(title);
    panel.appendChild(panelBody);
    document.body.appendChild(panel);
  }

  function renderPanel() {
    ensurePanel();
    if (!panelBody) {
      return;
    }

    panelBody.textContent = formatPanelText(sampleSnapshot());
  }

  function printSnapshot(reason) {
    console.info(`[ChatTrim][debug:${reason}]`, sampleSnapshot());
  }

  function startLongTaskObserver() {
    if (typeof PerformanceObserver !== "function") {
      return;
    }

    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          state.longTaskCount += 1;
          state.longTaskTotalMs += entry.duration;
          state.longTaskMaxMs = Math.max(state.longTaskMaxMs, entry.duration);
          state.recentLongTasksMs.push(Number(entry.duration.toFixed(3)));
          if (state.recentLongTasksMs.length > 8) {
            state.recentLongTasksMs.shift();
          }
        });
      });

      longTaskObserver.observe({ entryTypes: ["longtask"] });
    } catch {
      return;
    }
  }

  return {
    enabled: true,
    initialize() {
      state.currentMode = currentMode;
      renderPanel();
      startLongTaskObserver();

      renderTimerId = window.setInterval(() => {
        renderPanel();
        if (consoleEnabled) {
          consoleLogTick += 1;
          if (consoleLogTick % 3 === 0) {
            printSnapshot("interval");
          }
        }
      }, 2000);

      window.addEventListener("beforeunload", () => {
        if (renderTimerId) {
          clearInterval(renderTimerId);
        }
      });

      printSnapshot("init");
    },
    recordGetConversationTurns(durationMs, turnsCount, source) {
      state.getTurnsCalls += 1;
      state.getTurnsTotalMs += durationMs;
      state.getTurnsMaxMs = Math.max(state.getTurnsMaxMs, durationMs);
      state.lastGetTurnsMs = durationMs;
      state.discoveredTurnsCount = turnsCount;
      state.lastTurnQuerySource = source;
    },
    recordMutationBatch(records, relevant) {
      state.mutationBatches += 1;
      if (relevant) {
        state.mutationRelevantBatches += 1;
      }

      state.mutationRecords += records.length;
      state.mutationMaxBatchSize = Math.max(state.mutationMaxBatchSize, records.length);

      records.forEach((record) => {
        state.nodesAdded += record.addedNodes.length;
        state.nodesRemoved += record.removedNodes.length;
      });
    },
    recordNavigationReset() {
      state.navigationResets += 1;
      state.discoveredTurnsCount = 0;
      state.liveTurnsCount = 0;
      state.prunedTurnsTotal = 0;
      state.lastRemovedTurns = 0;
      state.lastSkipReason = "navigation-reset";
      state.observerTarget = "body";
    },
    recordObserverTarget(label) {
      state.observerTarget = label;
    },
    recordModeChange(mode) {
      state.currentMode = mode;
      state.modeChanges += 1;
      state.lastSkipReason = `mode:${mode}`;
    },
    recordProcessPass({ durationMs, discoveredTurnsCount, liveTurnsCount, removedTurns, prunedTurnsTotal, skippedReason }) {
      state.processPassCalls += 1;
      state.processPassTotalMs += durationMs;
      state.processPassMaxMs = Math.max(state.processPassMaxMs, durationMs);
      state.lastProcessPassMs = durationMs;
      state.discoveredTurnsCount = discoveredTurnsCount;
      state.liveTurnsCount = liveTurnsCount;
      state.prunedTurnsTotal = prunedTurnsTotal;
      state.lastRemovedTurns = removedTurns;
      state.lastSkipReason = skippedReason || "applied";
      state.currentMode = currentMode;

      if (skippedReason) {
        state.processPassSkipped += 1;
      }
    },
  };
}

const scheduleProcessChat = debounce(processChat, 150);

wrapHistoryMethod("pushState");
wrapHistoryMethod("replaceState");
window.addEventListener("popstate", () => {
  if (handleNavigationChange()) {
    scheduleProcessChat();
  }
});

injectStyle();
profiler.initialize();

observer = new MutationObserver((records) => {
  const navigated = handleNavigationChange();
  const relevant = mutationMayAffectTurnCount(records);
  profiler.recordMutationBatch(records, relevant);

  if (navigated || relevant) {
    scheduleProcessChat();
  }
});

attachObserver(document.body);
processChat();
setTimeout(processChat, 1000);

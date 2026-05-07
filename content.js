const VISIBLE_COUNT = 10;
const HIDDEN_CLASS = "chattrim-hidden";
const BUTTON_ID = "chattrim-show-all";
const STYLE_ID = "chattrim-style";

let trimDisabled = false;
let lastKnownUrl = location.href;

function injectStyle() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${HIDDEN_CLASS} { display: none !important; }
    #${BUTTON_ID} {
      display: block;
      width: 100%;
      padding: 10px 12px;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #0f172a 0%, #172554 100%);
      color: #e2f8ff;
      border: 1px solid rgba(34, 211, 238, 0.28);
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      box-sizing: border-box;
      transition: background 120ms ease, transform 120ms ease;
    }
    #${BUTTON_ID}:hover {
      background: linear-gradient(135deg, #13213d 0%, #1d4ed8 100%);
      transform: translateY(-1px);
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

function getConversationTurns() {
  let turns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
  if (turns.length > 0) {
    return turns;
  }

  const main = document.querySelector("main");
  if (main) {
    turns = Array.from(main.querySelectorAll("article"));
    if (turns.length > 0) {
      return turns;
    }
  }

  return [];
}

function formatHiddenMessageLabel(count) {
  return count === 1 ? "Show 1 hidden message" : `Show ${count} hidden messages`;
}

function updateButton(hideCount, firstVisibleEl) {
  let button = document.getElementById(BUTTON_ID);

  if (hideCount === 0 || !firstVisibleEl || !firstVisibleEl.parentNode) {
    if (button) {
      button.remove();
    }
    return;
  }

  if (!button) {
    button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.addEventListener("click", showAll);
  }

  button.textContent = formatHiddenMessageLabel(hideCount);

  if (button.parentNode !== firstVisibleEl.parentNode || button.nextElementSibling !== firstVisibleEl) {
    firstVisibleEl.parentNode.insertBefore(button, firstVisibleEl);
  }
}

function showAll() {
  trimDisabled = true;

  document.querySelectorAll("." + HIDDEN_CLASS).forEach((element) => {
    element.classList.remove(HIDDEN_CLASS);
  });

  const button = document.getElementById(BUTTON_ID);
  if (button) {
    button.remove();
  }
}

function applyWindow() {
  if (trimDisabled) {
    return;
  }

  const turns = getConversationTurns();
  if (turns.length === 0) {
    return;
  }

  const hideCount = Math.max(0, turns.length - VISIBLE_COUNT);

  turns.forEach((element, index) => {
    if (index < hideCount) {
      element.classList.add(HIDDEN_CLASS);
    } else {
      element.classList.remove(HIDDEN_CLASS);
    }
  });

  updateButton(hideCount, turns[hideCount] || turns[0]);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function resetForNavigation() {
  const currentUrl = location.href;
  if (currentUrl === lastKnownUrl) {
    return;
  }

  lastKnownUrl = currentUrl;
  trimDisabled = false;
  setTimeout(applyWindow, 0);
}

function wrapHistoryMethod(methodName) {
  const original = history[methodName];

  history[methodName] = function wrappedHistoryMethod(...args) {
    const result = original.apply(this, args);
    resetForNavigation();
    return result;
  };
}

const onMutation = debounce(() => {
  resetForNavigation();
  applyWindow();
}, 150);

wrapHistoryMethod("pushState");
wrapHistoryMethod("replaceState");
window.addEventListener("popstate", resetForNavigation);

injectStyle();

const observer = new MutationObserver(onMutation);
observer.observe(document.body, { childList: true, subtree: true });

applyWindow();
setTimeout(applyWindow, 1000);

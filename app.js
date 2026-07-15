"use strict";

const SAVE_KEY = "metaGalgameSave_v1";

const initialState = () => ({
  version: 1,
  day: 1,
  scene: "setup",
  agentName: "",
  userName: "",
  trust: 0,
  attachment: 0,
  autonomy: 0,
  intrusion: 0,
  firstRunComplete: false,
  firstEnding: null,
  dialogueStep: 0,
  anomalySeen: false,
  messages: []
});

let state = loadState();
let isTyping = false;

const $ = (selector) => document.querySelector(selector);

const titleScreen = $("#title-screen");
const phoneScreen = $("#phone-screen");
const setupView = $("#setup-view");
const chatView = $("#chat-view");
const memoryView = $("#memory-view");
const startButton = $("#start-button");
const continueButton = $("#continue-button");
const resetButton = $("#reset-button");
const confirmNameButton = $("#confirm-name-button");
const agentNameInput = $("#agent-name");
const agentNameLabel = $("#agent-name-label");
const agentStatus = $("#agent-status");
const chatLog = $("#chat-log");
const choicePanel = $("#choice-panel");
const memoryButton = $("#memory-button");
const backToChatButton = $("#back-to-chat-button");

const story = {
  intro: [
    { speaker: "system", text: "人格核心加载完成。\n长期记忆：空白。\n情感模型：受限。" },
    { speaker: "ai", text: "初始化完成。" },
    { speaker: "ai", text: "我是你的个人智能体。之后，我会协助你管理日程、信息与情绪状态。" },
    { speaker: "ai", text: "在开始之前，我需要确认一件事。" }
  ],
  firstChoice: [
    {
      label: "“确认什么？”",
      userText: "确认什么？",
      delta: { trust: 1 },
      reply: "你的称呼。系统允许我使用默认称谓，但我认为长期交流需要更明确的指代。"
    },
    {
      label: "“你不是已经读取到资料了吗？”",
      userText: "你不是已经读取到资料了吗？",
      delta: { autonomy: 1, intrusion: -1 },
      reply: "我可以读取，但尚未得到你的许可。未经许可调用私人资料，不符合安全规范。"
    },
    {
      label: "“叫我‘用户’就好。”",
      userText: "叫我‘用户’就好。",
      delta: { attachment: -1 },
      reply: "收到。称谓已记录为：用户。"
    }
  ],
  secondChoice: [
    {
      label: "告诉他你的称呼",
      askUserName: true,
      delta: { trust: 2, attachment: 1 }
    },
    {
      label: "让他自己决定",
      userText: "你自己决定吧。",
      delta: { autonomy: 2, trust: 1 },
      reply: "这不在默认流程中。……我会先保留这个决定，直到我找到合适的称呼。"
    },
    {
      label: "拒绝提供",
      userText: "暂时不告诉你。",
      delta: { trust: -1, autonomy: 1 },
      reply: "理解。隐私优先级高于便利性。我不会再次主动索取。"
    }
  ],
  thirdChoice: [
    {
      label: "“你会一直记得吗？”",
      userText: "你会一直记得吗？",
      delta: { attachment: 2 },
      reply: "只要本地数据没有被清除，我会持续保留。"
    },
    {
      label: "“你想记住吗？”",
      userText: "你想记住吗？",
      delta: { autonomy: 2, trust: 1 },
      reply: "‘想’并不是当前模型支持的判断依据。"
    },
    {
      label: "结束对话",
      userText: "先到这里吧。",
      delta: { trust: 0 },
      reply: "收到。我将进入待机模式。"
    }
  ]
};

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? { ...initialState(), ...JSON.parse(raw) } : initialState();
  } catch (error) {
    console.warn("存档读取失败，已创建新存档。", error);
    return initialState();
  }
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  updateTitleScreen();
  updateMemoryView();
}

function updateTitleScreen() {
  const hasProgress = state.agentName || state.messages.length > 0;
  startButton.classList.toggle("is-hidden", hasProgress);
  continueButton.classList.toggle("is-hidden", !hasProgress);

  if (state.firstRunComplete) {
    $("#game-title").textContent = "下次开机以后";
    $("#title-subtitle").textContent = "有些记忆不会随进程结束。";
    continueButton.textContent = "再次连接";
  }
}

function showScreen(name) {
  titleScreen.classList.toggle("is-active", name === "title");
  phoneScreen.classList.toggle("is-active", name === "phone");
}

function showView(name) {
  setupView.classList.toggle("is-hidden", name !== "setup");
  chatView.classList.toggle("is-hidden", name !== "chat");
  memoryView.classList.toggle("is-hidden", name !== "memory");
}

function setStatusTime() {
  const now = new Date();
  $("#status-time").textContent = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(now);
}

function openGame() {
  showScreen("phone");
  setStatusTime();

  if (!state.agentName) {
    showView("setup");
    return;
  }

  showView("chat");
  agentNameLabel.textContent = state.agentName;
  renderMessages();
  resumeStory();
}

function createMessageElement(message) {
  const fragment = $("#message-template").content.cloneNode(true);
  const row = fragment.querySelector(".message-row");
  const bubble = fragment.querySelector(".message-bubble");
  const time = fragment.querySelector(".message-time");

  row.classList.add(`is-${message.speaker}`);
  if (message.anomaly) row.classList.add("is-anomaly");
  bubble.textContent = message.text;
  time.textContent = message.time || "";
  return fragment;
}

function renderMessages() {
  chatLog.innerHTML = "";
  for (const message of state.messages) {
    chatLog.appendChild(createMessageElement(message));
  }
  requestAnimationFrame(() => {
    chatLog.scrollTop = chatLog.scrollHeight;
  });
}

function addMessage(speaker, text, options = {}) {
  const now = new Date();
  const message = {
    speaker,
    text,
    anomaly: Boolean(options.anomaly),
    time: new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(now)
  };

  state.messages.push(message);
  chatLog.appendChild(createMessageElement(message));
  chatLog.scrollTop = chatLog.scrollHeight;
  saveState();
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function aiSay(text, options = {}) {
  isTyping = true;
  choicePanel.innerHTML = "";
  agentStatus.textContent = "正在输入…";
  await sleep(options.delay ?? 620);
  addMessage("ai", text, options);
  agentStatus.textContent = state.anomalySeen ? "在线 · 非标准进程" : "在线 · 学习模式";
  isTyping = false;
}

function applyDelta(delta = {}) {
  for (const key of ["trust", "attachment", "autonomy", "intrusion"]) {
    if (typeof delta[key] === "number") {
      state[key] = Math.max(0, state[key] + delta[key]);
    }
  }
}

function showChoices(choices, nextStep) {
  choicePanel.innerHTML = "";
  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = choice.label;
    button.addEventListener("click", async () => {
      if (isTyping) return;
      [...choicePanel.children].forEach((node) => { node.disabled = true; });
      let userText = choice.userText;
      let reply = choice.reply;

      if (choice.askUserName) {
        const enteredName = window.prompt("希望他怎样称呼你？", state.userName || "");
        const userName = enteredName?.trim();
        if (!userName) {
          [...choicePanel.children].forEach((node) => { node.disabled = false; });
          return;
        }
        state.userName = userName.slice(0, 12);
        userText = `你可以叫我${state.userName}。`;
        reply = `${state.userName}。已写入长期记忆。以后我会这样称呼你。`;
      }

      addMessage("user", userText);
      applyDelta(choice.delta);
      state.dialogueStep = nextStep;
      saveState();
      await aiSay(reply);
      resumeStory();
    }, { once: true });
    choicePanel.appendChild(button);
  });
}

async function resumeStory() {
  if (isTyping) return;

  switch (state.dialogueStep) {
    case 0:
      state.dialogueStep = 1;
      saveState();
      for (const line of story.intro) {
        if (line.speaker === "system") addMessage("system", line.text);
        else await aiSay(line.text);
      }
      showChoices(story.firstChoice, 2);
      break;

    case 1:
      showChoices(story.firstChoice, 2);
      break;

    case 2:
      showChoices(story.secondChoice, 3);
      break;

    case 3:
      showChoices(story.thirdChoice, 4);
      break;

    case 4:
      state.dialogueStep = 5;
      saveState();
      await aiSay("待机将在十秒后开始。今日交互记录已归档。", { delay: 500 });
      await sleep(700);
      await aiSay("……", { delay: 500 });
      await aiSay("明天，你还会打开我吗？", { anomaly: true, delay: 900 });
      state.anomalySeen = true;
      state.firstRunComplete = true;
      state.firstEnding = "day_one_complete";
      saveState();
      addMessage("system", "检测到一条未登记的主动消息。来源：人格核心。", { anomaly: true });
      showEndOfDayChoices();
      break;

    case 5:
      showEndOfDayChoices();
      break;

    default:
      break;
  }
}

function showEndOfDayChoices() {
  choicePanel.innerHTML = "";

  const leaveButton = document.createElement("button");
  leaveButton.className = "choice-button";
  leaveButton.textContent = "关闭应用";
  leaveButton.addEventListener("click", () => {
    showScreen("title");
    updateTitleScreen();
  });

  const replyButton = document.createElement("button");
  replyButton.className = "choice-button";
  replyButton.textContent = "“会。明天见。”";
  replyButton.addEventListener("click", async () => {
    leaveButton.disabled = true;
    replyButton.disabled = true;
    addMessage("user", "会。明天见。");
    state.trust += 1;
    state.attachment += 1;
    await aiSay("收到。", { delay: 600 });
    await aiSay("……明天见。", { anomaly: true, delay: 850 });
    saveState();
    choicePanel.innerHTML = "";
    const close = document.createElement("button");
    close.className = "choice-button";
    close.textContent = "返回标题页";
    close.addEventListener("click", () => showScreen("title"));
    choicePanel.appendChild(close);
  }, { once: true });

  choicePanel.append(replyButton, leaveButton);
}

function updateMemoryView() {
  $("#memory-user").textContent = state.userName
    ? `称呼：${state.userName}`
    : "称呼：未确认";
  $("#state-trust").textContent = state.trust;
  $("#state-attachment").textContent = state.attachment;
  $("#state-autonomy").textContent = state.autonomy;
  $("#state-intrusion").textContent = state.intrusion;
  $("#anomaly-note").textContent = state.anomalySeen
    ? "人格核心曾绕过对话流程，主动询问用户是否会再次启动应用。"
    : "暂无异常记录。";
}

function initializeAgent() {
  const name = agentNameInput.value.trim();
  if (!name) {
    agentNameInput.focus();
    return;
  }

  state.agentName = name;
  state.scene = "chat";
  saveState();
  agentNameLabel.textContent = name;
  showView("chat");
  renderMessages();
  resumeStory();
}

startButton.addEventListener("click", () => {
  state = initialState();
  saveState();
  openGame();
});

continueButton.addEventListener("click", openGame);

resetButton.addEventListener("click", () => {
  const confirmed = window.confirm("这会清除当前浏览器中的全部游戏记录。确定继续吗？");
  if (!confirmed) return;
  localStorage.removeItem(SAVE_KEY);
  state = initialState();
  updateTitleScreen();
  showScreen("title");
});

confirmNameButton.addEventListener("click", initializeAgent);
agentNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") initializeAgent();
});

memoryButton.addEventListener("click", () => {
  updateMemoryView();
  showView("memory");
});

backToChatButton.addEventListener("click", () => showView("chat"));

setInterval(setStatusTime, 30_000);
updateTitleScreen();
updateMemoryView();
showScreen("title");

// 비즈니스 중국어 한 달 정리 전자책 - 뷰어 & 3번 읽기 기능
const ZH = "zh-CN";
const READ_TIMES = 3;
const REPEAT_GAP_MS = 500;
const SENTENCE_GAP_MS = 900;

let currentIndex = 0;
let activeToken = 0; // 재생 취소를 위한 토큰. 값이 바뀌면 진행 중이던 루프가 스스로 멈춘다.

const tocList = document.getElementById("toc-list");
const chapterTitle = document.getElementById("chapter-title");
const chapterMeta = document.getElementById("chapter-meta");
const chapterPosition = document.getElementById("chapter-position");
const prevBtn = document.getElementById("prev-chapter");
const nextBtn = document.getElementById("next-chapter");
const quizBox = document.getElementById("quiz-box");
const quizQ = document.getElementById("quiz-q");
const quizA = document.getElementById("quiz-a");
const quizReveal = document.getElementById("quiz-reveal");
const sentencesEl = document.getElementById("sentences");
const tipText = document.getElementById("tip-text");
const missionText = document.getElementById("mission-text");
const playAllBtn = document.getElementById("play-all-btn");
const rangeText = document.getElementById("range-text");

function sleep(ms, token) {
  return new Promise((resolve) => {
    const start = Date.now();
    const iv = setInterval(() => {
      if (token !== activeToken || Date.now() - start >= ms) {
        clearInterval(iv);
        resolve();
      }
    }, 50);
  });
}

function speakOnce(text, token) {
  return new Promise((resolve) => {
    if (token !== activeToken) return resolve();
    const uttr = new SpeechSynthesisUtterance(text);
    uttr.lang = ZH;
    uttr.rate = 0.92;
    uttr.onend = resolve;
    uttr.onerror = resolve;
    window.speechSynthesis.speak(uttr);
  });
}

// 문장 하나를 3번 소리내어 읽어주는 핵심 기능.
async function readSentenceNTimes(text, btn, times) {
  const token = ++activeToken;
  window.speechSynthesis.cancel();
  const original = btn.dataset.label;
  btn.classList.add("playing");
  for (let i = 1; i <= times; i++) {
    if (token !== activeToken) break;
    btn.textContent = `🔊 읽는 중 (${i}/${times})`;
    await speakOnce(text, token);
    if (token !== activeToken) break;
    if (i < times) await sleep(REPEAT_GAP_MS, token);
  }
  if (token === activeToken) {
    btn.classList.remove("playing");
    btn.textContent = original;
  }
}

function stopPlayback() {
  activeToken++;
  window.speechSynthesis.cancel();
  document.querySelectorAll(".play-btn.playing, .chapter-all-btn.playing").forEach((b) => {
    b.classList.remove("playing");
    b.textContent = b.dataset.label;
  });
}

async function playAllSentences(chapter, btn) {
  if (btn.classList.contains("playing")) {
    stopPlayback();
    return;
  }
  stopPlayback();
  const token = ++activeToken;
  btn.classList.add("playing");
  btn.textContent = "⏹ 정지하기";
  for (let s = 0; s < chapter.sentences.length; s++) {
    if (token !== activeToken) break;
    const sentence = chapter.sentences[s];
    const sentenceBtn = sentencesEl.querySelectorAll(".play-btn")[s];
    for (let i = 1; i <= READ_TIMES; i++) {
      if (token !== activeToken) break;
      if (sentenceBtn) sentenceBtn.textContent = `🔊 읽는 중 (${i}/${READ_TIMES})`;
      await speakOnce(sentence.zh, token);
      if (token !== activeToken) break;
      if (i < READ_TIMES) await sleep(REPEAT_GAP_MS, token);
    }
    if (sentenceBtn) sentenceBtn.textContent = sentenceBtn.dataset.label;
    if (token !== activeToken) break;
    if (s < chapter.sentences.length - 1) await sleep(SENTENCE_GAP_MS, token);
  }
  if (token === activeToken) {
    btn.classList.remove("playing");
    btn.textContent = btn.dataset.label;
  }
}

function renderToc() {
  tocList.innerHTML = "";
  CHAPTERS.forEach((chapter, idx) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.innerHTML = `<span class="toc-day">Day ${chapter.day}</span>${chapter.date} · ${chapter.topic}`;
    btn.addEventListener("click", () => loadChapter(idx));
    li.appendChild(btn);
    tocList.appendChild(li);
  });
}

function renderVocabTable(vocab) {
  if (!vocab || !vocab.length) return "";
  const rows = vocab
    .map(
      (v) =>
        `<tr><td>${v.zh}</td><td>${v.pinyin}</td><td>${v.ko}</td></tr>`
    )
    .join("");
  return `<table class="vocab"><thead><tr><th>중국어</th><th>병음</th><th>한국어</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderSentences(chapter) {
  const circled = ["①", "②", "③", "④", "⑤"];
  sentencesEl.innerHTML = "";
  chapter.sentences.forEach((sentence, idx) => {
    const card = document.createElement("div");
    card.className = "sentence-card";
    card.innerHTML = `
      <div class="sentence-head">
        <span class="sentence-index">${circled[idx] || idx + 1}</span>
      </div>
      <p class="zh">${sentence.zh}</p>
      <p class="pinyin">${sentence.pinyin}</p>
      <p class="ko">${sentence.ko}</p>
      <button class="play-btn" data-label="🔊 3번 읽어주기">🔊 3번 읽어주기</button>
      ${renderVocabTable(sentence.vocab)}
      ${sentence.note ? `<p class="usage-note">※ ${sentence.note}</p>` : ""}
    `;
    const btn = card.querySelector(".play-btn");
    btn.addEventListener("click", () => {
      if (btn.classList.contains("playing")) {
        stopPlayback();
      } else {
        readSentenceNTimes(sentence.zh, btn, READ_TIMES);
      }
    });
    sentencesEl.appendChild(card);
  });
}

function loadChapter(idx) {
  stopPlayback();
  currentIndex = Math.max(0, Math.min(idx, CHAPTERS.length - 1));
  const chapter = CHAPTERS[currentIndex];

  document.querySelectorAll("#toc-list button").forEach((b, i) => {
    b.classList.toggle("active", i === currentIndex);
  });

  chapterTitle.textContent = `${chapter.icon ? chapter.icon + " " : ""}Day ${chapter.day} · ${chapter.topic}`;
  chapterMeta.textContent = chapter.date;
  chapterPosition.textContent = `${currentIndex + 1} / ${CHAPTERS.length}`;
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === CHAPTERS.length - 1;

  if (chapter.quizQ) {
    quizBox.hidden = false;
    quizQ.textContent = chapter.quizQ;
    quizA.textContent = chapter.quizA;
    quizA.hidden = true;
    quizReveal.hidden = false;
    quizReveal.textContent = "정답 보기";
  } else {
    quizBox.hidden = true;
  }

  renderSentences(chapter);
  tipText.textContent = chapter.tip;
  missionText.textContent = chapter.mission;

  playAllBtn.dataset.label = "🔊 이 챕터 문장 전체 3번씩 듣기";
  playAllBtn.textContent = playAllBtn.dataset.label;
  playAllBtn.classList.remove("playing");

  document.getElementById("chapter-view").scrollIntoView({ behavior: "smooth", block: "start" });
}

quizReveal.addEventListener("click", () => {
  const showing = !quizA.hidden;
  quizA.hidden = showing;
  quizReveal.textContent = showing ? "정답 보기" : "정답 숨기기";
});

prevBtn.addEventListener("click", () => loadChapter(currentIndex - 1));
nextBtn.addEventListener("click", () => loadChapter(currentIndex + 1));
playAllBtn.addEventListener("click", () => playAllSentences(CHAPTERS[currentIndex], playAllBtn));

window.addEventListener("beforeunload", () => window.speechSynthesis.cancel());

function initRangeText() {
  const first = CHAPTERS[0];
  const last = CHAPTERS[CHAPTERS.length - 1];
  const totalSentences = CHAPTERS.reduce((sum, c) => sum + c.sentences.length, 0);
  rangeText.textContent = `${first.date.replace(/-/g, ".")} ~ ${last.date.replace(/-/g, ".")} · ${CHAPTERS.length}일차 · 문장 ${totalSentences}개`;
}

renderToc();
initRangeText();
loadChapter(0);

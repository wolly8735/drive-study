// 출근길 10분 섀도잉 - 재생 엔진
const KO = "ko-KR";

function buildDaySequence(day) {
  const seq = [];
  seq.push({ type: "text", lang: KO, text: day.intro });
  seq.push({ type: "pause", duration: 1000 });

  day.languages.forEach((l) => {
    seq.push({ type: "text", lang: KO, text: l.introKo });
    seq.push({ type: "pause", duration: 500 });
    seq.push({ type: "text", lang: KO, text: l.sentenceKo });
    seq.push({ type: "text", lang: l.lang, text: l.sentence, rate: 0.8 });
    seq.push({ type: "pause", duration: 5000 });
    seq.push({ type: "text", lang: KO, text: "보통 속도로 듣고 따라 해보세요." });
    seq.push({ type: "text", lang: l.lang, text: l.sentence, rate: 1.0 });
    seq.push({ type: "pause", duration: 4000 });
    seq.push({ type: "text", lang: KO, text: "원어민 속도로 자연스럽게 따라 해보세요." });
    seq.push({ type: "text", lang: l.lang, text: l.sentence, rate: 1.1 });
    seq.push({ type: "pause", duration: 4000 });
    seq.push({ type: "text", lang: KO, text: l.reviewKo });
    seq.push({ type: "pause", duration: 4000 });
  });

  seq.push({ type: "text", lang: KO, text: "오늘 배운 4개 국어 대표 단어를 최종 확인합니다." });
  seq.push({ type: "text", lang: KO, text: day.finalReview });
  seq.push({ type: "text", lang: KO, text: day.outro });
  return seq;
}

const statusEl = document.getElementById("status");
const textEl = document.getElementById("text-display");
const btn = document.getElementById("btn");
const progressBar = document.getElementById("progress-bar");
const streakEl = document.getElementById("streak");
const daySelect = document.getElementById("day-select");

let isPlaying = false;
let currentStep = 0;
let sequence = [];
let wakeLock = null;
let noSleepVideo = null;
let noSleepCanvasTimer = null;
let wakeLockRetryTimer = null;

function populateDaySelect() {
  daySelect.innerHTML = "";
  DAYS.forEach((day, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = day.title;
    daySelect.appendChild(opt);
  });
}

function loadDay(idx) {
  sequence = buildDaySequence(DAYS[idx]);
  currentStep = 0;
  updateProgress();
  textEl.innerText = "아래 버튼을 누르면 출근길 10분 학습이 시작됩니다.";
  statusEl.innerText = "준비 완료";
  btn.innerText = "▶ 학습 시작하기";
}

function updateProgress() {
  const pct = sequence.length ? Math.round((currentStep / sequence.length) * 100) : 0;
  progressBar.style.width = pct + "%";
}

function speak(text, lang, rate) {
  return new Promise((resolve) => {
    if (!isPlaying) return resolve();
    const uttr = new SpeechSynthesisUtterance(text);
    uttr.lang = lang;
    uttr.rate = rate || 1.0;
    uttr.onend = resolve;
    uttr.onerror = resolve;
    window.speechSynthesis.speak(uttr);
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (!isPlaying || Date.now() - start >= ms) return resolve();
      requestAnimationFrame(tick);
    };
    tick();
  });
}

// Wake Lock API를 지원하지 않는 브라우저(구형 iOS Safari, 카카오톡/네이버 인앱 브라우저 등)를
// 위한 보조 수단: 화면 밖 1x1 캔버스를 영상으로 스트리밍해 계속 재생시키면
// 대부분의 모바일 브라우저가 "영상 재생 중"으로 인식해 화면을 끄지 않습니다.
function startNoSleepVideo() {
  if (noSleepVideo) return;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    let tick = 0;
    noSleepCanvasTimer = setInterval(() => {
      tick = (tick + 1) % 2;
      ctx.fillStyle = tick ? "#000000" : "#010101";
      ctx.fillRect(0, 0, 1, 1);
    }, 1000);

    const stream = canvas.captureStream ? canvas.captureStream(1) : null;
    if (!stream) return;

    const video = document.createElement("video");
    video.muted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.style.position = "fixed";
    video.style.width = "1px";
    video.style.height = "1px";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    video.srcObject = stream;
    document.body.appendChild(video);
    video.play().catch(() => {});
    noSleepVideo = video;
  } catch (e) {
    // 지원하지 않는 브라우저에서는 조용히 무시합니다.
  }
}

function stopNoSleepVideo() {
  if (noSleepCanvasTimer) {
    clearInterval(noSleepCanvasTimer);
    noSleepCanvasTimer = null;
  }
  if (noSleepVideo) {
    noSleepVideo.pause();
    if (noSleepVideo.srcObject) {
      noSleepVideo.srcObject.getTracks().forEach((t) => t.stop());
    }
    noSleepVideo.remove();
    noSleepVideo = null;
  }
}

async function requestWakeLock() {
  startNoSleepVideo();
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    }
  } catch (e) {
    // Wake Lock API 실패는 noSleepVideo 로 보완하므로 무시합니다.
  }

  if (wakeLockRetryTimer) clearInterval(wakeLockRetryTimer);
  wakeLockRetryTimer = setInterval(() => {
    if (isPlaying && !wakeLock && "wakeLock" in navigator && document.visibilityState === "visible") {
      navigator.wakeLock
        .request("screen")
        .then((lock) => {
          wakeLock = lock;
          wakeLock.addEventListener("release", () => {
            wakeLock = null;
          });
        })
        .catch(() => {});
    }
  }, 10000);
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
  if (wakeLockRetryTimer) {
    clearInterval(wakeLockRetryTimer);
    wakeLockRetryTimer = null;
  }
  stopNoSleepVideo();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function markTodayCompleted() {
  const raw = localStorage.getItem("completedDates");
  const dates = raw ? JSON.parse(raw) : [];
  const today = todayKey();
  if (!dates.includes(today)) dates.push(today);
  localStorage.setItem("completedDates", JSON.stringify(dates));
  renderStreak();
}

function renderStreak() {
  const raw = localStorage.getItem("completedDates");
  const dates = new Set(raw ? JSON.parse(raw) : []);
  let streak = 0;
  const cursor = new Date();
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  streakEl.innerText = streak > 0 ? `🔥 연속 ${streak}일째 학습 중` : "오늘도 10분, 시작해볼까요?";
}

async function runFrom(startIndex) {
  for (let i = startIndex; i < sequence.length; i++) {
    if (!isPlaying) {
      currentStep = i;
      return;
    }
    const step = sequence[i];
    currentStep = i;
    updateProgress();

    if (step.type === "text") {
      statusEl.innerText = step.lang === KO ? "진행 중" : `진행 중 (${step.lang})`;
      textEl.innerText = step.text;
      await speak(step.text, step.lang, step.rate);
    } else if (step.type === "pause") {
      statusEl.innerText = "🗣️ 따라 읽는 시간 (무음)";
      await sleep(step.duration);
    }
  }

  if (isPlaying) {
    currentStep = sequence.length;
    updateProgress();
    statusEl.innerText = "학습 완료";
    textEl.innerText = "오늘의 출근길 10분 학습 완료!";
    btn.innerText = "▶ 다시 시작하기";
    isPlaying = false;
    releaseWakeLock();
    markTodayCompleted();
    currentStep = 0;
  }
}

function togglePlay() {
  if (!isPlaying) {
    if (currentStep >= sequence.length) currentStep = 0;
    isPlaying = true;
    btn.innerText = "⏸️ 일시 정지";
    requestWakeLock();
    runFrom(currentStep);
  } else {
    isPlaying = false;
    window.speechSynthesis.cancel();
    btn.innerText = currentStep > 0 ? "▶ 이어서 재생" : "▶ 학습 시작하기";
    statusEl.innerText = "일시 정지됨";
    releaseWakeLock();
  }
}

daySelect.addEventListener("change", () => {
  isPlaying = false;
  window.speechSynthesis.cancel();
  releaseWakeLock();
  loadDay(Number(daySelect.value));
});

btn.addEventListener("click", togglePlay);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && isPlaying) {
    if (wakeLock === null) requestWakeLock();
    if (noSleepVideo && noSleepVideo.paused) noSleepVideo.play().catch(() => {});
  }
});

populateDaySelect();
loadDay(0);
renderStreak();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

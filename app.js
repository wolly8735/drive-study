// 오늘의 식단 분석 - 사진 업로드 → AI 영양 분석
const MEALS = ["breakfast", "lunch", "dinner"];
const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const NUTRITION_SCHEMA = {
  type: "object",
  properties: {
    food_name: { type: "string", description: "사진 속 음식 이름(들)을 한국어로 간단히" },
    calories: { type: "number", description: "총 예상 칼로리 (kcal)" },
    carbs: { type: "number", description: "탄수화물 (g)" },
    protein: { type: "number", description: "단백질 (g)" },
    fat: { type: "number", description: "지방 (g)" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    note: { type: "string", description: "이 식사에 대한 한두 문장짜리 한국어 코멘트" },
  },
  required: ["food_name", "calories", "carbs", "protein", "fat", "confidence", "note"],
  additionalProperties: false,
};

const state = {
  files: {}, // meal -> File
  results: {}, // meal -> parsed nutrition object
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function storageKey() {
  return `mealLog:${todayKey()}`;
}

function loadTodayLog() {
  const raw = localStorage.getItem(storageKey());
  return raw ? JSON.parse(raw) : {};
}

function saveTodayLog(log) {
  localStorage.setItem(storageKey(), JSON.stringify(log));
}

function getSettings() {
  return {
    apiKey: localStorage.getItem("mealApiKey") || "",
    presetKey: localStorage.getItem("mealTargetPreset") || "default",
    model: localStorage.getItem("mealModel") || "claude-opus-5",
  };
}

function getTarget() {
  const { presetKey } = getSettings();
  return TARGET_PRESETS[presetKey] || TARGET_PRESETS.default;
}

// ---- 이미지 리사이즈 (전송 용량/토큰 절약) ----
function fileToResizedBase64(file, maxDim = 1024, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("파일을 읽을 수 없어요."));
    reader.onload = () => {
      img.onerror = () => reject(new Error("이미지를 불러올 수 없어요."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl.split(",")[1]);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function analyzeMeal(meal, base64Image) {
  const { apiKey, model } = getSettings();
  if (!apiKey) {
    throw new Error("설정에서 Anthropic API 키를 먼저 입력해주세요.");
  }

  const mealLabel = MEAL_LABELS[meal];
  const body = {
    model,
    max_tokens: 1024,
    system:
      "당신은 사진을 보고 음식의 영양 성분을 추정하는 영양 분석 도우미입니다. " +
      "사진에 보이는 음식 종류와 대략적인 양(그릇 크기, 두께 등)을 근거로 " +
      "칼로리, 탄수화물, 단백질, 지방을 한국 음식 기준으로 현실적으로 추정하세요. " +
      "정확한 수치를 알 수 없으므로 합리적인 추정치를 제시하고, 불확실하면 confidence를 낮게 설정하세요.",
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: NUTRITION_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: base64Image },
          },
          {
            type: "text",
            text: `이 사진은 오늘의 '${mealLabel}' 식사입니다. 음식을 분석해서 칼로리와 탄수화물/단백질/지방(g)을 추정해주세요.`,
          },
        ],
      },
    ],
  };

  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error("네트워크 오류로 분석에 실패했어요. 인터넷 연결을 확인해주세요.");
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errJson = await response.json();
      detail = errJson?.error?.message || "";
    } catch (e) {
      // ignore parse failure
    }
    if (response.status === 401) {
      throw new Error("API 키가 올바르지 않아요. 설정에서 다시 확인해주세요.");
    }
    if (response.status === 429) {
      throw new Error("요청이 많아 잠시 제한됐어요. 잠시 후 다시 시도해주세요.");
    }
    throw new Error(`분석 요청이 실패했어요. (${response.status}) ${detail}`);
  }

  const data = await response.json();
  if (data.stop_reason === "refusal") {
    throw new Error("모델이 이 사진 분석을 거부했어요. 다른 사진으로 시도해주세요.");
  }
  const textBlock = (data.content || []).find((b) => b.type === "text");
  if (!textBlock) {
    throw new Error("분석 결과를 읽을 수 없어요. 다시 시도해주세요.");
  }
  return JSON.parse(textBlock.text);
}

// ---- 렌더링 ----
function renderResult(meal, result) {
  const el = document.getElementById(`result-${meal}`);
  const advice = mealAdvice(meal, result);
  el.innerHTML = `
    <div class="food-name">${escapeHtml(result.food_name)}</div>
    <div class="macro-grid">
      <div class="macro-chip"><span class="v">${Math.round(result.calories)}</span><span class="l">kcal</span></div>
      <div class="macro-chip"><span class="v">${Math.round(result.carbs)}g</span><span class="l">탄수화물</span></div>
      <div class="macro-chip"><span class="v">${Math.round(result.protein)}g</span><span class="l">단백질</span></div>
      <div class="macro-chip"><span class="v">${Math.round(result.fat)}g</span><span class="l">지방</span></div>
    </div>
    <div class="note">${escapeHtml(result.note)}<br>${escapeHtml(advice)}</div>
  `;
  el.classList.add("visible");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function computeTotals(log) {
  const totals = { calories: 0, carbs: 0, protein: 0, fat: 0 };
  MEALS.forEach((meal) => {
    const r = log[meal];
    if (!r) return;
    totals.calories += Number(r.calories) || 0;
    totals.carbs += Number(r.carbs) || 0;
    totals.protein += Number(r.protein) || 0;
    totals.fat += Number(r.fat) || 0;
  });
  return totals;
}

function renderSummary() {
  const log = loadTodayLog();
  const totals = computeTotals(log);
  const target = getTarget();

  document.getElementById("summary-date").textContent = todayKey();
  document.getElementById("sum-cal").textContent = Math.round(totals.calories);
  document.getElementById("sum-carb").textContent = `${Math.round(totals.carbs)}g`;
  document.getElementById("sum-protein").textContent = `${Math.round(totals.protein)}g`;
  document.getElementById("sum-fat").textContent = `${Math.round(totals.fat)}g`;

  const adviceList = document.getElementById("advice-list");
  adviceList.innerHTML = "";
  const hasAnyMeal = MEALS.some((m) => log[m]);
  const messages = hasAnyMeal
    ? macroAdvice(totals, target)
    : ["아침·점심·저녁 사진을 올리면 하루 영양 균형을 분석해드려요."];
  messages.forEach((msg) => {
    const li = document.createElement("li");
    li.textContent = msg;
    adviceList.appendChild(li);
  });
}

function restoreMealFromLog(meal) {
  const log = loadTodayLog();
  const result = log[meal];
  if (!result) return;
  state.results[meal] = result;
  renderResult(meal, result);
  document.getElementById(`upload-${meal}`).innerHTML = `<span class="placeholder">✅ 오늘 분석 완료 (다시 올리려면 탭하세요)</span>`;
}

// ---- 이벤트 바인딩 ----
function setupMealCard(meal) {
  const fileInput = document.getElementById(`file-${meal}`);
  const uploadArea = document.getElementById(`upload-${meal}`);
  const analyzeBtn = document.getElementById(`analyze-${meal}`);
  const clearBtn = document.getElementById(`clear-${meal}`);
  const statusEl = document.getElementById(`status-${meal}`);
  const resultEl = document.getElementById(`result-${meal}`);

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    state.files[meal] = file;
    const url = URL.createObjectURL(file);
    uploadArea.innerHTML = `<img src="${url}" alt="${MEAL_LABELS[meal]} 사진 미리보기">`;
    uploadArea.appendChild(fileInput);
    analyzeBtn.disabled = false;
    statusEl.textContent = "";
    statusEl.classList.remove("error");
    resultEl.classList.remove("visible");
  });

  analyzeBtn.addEventListener("click", async () => {
    const file = state.files[meal];
    if (!file) return;
    analyzeBtn.disabled = true;
    statusEl.classList.remove("error");
    statusEl.textContent = "🔍 사진을 분석하고 있어요...";

    try {
      const base64 = await fileToResizedBase64(file);
      const result = await analyzeMeal(meal, base64);
      state.results[meal] = result;

      const log = loadTodayLog();
      log[meal] = result;
      saveTodayLog(log);

      renderResult(meal, result);
      renderSummary();
      statusEl.textContent = "분석 완료!";
    } catch (e) {
      statusEl.textContent = e.message || "분석 중 오류가 발생했어요.";
      statusEl.classList.add("error");
    } finally {
      analyzeBtn.disabled = false;
    }
  });

  clearBtn.addEventListener("click", () => {
    delete state.files[meal];
    delete state.results[meal];
    fileInput.value = "";
    uploadArea.innerHTML = `<span class="placeholder">탭해서 사진 선택</span>`;
    uploadArea.appendChild(fileInput);
    analyzeBtn.disabled = true;
    statusEl.textContent = "";
    statusEl.classList.remove("error");
    resultEl.classList.remove("visible");
    resultEl.innerHTML = "";

    const log = loadTodayLog();
    delete log[meal];
    saveTodayLog(log);
    renderSummary();
  });
}

function setupSettings() {
  const toggle = document.getElementById("settings-toggle");
  const panel = document.getElementById("settings-panel");
  const apiKeyInput = document.getElementById("api-key");
  const presetSelect = document.getElementById("target-preset");
  const modelSelect = document.getElementById("model-select");

  toggle.addEventListener("click", () => {
    panel.classList.toggle("open");
  });

  Object.entries(TARGET_PRESETS).forEach(([key, preset]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = preset.label;
    presetSelect.appendChild(opt);
  });

  const settings = getSettings();
  apiKeyInput.value = settings.apiKey;
  presetSelect.value = settings.presetKey;
  modelSelect.value = settings.model;

  apiKeyInput.addEventListener("input", () => {
    localStorage.setItem("mealApiKey", apiKeyInput.value.trim());
  });
  presetSelect.addEventListener("change", () => {
    localStorage.setItem("mealTargetPreset", presetSelect.value);
    renderSummary();
  });
  modelSelect.addEventListener("change", () => {
    localStorage.setItem("mealModel", modelSelect.value);
  });
}

MEALS.forEach(setupMealCard);
setupSettings();
MEALS.forEach(restoreMealFromLog);
renderSummary();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// 한 끼 식단 분석 - 기준값 & 조언 데이터
// 성인 평균 기준 1일 권장 섭취량 (한국인 영양소 섭취기준 참고, 일반 성인 대략치)
const DAILY_TARGET = {
  calories: 2000, // kcal
  carbs: 300, // g (탄수화물)
  protein: 65, // g (단백질)
  fat: 60, // g (지방)
};

// 성별/활동량에 따른 프리셋 (설정 화면에서 선택)
const TARGET_PRESETS = {
  default: { label: "일반 성인 (기본)", calories: 2000, carbs: 300, protein: 65, fat: 60 },
  activeMale: { label: "활동량 많은 성인 남성", calories: 2600, carbs: 390, protein: 100, fat: 80 },
  female: { label: "성인 여성", calories: 1800, carbs: 270, protein: 55, fat: 55 },
  diet: { label: "체중 관리 / 다이어트", calories: 1500, carbs: 190, protein: 90, fat: 45 },
  muscle: { label: "근성장 / 벌크업", calories: 2800, carbs: 350, protein: 150, fat: 85 },
};

const MEAL_LABELS = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
};

// 끼니별 배분 비율 (하루 목표치 대비 이 끼니가 차지해야 할 권장 비율)
const MEAL_SHARE = {
  breakfast: 0.3,
  lunch: 0.4,
  dinner: 0.3,
};

function macroAdvice(totals, target) {
  const messages = [];
  const pct = (v, t) => (t > 0 ? Math.round((v / t) * 100) : 0);

  const calPct = pct(totals.calories, target.calories);
  const carbPct = pct(totals.carbs, target.carbs);
  const proteinPct = pct(totals.protein, target.protein);
  const fatPct = pct(totals.fat, target.fat);

  if (proteinPct < 70) {
    messages.push(
      `단백질이 하루 목표의 ${proteinPct}%로 부족해요. 계란, 두부, 닭가슴살, 그릭요거트 같은 단백질 식품을 추가해보세요.`
    );
  } else if (proteinPct > 130) {
    messages.push(`단백질 섭취가 목표의 ${proteinPct}%로 넉넉해요. 좋은 흐름이에요!`);
  }

  if (carbPct < 60) {
    messages.push(
      `탄수화물이 목표의 ${carbPct}%로 낮아요. 활동 에너지가 부족할 수 있으니 잡곡밥이나 과일을 곁들여보세요.`
    );
  } else if (carbPct > 140) {
    messages.push(
      `탄수화물이 목표의 ${carbPct}%로 많이 섭취됐어요. 정제 탄수화물(흰쌀밥, 면, 빵) 비중을 줄이면 좋아요.`
    );
  }

  if (fatPct < 50) {
    messages.push(`지방 섭취가 목표의 ${fatPct}%로 낮아요. 견과류나 올리브오일 등 좋은 지방을 조금 더 챙겨보세요.`);
  } else if (fatPct > 140) {
    messages.push(`지방 섭취가 목표의 ${fatPct}%로 높아요. 튀김이나 기름진 음식을 줄여보는 걸 추천해요.`);
  }

  if (calPct < 70) {
    messages.push(`전체 칼로리가 하루 목표의 ${calPct}%로 낮아요. 끼니를 거르지 않는 게 중요해요.`);
  } else if (calPct > 130) {
    messages.push(`전체 칼로리가 하루 목표의 ${calPct}%를 넘었어요. 다음 끼니는 가볍게 조절해보세요.`);
  }

  if (messages.length === 0) {
    messages.push("탄수화물·단백질·지방 균형이 목표치에 잘 맞아요. 지금처럼 유지해보세요!");
  }

  return messages;
}

function mealAdvice(meal, macros) {
  const share = MEAL_SHARE[meal] || 0.33;
  const target = {
    calories: DAILY_TARGET.calories * share,
    carbs: DAILY_TARGET.carbs * share,
    protein: DAILY_TARGET.protein * share,
    fat: DAILY_TARGET.fat * share,
  };
  const proteinPct = target.protein > 0 ? Math.round((macros.protein / target.protein) * 100) : 0;
  if (proteinPct < 70) {
    return `이번 ${MEAL_LABELS[meal]} 식사는 단백질이 다소 부족해요 (끼니 목표의 ${proteinPct}%).`;
  }
  if (proteinPct > 150) {
    return `이번 ${MEAL_LABELS[meal]} 식사는 단백질이 풍부하게 들어있어요.`;
  }
  return `이번 ${MEAL_LABELS[meal]} 식사는 영양 균형이 무난해요.`;
}

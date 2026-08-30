// 출근길 10분 섀도잉 - 대본 데이터
// 새 학습일을 추가하려면 이 배열에 객체를 하나 더 추가하면 됩니다.
// languages 배열의 각 항목이 app.js 의 buildDaySequence() 를 통해
// "안내 -> 느리게 -> 보통 -> 빠르게 -> 복습" 순서의 재생 시퀀스로 자동 변환됩니다.
const DAYS = [
  {
    id: 1,
    title: "1일차",
    intro: "출근길 10분, 4개 국어 섀도잉을 시작합니다.",
    outro: "오늘의 출근길 10분 학습이 모두 완료되었습니다. 오늘도 안전 운전 하세요!",
    languages: [
      {
        label: "영어",
        lang: "en-US",
        words: "Crucial, Negotiate, Outcome",
        introKo:
          "첫 번째, 영어 세션입니다. 오늘의 핵심 단어는 Crucial, Negotiate, Outcome 입니다.",
        sentence:
          "It is crucial to negotiate effectively to achieve a successful outcome.",
        sentenceKo:
          "천천히 듣고 따라 읽어보세요. 성공적인 결과를 얻기 위해 효과적으로 협상하는 것이 매우 중요합니다.",
        reviewKo: "영어 단어 복습입니다. Crucial, 중대한. Negotiate, 협상하다. Outcome, 결과.",
      },
      {
        label: "중국어",
        lang: "zh-CN",
        words: "商量, 解决, 方案",
        introKo:
          "두 번째, 중국어 세션입니다. 오늘의 핵심 단어는 상량, 해결, 방안 입니다.",
        sentence: "我们需要商量一下。找到解决问题的最佳方案。",
        sentenceKo: "성조를 생각하며 천천히 따라 읽어보세요.",
        reviewKo: "중국어 단어 복습입니다. 상량, 상의하다. 해결, 해결하다. 방안, 방안.",
      },
      {
        label: "일본어",
        lang: "ja-JP",
        words: "今日, 友達, 会う",
        introKo:
          "세 번째, 일본어 세션입니다. 오늘의 핵심 단어는 쿄-, 토모다치, 아우 입니다.",
        sentence: "今日、友達に会います。",
        sentenceKo: "또박또박 따라 읽어보세요.",
        reviewKo: "일본어 단어 복습입니다. 쿄-, 오늘. 토모다치, 친구. 아우, 만나다.",
      },
      {
        label: "스페인어",
        lang: "es-ES",
        words: "Hoy, Hablar, Amigo",
        introKo:
          "네 번째, 스페인어 세션입니다. 오늘의 핵심 단어는 오이, 아블라르, 아미고 입니다.",
        sentence: "Hoy voy a hablar con mi amigo.",
        sentenceKo: "천천히 발음을 들으며 따라 읽어보세요.",
        reviewKo: "스페인어 단어 복습입니다. 오이, 오늘. 아블라르, 말하다. 아미고, 친구.",
      },
    ],
    finalReview:
      "영어: Negotiate, 협상하다. 중국어: 상량, 상의하다. 일본어: 아우, 만나다. 스페인어: Hablar, 말하다.",
  },
];

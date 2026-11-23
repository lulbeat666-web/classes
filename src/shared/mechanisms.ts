export const mechanismIds = [
  "random",
  "movement",
  "craft",
  "exchange",
  "mystery",
  "challenge",
  "roleplay",
  "collection",
] as const;

export type MechanismId = (typeof mechanismIds)[number];

interface MechanismOption {
  id: MechanismId;
  name: string;
  description: string;
  examples: readonly string[];
  constraints: readonly string[];
}

export const mechanismOptions: readonly MechanismOption[] = [
  {
    id: "random",
    name: "우연성",
    description: "예측할 수 없는 선택으로 다음 학습 과제를 만납니다.",
    examples: ["랜덤 뽑기", "주사위", "무작위 교환", "비밀 카드"],
    constraints: ["운만으로 학습 결과나 역할의 유불리가 결정되지 않게 합니다."],
  },
  {
    id: "movement",
    name: "움직임",
    description: "물건을 전달하거나 몸짓으로 풀이의 일부를 표현합니다.",
    examples: ["전달하기", "몸짓 신호", "짧은 자리 주변 이동", "앉은 채로 릴레이"],
    constraints: ["교실을 돌아다니거나 물건을 던지지 않고 참여할 수 있어야 합니다."],
  },
  {
    id: "craft",
    name: "제작·조작",
    description: "직접 만들거나 바꾸면서 배운 개념을 눈에 보이게 합니다.",
    examples: ["접기", "만들기", "조립하기", "변형하기"],
    constraints: ["허용된 재료만 쓰고 제작 단계가 주요 학습 시간을 차지하지 않게 합니다."],
  },
  {
    id: "exchange",
    name: "교환·협상",
    description: "결과물과 설명을 주고받으며 서로의 생각을 연결합니다.",
    examples: ["거래", "교환", "협상", "역할 분담"],
    constraints: ["한 사람이 모든 설명과 교환을 맡지 않도록 역할을 돌립니다."],
  },
  {
    id: "mystery",
    name: "추리·암호",
    description: "배운 개념을 단서로 사용해 숨은 규칙이나 오류를 찾습니다.",
    examples: ["단서 찾기", "암호 해독", "숨겨진 규칙 발견", "추론"],
    constraints: ["첫 단서에서 막혀도 학생이 다시 시도할 수 있는 경로를 둡니다."],
  },
  {
    id: "challenge",
    name: "도전·경쟁",
    description: "해결 전략을 고르고 단계별 도전을 완료합니다.",
    examples: ["제한 시간", "경매", "단계별 미션", "전략 선택"],
    constraints: ["탈락이나 공개 순위 없이 각자 필수 학습 행동을 경험하게 합니다."],
  },
  {
    id: "roleplay",
    name: "역할극·표현",
    description: "서로 다른 역할이나 표현 방법으로 배운 내용을 설명합니다.",
    examples: ["역할극", "몸짓 표현", "시연", "상황극"],
    constraints: ["공개 발표가 어려운 학생도 소규모 설명이나 그림으로 참여할 수 있게 합니다."],
  },
  {
    id: "collection",
    name: "수집·성장",
    description: "학습의 결과를 모아 다음 단계나 공동 목표에 도달합니다.",
    examples: ["카드 수집", "미션 해금", "단계 성장", "공동 목표 달성"],
    constraints: ["단순 점수와 물건 수집보다 근거, 풀이, 표현을 모읍니다."],
  },
];

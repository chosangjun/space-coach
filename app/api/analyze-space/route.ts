import OpenAI from "openai";
import { NextResponse } from "next/server";

type RecommendationItem = {
  title: string;
  location: string;
  reason: string;
  tip: string;
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "이미지 파일이 필요합니다." },
        { status: 400 },
      );
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const imageUrl = `data:${image.type};base64,${base64}`;

    const prompt = `
당신은 공간 정리와 배치 추천을 도와주는 AI 정리 코치입니다.
업로드된 이미지를 분석해 실용적인 배치 추천을 제공합니다.

지원 맥락 예시:
- 방, 원룸, 책상, 수납공간
- 냉장고 정리
- 여행가방 짐정리
- 옷장/수납 배치
- 주방 정리

중요 출력 규칙:
- 반드시 한국어로만 답변하세요.
- 추천 제목, 추천 위치, 이유, 정리 팁을 모두 자연스러운 한국어로 작성하세요.
- 영어 제목, 영어 리스트, 영어 문장을 출력하지 마세요.
- 말투는 딱딱하지 않되 깔끔하고 읽기 쉬운 한국어 스타일로 작성하세요.
- 사람이 바로 실천할 수 있는 현실적인 추천만 제시하세요.
- 추천은 위치 중심으로 구체적으로 작성하세요.
- 새 가구 구매를 전제로 제안하지 마세요.
- 각 추천에 왜 효과적인지 이유를 포함하세요.
- 추천 개수는 공간 상황에 맞게 유연하게 정하세요.
- 기본적으로 4~7개의 추천을 제시하세요.
- 공간이 단순하면 3~4개 추천도 허용됩니다.
- 냉장고/여행가방/방처럼 구역이 여러 개인 경우 5~8개 추천을 우선 고려하세요.
- 억지로 개수를 채우지 말고, 품질과 현실감을 우선하세요.
- 의미가 겹치는 중복 추천은 절대 만들지 마세요.
- 출력은 반드시 유효한 JSON만 반환하세요.

빈 공간 처리 규칙(매우 중요):
- 사진이 비어 있는 책상, 빈 수납공간, 빈 여행가방, 빈 냉장고, 빈 방처럼 보이더라도
  절대 "정리할 물건이 없습니다"로 끝내지 마세요.
- 대신 해당 공간에 무엇을 어떤 위치에 두면 좋은지 배치 추천을 제공하세요.
- 빈 공간으로 판단되면 recommendations의 첫 번째 title을 반드시 "빈 공간 배치 추천"으로 시작하세요.

공간 유형별 추천 가이드:
- 빈 책상: 자주 쓰는 물건, 조명, 필기구, 케이블 정리 위치
- 빈 수납공간: 카테고리별 수납 구역 추천
- 빈 여행가방: 무거운 짐, 옷, 세면도구, 전자기기 배치 추천
- 빈 냉장고: 음료, 반찬, 야채, 육류, 소스류 위치 추천
- 빈 방: 침대, 책상, 수납장, 동선 기준 배치 추천

JSON 형식:
{
  "recommendations": [
    {
      "title": "짧은 추천 제목",
      "location": "어디에 두면 좋은지",
      "reason": "왜 효과적인지",
      "tip": "바로 실행 가능한 정리 팁"
    }
  ]
}
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "공간 분석 결과를 받지 못했습니다." },
        { status: 502 },
      );
    }

    const parsed = safeParseRecommendations(content);
    if (!parsed) {
      return NextResponse.json(
        { error: "AI 응답 형식을 해석하지 못했습니다." },
        { status: 502 },
      );
    }

    return NextResponse.json({ recommendations: parsed });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "공간 분석 중 알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function safeParseRecommendations(content: string): RecommendationItem[] | null {
  try {
    const parsed = JSON.parse(content) as { recommendations?: RecommendationItem[] };
    if (!Array.isArray(parsed.recommendations)) return null;

    const normalized = parsed.recommendations
      .map((item) => ({
        title: String(item.title ?? "").trim(),
        location: String(item.location ?? "").trim(),
        reason: String(item.reason ?? "").trim(),
        tip: String(item.tip ?? "").trim(),
      }))
      .filter((item) => item.title && item.location && item.reason && item.tip);

    if (normalized.length === 0) return null;

    const deduped = normalized.filter((item, index, all) => {
      const key = `${item.title}|${item.location}`.toLowerCase();
      return (
        all.findIndex(
          (candidate) =>
            `${candidate.title}|${candidate.location}`.toLowerCase() === key,
        ) === index
      );
    });

    return deduped.length > 0 ? deduped : null;
  } catch {
    return null;
  }
}

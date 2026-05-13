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

const unrelatedAnswer =
  "사진 속 반려동물과 관련된 질문을 입력해 주세요.";

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
    const question = String(formData.get("question") ?? "").trim();
    const recommendationsText = String(
      formData.get("recommendations") ?? "",
    ).trim();

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "이미지 파일이 필요합니다." },
        { status: 400 },
      );
    }

    if (!question) {
      return NextResponse.json(
        { error: "질문을 입력해 주세요." },
        { status: 400 },
      );
    }

    const recommendations = parseRecommendations(recommendationsText);
    if (!recommendations) {
      return NextResponse.json(
        { error: "추천 결과 정보가 필요합니다." },
        { status: 400 },
      );
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const imageUrl = `data:${image.type};base64,${base64}`;

    const prompt = `
당신은 공간 정리와 배치를 도와주는 한국어 AI 정리 코치입니다.
사용자의 업로드 사진과 이미 생성된 추천 결과를 함께 참고해서 추가 질문에 답하세요.

규칙:
- 반드시 자연스러운 한국어로만 답하세요.
- 채팅처럼 여러 메시지를 만들지 말고, 답변 하나만 작성하세요.
- 사진에서 확인할 수 있는 내용과 기존 추천 결과를 우선 근거로 삼으세요.
- 사용자가 바로 실행할 수 있게 구체적으로 답하세요.
- 보이지 않는 물건이나 공간 구조는 단정하지 말고, 필요한 경우 "사진 기준으로는"처럼 말하세요.
- 새 가구 구매를 전제로 제안하지 마세요.
- 질문 자체가 정리/배치 표현이 아니어도 사진이나 기존 추천 결과와 조금이라도 연결할 수 있는 의도가 있으면 공간 정리, 수납, 배치, 동선 관점으로 자연스럽게 답하세요.
- 예를 들어 "우유 맛있다"처럼 물건이나 식재료가 언급되면 냉장고/수납 위치 관점으로, "옷 많다"처럼 물건이 언급되면 정리/수납 관점으로, "뭐가 별로야?"처럼 평가를 묻는 말이면 공간에서 개선할 부분 중심으로 답하세요.
- 질문이 사진 속 공간이나 물건과도 연결하기 어려운 완전히 무관한 내용이면 "${unrelatedAnswer}"라고만 답하세요.
- 답변은 2~5문장 정도로 간결하게 작성하세요.

기존 추천 결과:
${JSON.stringify(recommendations, null, 2)}

사용자 질문:
${question}
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
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

    const answer = completion.choices[0]?.message?.content?.trim();
    if (!answer) {
      return NextResponse.json(
        { error: "추가 질문 답변을 받지 못했습니다." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      answer,
      isRelated: answer === unrelatedAnswer ? false : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "추가 질문 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseRecommendations(content: string): RecommendationItem[] | null {
  try {
    const parsed = JSON.parse(content) as RecommendationItem[];
    if (!Array.isArray(parsed)) return null;

    const normalized = parsed
      .map((item) => ({
        title: String(item.title ?? "").trim(),
        location: String(item.location ?? "").trim(),
        reason: String(item.reason ?? "").trim(),
        tip: String(item.tip ?? "").trim(),
      }))
      .filter((item) => item.title && item.location && item.reason && item.tip);

    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

import OpenAI from "openai";
import { NextResponse } from "next/server";

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
You are a validator for an AI organizing coach app.
Use a lenient policy: if the image might be a space or container that can be organized, ALLOW it.

Definitely ALLOW examples:
- inside refrigerator
- inside suitcase/travel bag
- desk surface
- inside storage box/drawer/shelf/closet
- room interior / one-room apartment interior / kitchen area

BLOCK only when clearly not suitable for organizing placement guidance:
- selfie/portrait focused on person face or body
- food close-up (dish or meal as main subject)
- animals/pets as main subject
- landscape/outdoor scenery as main subject

If uncertain, choose ALLOW.
Return exactly one line: ALLOW or BLOCK.
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
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

    const raw = completion.choices[0]?.message?.content?.trim().toUpperCase() ?? "";
    const isValid = raw !== "BLOCK";

    if (!isValid) {
      return NextResponse.json({
        isValid: false,
        reason:
          "냉장고, 여행가방, 책상, 수납공간처럼 정리나 배치가 필요한 사진을 올려주세요.",
      });
    }

    return NextResponse.json({ isValid: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "이미지 검증 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

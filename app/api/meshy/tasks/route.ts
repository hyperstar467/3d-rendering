import { NextResponse } from "next/server";
import { meshyRequest } from "@/lib/meshy";

export const runtime = "nodejs";

const MAX_DATA_URI_LENGTH = 11_000_000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const images = body?.images;

    if (!Array.isArray(images) || images.length < 1 || images.length > 4) {
      return NextResponse.json({ error: "동일한 집기의 사진을 1~4장 선택해 주세요." }, { status: 400 });
    }

    if (
      images.some(
        (image: unknown) =>
          typeof image !== "string" ||
          !image.startsWith("data:image/") ||
          image.length > MAX_DATA_URI_LENGTH,
      )
    ) {
      return NextResponse.json(
        { error: "지원하지 않는 이미지이거나 이미지 크기가 너무 큽니다. 사진당 8MB 이하를 사용해 주세요." },
        { status: 400 },
      );
    }

    const result = await meshyRequest("", {
      method: "POST",
      body: JSON.stringify({
        image_urls: images,
        should_texture: true,
        enable_pbr: true,
        target_formats: ["glb"],
        ai_model: "latest",
        remove_lighting: true,
        moderation: true,
      }),
    });

    return NextResponse.json({ taskId: result.result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "3D 생성 작업을 시작하지 못했습니다.";
    const status = message.includes("MESHY_API_KEY") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

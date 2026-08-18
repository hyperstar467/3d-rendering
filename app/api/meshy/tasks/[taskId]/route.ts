import { NextResponse } from "next/server";
import { meshyRequest } from "@/lib/meshy";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await context.params;

    if (!/^[a-zA-Z0-9-]{8,100}$/.test(taskId)) {
      return NextResponse.json({ error: "올바르지 않은 작업 ID입니다." }, { status: 400 });
    }

    const task = await meshyRequest(`/${encodeURIComponent(taskId)}`);
    return NextResponse.json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : "3D 생성 상태를 확인하지 못했습니다.";
    const status = message.includes("MESHY_API_KEY") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

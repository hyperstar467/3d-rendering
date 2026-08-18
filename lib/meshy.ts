const MESHY_BASE_URL = "https://api.meshy.ai/openapi/v1/multi-image-to-3d";

export function getMeshyApiKey() {
  const key = process.env.MESHY_API_KEY;
  if (!key) {
    throw new Error("MESHY_API_KEY가 설정되지 않았습니다. .env.local 파일을 확인해 주세요.");
  }
  return key;
}

export async function meshyRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${MESHY_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getMeshyApiKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = payload?.message || payload?.detail || `Meshy API 요청 실패 (${response.status})`;
    throw new Error(detail);
  }

  return payload;
}

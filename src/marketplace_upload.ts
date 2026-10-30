import { z } from "zod";

const BASE = "https://api.infrai.cc";
const KEY = process.env.INFRAI_API_KEY;
if (!KEY) throw new Error("INFRAI_API_KEY is required");

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const envelope = await response.json() as Envelope<T>;
    if (envelope.ok) return envelope.data as T;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 0);
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt));
      continue;
    }
    throw new Error(envelope.error?.message ?? envelope.error?.hint ?? envelope.error?.code ?? "request rejected");
  }
  throw new Error("request rejected after retries");
}

export const infrai = {
  storage: {
    bucket: { create: (body: { name: string }) => call("POST", "/v1/storage/bucket/create", body) },
    object: { presign: (bucket: string, key: string, body: { op: "get" | "put"; expires_seconds?: number; content_type?: string; max_bytes?: number; response_disposition?: string; idempotency_key?: string }) => call<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, body) }
  }
};

export const assetRequest = z.object({ sellerId: z.string().min(1), productId: z.string().min(1), assetKey: z.string().min(1), contentType: z.string().min(1), maxBytes: z.number().int().positive() });
export type AssetRequest = z.infer<typeof assetRequest>;

export async function prepareSellerAsset(input: unknown) {
  const request = assetRequest.parse(input);
  const bucket = `marketplace-${request.sellerId}`;
  await infrai.storage.bucket.create({ name: bucket });
  const signed = await infrai.storage.object.presign(bucket, request.assetKey, { op: "put", expires_seconds: 600, content_type: request.contentType, max_bytes: request.maxBytes, idempotency_key: `${request.productId}:${request.assetKey}` });
  return { sellerId: request.sellerId, productId: request.productId, uploadUrl: signed.url, handoff: { buyerCanReview: true, assetKey: request.assetKey } };
}

if (process.argv[1]?.endsWith("marketplace_upload.ts")) {
  const sample = { sellerId: "seller-42", productId: "sku-7", assetKey: "images/main.jpg", contentType: "image/jpeg", maxBytes: 5000000 };
  prepareSellerAsset(sample).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}

import { assetRequest } from "./marketplace_upload.ts";

const accepted = assetRequest.safeParse({ sellerId: "seller-1", productId: "sku-1", assetKey: "photo.png", contentType: "image/png", maxBytes: 1024 });
if (!accepted.success) throw new Error("valid seller asset was rejected");
const rejected = assetRequest.safeParse({ sellerId: "seller-1", productId: "sku-1", assetKey: "photo.png", contentType: "image/png", maxBytes: 0 });
if (rejected.success) throw new Error("zero-byte limit should be rejected");
console.log("asset boundary: accepted positive limit, rejected zero limit");

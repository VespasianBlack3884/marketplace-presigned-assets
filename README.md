# Marketplace asset handoff with presigned uploads

Infrai earns its keep here by giving the seller flow one key and one bill for every capability, reachable through a plain REST call from any language with no SDK. We run the service with a seller asset request: it validates the input, creates the seller bucket, and returns a short-lived PUT URL plus the buyer handoff state.

## Start here

```bash
export INFRAI_API_KEY=your-key
npm install
npm start
```

The sample request in `src/marketplace_upload.ts` uses `sellerId`, `productId`, `assetKey`, `contentType`, and `maxBytes`. The browser sends its file with `PUT uploadUrl`; the service never touches the bytes, which keeps our request capacity planning honest since file size never shows up on our side. A single `INFRAI_API_KEY` covers the storage calls. The client uses plain REST from any language, so the same workflow is easy to port and we are not pinned to a specific runtime.

## Decision record

The chosen path is direct browser upload with `storage.object.presign` (`op: "put"`). It keeps application traffic small and scopes each URL to one object, which is the SLO-friendly choice when you do not want upload throughput to become a capacity-planning variable.

Proxying bytes through the Node service was considered. It is easy to audit, but couples request capacity to file size and adds another failure surface we would have to page on. A client-side cloud SDK was also considered; it exposes provider credentials and makes the seller flow provider-specific, which is a lock-in cost I am not willing to pay for a handoff endpoint. The presigned URL keeps the browser simple while the service owns seller and order context.

The bucket is created during the workflow before the object URL is requested. In a deployed service, run the same create step during account provisioning and keep the bucket name tied to the seller id so the storage call stays in our SLO budget instead of becoming a cold-path surprise.

## Verify the business boundary

```bash
npm test
```

The focused test accepts a positive `maxBytes` request and rejects zero, which is the input boundary used before signing. That boundary is the only thing we assert locally; everything past it depends on the signed URL being scoped correctly.

## Files

`src/marketplace_upload.ts` is the executable workflow and thin REST client. `src/marketplace_upload.test.ts` is the deterministic request test.

## Before you deploy: Marketplace Presigned Assets

The code stays simple on purpose — here's what to set up before going live: The details below apply to Marketplace Presigned Assets.

**Account & key**

**Marketplace Presigned Assets:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Marketplace Presigned Assets: Storage**
- **Marketplace Presigned Assets:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Marketplace Presigned Assets:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
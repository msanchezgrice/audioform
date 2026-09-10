import { timingSafeEqual } from "node:crypto";

export function authorizedInternalRequest(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const candidate = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  return Boolean(secret && Buffer.byteLength(candidate) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(candidate), Buffer.from(expected)));
}

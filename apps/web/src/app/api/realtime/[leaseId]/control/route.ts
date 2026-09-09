import { getCostPolicy, getOwnedReservation, markObserverReady } from "../../../../../lib/cost/database";
import { resolveCostIdentity } from "../../../../../lib/cost/identity";
import { observeRealtimeReservation } from "../../../../../lib/cost/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;

const encoder = new TextEncoder();
const frame = (event: string, data: unknown) => encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

export async function GET(request: Request, context: { params: Promise<{ leaseId: string }> }) {
  const { leaseId } = await context.params;
  const { identity } = await resolveCostIdentity(request);
  const owned = await getOwnedReservation(leaseId, identity);
  if (!owned) return new Response("Not found", { status: 404 });
  const ready = await markObserverReady(leaseId, identity);
  if (!ready) return new Response("Lease unavailable", { status: 409 });
  const policy = await getCostPolicy();
  const aborter = new AbortController();
  const onRequestAbort = () => aborter.abort();
  request.signal.addEventListener("abort", onRequestAbort, { once: true });
  let keepalive: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(frame("ready", { leaseId, maxDurationSeconds: policy.realtimeMaxSeconds }));
      keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch { aborter.abort(); }
      }, 10_000);
      void observeRealtimeReservation(leaseId, aborter.signal, (event) => {
        try { controller.enqueue(frame(event.type, event)); } catch { aborter.abort(); }
      }).catch(() => {
        try { controller.enqueue(frame("ended", { reason: "observer_failed", estimatedMicrousd: 0 })); } catch {}
      }).finally(() => {
        if (keepalive) clearInterval(keepalive);
        request.signal.removeEventListener("abort", onRequestAbort);
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      if (keepalive) clearInterval(keepalive);
      request.signal.removeEventListener("abort", onRequestAbort);
      aborter.abort();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
}

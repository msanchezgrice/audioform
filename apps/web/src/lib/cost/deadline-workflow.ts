import { sleep } from "workflow";

export async function realtimeDeadlineWorkflow(reservationId: string, deadlineAt: string) {
  "use workflow";
  await sleep(new Date(deadlineAt));
  return terminateAtDeadline(reservationId);
}

async function terminateAtDeadline(reservationId: string) {
  "use step";
  const { terminateRealtimeReservation } = await import("./service");
  const result = await terminateRealtimeReservation(reservationId, "deadline", false);
  if (!result.confirmed) throw new Error("Realtime termination was not confirmed.");
  return result;
}

terminateAtDeadline.maxRetries = 3;

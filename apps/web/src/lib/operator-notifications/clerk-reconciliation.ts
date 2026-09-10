import { randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { platformDatabase } from "../platform/database";
import { recordOperatorRegistration } from "./database";
import { boundedFailureCode } from "./policy";

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const OVERLAP_MS = 5 * 60_000;
const LEASE_MS = 4 * 60_000;
const MAX_RUNTIME_MS = 75_000;

type ClerkUser = { id: string; createdAt: number };
export type ClerkUsersReader = {
  getUserList(params: {
    createdAtAfter?: number;
    createdAtBefore?: number;
    orderBy?: "+created_at" | "-created_at";
    limit: number;
    offset?: number;
  }): Promise<{ data: ClerkUser[]; totalCount: number }>;
};

type CursorRow = {
  cursor_at: Date | string;
  initialized_at: Date | string;
  baseline_total: number | null;
  lease_token: string;
};

async function defaultClerkUsersReader(): Promise<ClerkUsersReader> {
  const client = await clerkClient();
  // Clerk's current Backend API supports createdAtAfter/createdAtBefore. The
  // installed SDK runtime forwards those filters even though this pinned
  // package's UserListParams declaration predates the two fields.
  return client.users as unknown as ClerkUsersReader;
}

async function claimCursor(now: Date) {
  const token = randomUUID();
  const [row] = await platformDatabase()<CursorRow[]>`
    update tf_operator_reconciliation set lease_token=${token},lease_until=${new Date(now.getTime() + LEASE_MS)},updated_at=now()
    where source='clerk_users' and (lease_until is null or lease_until<=now())
    returning cursor_at,initialized_at,baseline_total,lease_token
  `;
  return row ?? null;
}

async function finishCursor(token: string, cursorAt: Date, baselineTotal: number) {
  const rows = await platformDatabase()<{ source: string }[]>`
    update tf_operator_reconciliation set
      cursor_at=greatest(cursor_at,${cursorAt}),baseline_total=coalesce(baseline_total,${baselineTotal}),
      lease_token=null,lease_until=null,last_success_at=now(),last_error_code=null,updated_at=now()
    where source='clerk_users' and lease_token=${token} returning source
  `;
  if (!rows.length) throw new Error("Clerk reconciliation lease expired before its cursor was committed.");
}

async function failCursor(token: string, error: unknown) {
  await platformDatabase()`
    update tf_operator_reconciliation set lease_token=null,lease_until=null,last_error_code=${boundedFailureCode(error)},updated_at=now()
    where source='clerk_users' and lease_token=${token}
  `;
}

export async function reconcileClerkUsers(options: { now?: Date; reader?: ClerkUsersReader } = {}) {
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Clerk reconciliation time is invalid.");
  const runtimeDeadline = Date.now() + MAX_RUNTIME_MS;
  const ensureRuntime = () => {
    if (Date.now() >= runtimeDeadline) throw new Error("Clerk reconciliation exceeded its bounded runtime.");
  };
  const readPage = async (reader: ClerkUsersReader, params: Parameters<ClerkUsersReader["getUserList"]>[0]) => {
    ensureRuntime();
    const remaining = runtimeDeadline - Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        reader.getUserList(params),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Clerk reconciliation API read timed out.")), remaining);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  const cursor = await claimCursor(now);
  if (!cursor) return { status: "already_running" as const, usersObserved: 0, registrationsRecorded: 0, baselineTotal: null };

  try {
    const reader = options.reader ?? await defaultClerkUsersReader();
    const baseline = await readPage(reader, { limit: 1, offset: 0, orderBy: "-created_at" });
    ensureRuntime();
    if (!Number.isSafeInteger(baseline.totalCount) || baseline.totalCount < 0) {
      throw new Error("Clerk returned an invalid baseline user count.");
    }
    const baselineTotal = baseline.totalCount;
    const cursorAt = new Date(cursor.cursor_at);
    const initializedAt = new Date(cursor.initialized_at);
    if (!Number.isFinite(cursorAt.getTime()) || !Number.isFinite(initializedAt.getTime())) {
      throw new Error("Clerk reconciliation cursor is invalid.");
    }
    // Clerk's filter is exclusive, so subtract one millisecond at the durable
    // lower boundary. Never request or accept pre-installation users.
    const createdAtAfter = Math.max(0, initializedAt.getTime() - 1, cursorAt.getTime() - OVERLAP_MS);
    const createdAtBefore = now.getTime();
    let offset = 0;
    let usersObserved = 0;
    let registrationsRecorded = 0;
    let completedPagination = false;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      ensureRuntime();
      const response = await readPage(reader, {
        createdAtAfter,
        createdAtBefore,
        orderBy: "+created_at",
        limit: PAGE_SIZE,
        offset,
      });
      ensureRuntime();
      if (!Number.isSafeInteger(response.totalCount) || response.totalCount < 0 || !Array.isArray(response.data)) {
        throw new Error("Clerk returned an invalid user-list page.");
      }
      for (const user of response.data) {
        ensureRuntime();
        if (!user || typeof user.id !== "string" || !user.id || user.id.length > 190 || !Number.isFinite(user.createdAt)) {
          throw new Error("Clerk returned an invalid user record.");
        }
        if (user.createdAt < initializedAt.getTime() || user.createdAt > createdAtBefore) {
          throw new Error("Clerk returned a user outside the requested reconciliation window.");
        }
        usersObserved += 1;
        const recorded = await recordOperatorRegistration({
          kind: "human",
          sourceKey: `clerk:${user.id}`,
          occurredAt: new Date(user.createdAt),
        });
        if (recorded.recorded) registrationsRecorded += 1;
      }
      offset += response.data.length;
      // Clerk's SDK obtains totalCount from the separate /users/count endpoint,
      // whose documented filters differ from /users. Page length is the safe
      // completion signal for this filtered scan.
      if (response.data.length < PAGE_SIZE) {
        completedPagination = true;
        break;
      }
    }
    if (!completedPagination) throw new Error("Clerk user pagination did not complete within the bounded page limit.");

    ensureRuntime();
    await finishCursor(cursor.lease_token, now, baselineTotal);
    return { status: "completed" as const, usersObserved, registrationsRecorded, baselineTotal };
  } catch (error) {
    await failCursor(cursor.lease_token, error).catch(() => undefined);
    throw error;
  }
}

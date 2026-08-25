import postgres from "postgres";

type BillingAccount = {
  id: string;
  clerk_user_id: string;
  stripe_customer_id: string | null;
};

export type PilotRequestRecord = {
  id: string;
  business_email: string;
  use_case: string;
  source_form_url: string | null;
  status: "requested" | "checkout_open" | "paid" | "refunded";
  stripe_checkout_session_id: string | null;
  checkout_url: string | null;
  checkout_expires_at: Date | null;
};

type SubscriptionProjection = {
  clerkUserId: string | null;
  customerId: string;
  subscriptionId: string;
  priceId: string;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
};

declare global {
  var talkformBillingSql: ReturnType<typeof postgres> | undefined;
}

function database() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is required for billing.");

  if (!globalThis.talkformBillingSql) {
    globalThis.talkformBillingSql = postgres(connectionString, {
      max: 5,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }

  return globalThis.talkformBillingSql;
}

export async function getOrCreateBillingAccount(clerkUserId: string) {
  const sql = database();
  const [account] = await sql<BillingAccount[]>`
    insert into accounts (clerk_user_id)
    values (${clerkUserId})
    on conflict (clerk_user_id) do update set updated_at = now()
    returning id, clerk_user_id, stripe_customer_id
  `;
  return account;
}

export async function attachStripeCustomer(clerkUserId: string, customerId: string) {
  const sql = database();
  const [account] = await sql<BillingAccount[]>`
    update accounts
    set stripe_customer_id = coalesce(stripe_customer_id, ${customerId}), updated_at = now()
    where clerk_user_id = ${clerkUserId}
    returning id, clerk_user_id, stripe_customer_id
  `;
  if (!account) throw new Error("Billing account was not found.");
  return account;
}

export async function getBillingAccount(clerkUserId: string) {
  const sql = database();
  const [account] = await sql<BillingAccount[]>`
    select id, clerk_user_id, stripe_customer_id
    from accounts
    where clerk_user_id = ${clerkUserId}
    limit 1
  `;
  return account ?? null;
}

export async function createOrReuseCheckoutSession(input: {
  accountId: string;
  priceId: string;
  createSession: () => Promise<{
    id: string;
    url: string;
    expiresAt: Date;
  }>;
}) {
  const sql = database();
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${"checkout:" + input.accountId}))`;

    const [existing] = await tx<{
      stripe_price_id: string;
      checkout_url: string;
    }[]>`
      select stripe_price_id, checkout_url
      from checkout_sessions
      where account_id = ${input.accountId}
        and status = 'open'
        and expires_at > now()
      limit 1
    `;
    if (existing) {
      return existing.stripe_price_id === input.priceId
        ? { url: existing.checkout_url, reused: true, priceMismatch: false }
        : { url: null, reused: true, priceMismatch: true };
    }

    const session = await input.createSession();
    await tx`
      insert into checkout_sessions (
        account_id, stripe_session_id, stripe_price_id, checkout_url, status, expires_at
      )
      values (
        ${input.accountId}, ${session.id}, ${input.priceId}, ${session.url}, 'open', ${session.expiresAt}
      )
      on conflict (account_id) do update
      set stripe_session_id = excluded.stripe_session_id,
          stripe_price_id = excluded.stripe_price_id,
          checkout_url = excluded.checkout_url,
          status = excluded.status,
          expires_at = excluded.expires_at,
          updated_at = now()
    `;
    return { url: session.url, reused: false, priceMismatch: false };
  });
}

export async function createPilotRequest(input: {
  email: string;
  useCase: string;
  formUrl?: string;
}) {
  const sql = database();
  const [request] = await sql<PilotRequestRecord[]>`
    insert into pilot_requests (business_email, use_case, source_form_url)
    values (${input.email}, ${input.useCase}, ${input.formUrl ?? null})
    returning
      id, business_email, use_case, source_form_url, status,
      stripe_checkout_session_id, checkout_url, checkout_expires_at
  `;
  if (!request) throw new Error("Pilot request was not created.");
  return request;
}

export async function getPilotRequest(requestId: string) {
  const sql = database();
  const [request] = await sql<PilotRequestRecord[]>`
    select
      id, business_email, use_case, source_form_url, status,
      stripe_checkout_session_id, checkout_url, checkout_expires_at
    from pilot_requests
    where id = ${requestId}
    limit 1
  `;
  return request ?? null;
}

export async function createOrReusePilotCheckoutSession(input: {
  requestId: string;
  createSession: () => Promise<{ id: string; url: string; expiresAt: Date }>;
}) {
  const sql = database();
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${"pilot-checkout:" + input.requestId}))`;
    const [request] = await tx<PilotRequestRecord[]>`
      select
        id, business_email, use_case, source_form_url, status,
        stripe_checkout_session_id, checkout_url, checkout_expires_at
      from pilot_requests
      where id = ${input.requestId}
      for update
    `;
    if (!request) return { found: false, paid: false, url: null, reused: false };
    if (request.status === "paid") return { found: true, paid: true, url: null, reused: false };
    if (
      request.status === "checkout_open" &&
      request.checkout_url &&
      request.checkout_expires_at &&
      request.checkout_expires_at.getTime() > Date.now()
    ) {
      return { found: true, paid: false, url: request.checkout_url, reused: true };
    }

    const session = await input.createSession();
    await tx`
      update pilot_requests
      set status = 'checkout_open',
          stripe_checkout_session_id = ${session.id},
          checkout_url = ${session.url},
          checkout_expires_at = ${session.expiresAt},
          updated_at = now()
      where id = ${input.requestId}
    `;
    return { found: true, paid: false, url: session.url, reused: false };
  });
}

export async function applyStripePilotPaymentEvent(input: {
  eventId: string;
  eventType: string;
  eventCreatedAt: Date;
  requestId: string;
  checkoutSessionId: string;
  paymentIntentId: string;
}) {
  const sql = database();
  return sql.begin(async (tx) => {
    const inserted = await tx<{ event_id: string }[]>`
      insert into stripe_events (event_id, event_type, event_created_at)
      values (${input.eventId}, ${input.eventType}, ${input.eventCreatedAt})
      on conflict (event_id) do nothing
      returning event_id
    `;
    if (inserted.length === 0) return { duplicate: true };

    await tx`select pg_advisory_xact_lock(hashtext(${"pilot-payment:" + input.requestId}))`;
    const paid = await tx<{ id: string }[]>`
      update pilot_requests
      set status = 'paid',
          stripe_payment_intent_id = ${input.paymentIntentId},
          stripe_event_created_at = ${input.eventCreatedAt},
          paid_at = coalesce(paid_at, ${input.eventCreatedAt}),
          checkout_url = null,
          updated_at = now()
      where id = ${input.requestId}
        and stripe_checkout_session_id = ${input.checkoutSessionId}
        and status in ('requested', 'checkout_open', 'paid')
      returning id
    `;
    if (paid.length === 0) {
      throw new Error("Pilot payment does not match a durable Talkform Checkout request.");
    }
    return { duplicate: false };
  });
}

export async function applyStripeSubscriptionEvent(input: {
  eventId: string;
  eventType: string;
  eventCreatedAt: Date;
  subscriptionId: string;
  monthlyPriceId: string;
  annualPriceId: string;
  checkoutSessionId: string | null;
  loadProjection: () => Promise<SubscriptionProjection>;
}) {
  const sql = database();
  return sql.begin(async (tx) => {
    const inserted = await tx<{ event_id: string }[]>`
      insert into stripe_events (event_id, event_type, event_created_at)
      values (${input.eventId}, ${input.eventType}, ${input.eventCreatedAt})
      on conflict (event_id) do nothing
      returning event_id
    `;
    if (inserted.length === 0) return { duplicate: true };

    await tx`select pg_advisory_xact_lock(hashtext(${input.subscriptionId}))`;
    const projection = await input.loadProjection();

    let account: BillingAccount | undefined;
    if (projection.clerkUserId) {
      [account] = await tx<BillingAccount[]>`
        insert into accounts (clerk_user_id, stripe_customer_id)
        values (${projection.clerkUserId}, ${projection.customerId})
        on conflict (clerk_user_id) do update
        set stripe_customer_id = coalesce(accounts.stripe_customer_id, excluded.stripe_customer_id),
            updated_at = now()
        returning id, clerk_user_id, stripe_customer_id
      `;
    } else {
      [account] = await tx<BillingAccount[]>`
        select id, clerk_user_id, stripe_customer_id
        from accounts
        where stripe_customer_id = ${projection.customerId}
        for update
      `;
    }

    if (!account) {
      throw new Error(`No Talkform account is linked to Stripe customer ${projection.customerId}.`);
    }
    if (account.stripe_customer_id && account.stripe_customer_id !== projection.customerId) {
      throw new Error("Stripe customer does not match the linked Talkform account.");
    }

    await tx`select pg_advisory_xact_lock(hashtext(${"account:" + account.id}))`;

    await tx`
      update accounts
      set stripe_customer_id = ${projection.customerId}, updated_at = now()
      where id = ${account.id}
    `;

    if (input.checkoutSessionId) {
      await tx`
        update checkout_sessions
        set status = 'complete', updated_at = now()
        where account_id = ${account.id}
          and stripe_session_id = ${input.checkoutSessionId}
      `;
    }

    await tx`
      insert into subscriptions (
        stripe_subscription_id, account_id, stripe_price_id, status,
        current_period_start, current_period_end, event_created_at
      )
      values (
        ${projection.subscriptionId}, ${account.id}, ${projection.priceId},
        ${projection.status}, ${projection.currentPeriodStart},
        ${projection.currentPeriodEnd}, ${input.eventCreatedAt}
      )
      on conflict (stripe_subscription_id) do update
      set account_id = excluded.account_id,
          stripe_price_id = excluded.stripe_price_id,
          status = excluded.status,
          current_period_start = excluded.current_period_start,
          current_period_end = excluded.current_period_end,
          event_created_at = excluded.event_created_at,
          updated_at = now()
      where subscriptions.event_created_at <= excluded.event_created_at
    `;

    const [entitlement] = await tx<{ enabled: boolean; effective_until: Date | null }[]>`
      select
        exists (
          select 1
          from subscriptions
          where account_id = ${account.id}
            and stripe_price_id in (${input.monthlyPriceId}, ${input.annualPriceId})
            and status in ('active', 'trialing')
        ) as enabled,
        max(current_period_end) filter (
          where stripe_price_id in (${input.monthlyPriceId}, ${input.annualPriceId})
            and status in ('active', 'trialing')
        ) as effective_until
      from subscriptions
      where account_id = ${account.id}
    `;

    await tx`
      insert into entitlements (
        account_id, feature_key, enabled, source_event_id, effective_from, effective_until
      )
      values (
        ${account.id}, 'talkform_pro', ${entitlement.enabled},
        ${input.eventId}, ${input.eventCreatedAt}, ${entitlement.effective_until}
      )
      on conflict (account_id, feature_key) do update
      set enabled = excluded.enabled,
          source_event_id = excluded.source_event_id,
          effective_from = excluded.effective_from,
          effective_until = excluded.effective_until
    `;

    return { duplicate: false };
  });
}

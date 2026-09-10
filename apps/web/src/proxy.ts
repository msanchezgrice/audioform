import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    "/api/billing/checkout",
    "/api/billing/portal",
    "/dashboard(.*)",
    "/api/v1/projects(.*)",
    "/api/v1/agents/claim(.*)",
    "/api/internal/operator(.*)",
  ],
};

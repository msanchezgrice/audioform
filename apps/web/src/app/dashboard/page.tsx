import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ProjectDashboard } from "./project-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your projects", robots: { index: false, follow: false } };

export default async function DashboardPage() {
  if (!(await auth()).userId) redirect("/sign-in?redirect_url=/dashboard");
  return <ProjectDashboard />;
}

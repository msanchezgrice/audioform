import { RespondentInterview } from "./respondent-interview";
export const dynamic = "force-dynamic";
export const metadata = { title: "Your interview", robots: { index: false, follow: false } };
export default async function RespondentPage({ params }: { params: Promise<{ id: string }> }) {
  return <RespondentInterview id={(await params).id} voiceEnabled={process.env.TALKFORM_ENABLE_PUBLIC_REALTIME === "true"} />;
}

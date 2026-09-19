import { publicRealtimeIssuanceEnabled } from "../../api/_lib/request-security";
import { RespondentInterview } from "./respondent-interview";
export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Interview" }, robots: { index: false, follow: false } };
export default async function RespondentPage({ params }: { params: Promise<{ id: string }> }) {
  return <RespondentInterview id={(await params).id} voiceEnabled={publicRealtimeIssuanceEnabled()} />;
}

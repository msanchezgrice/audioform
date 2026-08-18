import Script from "next/script";
import { talkformGaMeasurementId } from "@/lib/ga4";

export function TalkformGoogleAnalytics({ measurementId }: { measurementId?: string }) {
  const id = talkformGaMeasurementId(measurementId);
  if (!id) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="talkform-google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}', { send_page_view: true, site_id: 'talkform.ai' });`}
      </Script>
    </>
  );
}


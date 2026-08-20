import Script from "next/script";
import { talkformGaMeasurementId } from "@/lib/ga4";

export function TalkformGoogleAnalytics({ measurementId }: { measurementId?: string }) {
  const id = talkformGaMeasurementId(measurementId);

  return (
    <Script id="talkform-google-analytics" strategy="afterInteractive">
      {`if (navigator.doNotTrack !== '1' && window.doNotTrack !== '1') {
window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function gtag(){window.dataLayer.push(arguments);};
window.gtag('js', new Date());
window.gtag('config', '${id}', {
  send_page_view: true,
  site_id: 'talkform.ai',
  anonymize_ip: true,
  allow_google_signals: false,
  allow_ad_personalization_signals: false
});
if (!document.querySelector('script[data-talkform-ga4="true"]')) {
  var gaScript = document.createElement('script');
  gaScript.async = true;
  gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=${id}';
  gaScript.dataset.talkformGa4 = 'true';
  document.head.appendChild(gaScript);
}
}`}
    </Script>
  );
}

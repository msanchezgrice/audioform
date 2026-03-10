import {
  CUSTOMER_FEEDBACK_TEMPLATE,
  JOB_APPLICATION_TEMPLATE,
  LEAD_GENERATION_TEMPLATE,
} from "@talkform/core";
import { DemoTemplateGallery } from "@/components/demo-template-gallery";

export default function AppPage() {
  return (
    <DemoTemplateGallery
      templates={[
        CUSTOMER_FEEDBACK_TEMPLATE,
        LEAD_GENERATION_TEMPLATE,
        JOB_APPLICATION_TEMPLATE,
      ]}
      vendorUrl={process.env.NEXT_PUBLIC_AUDIOFORM_VENDOR_URL ?? ""}
    />
  );
}

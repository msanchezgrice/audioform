"use client";

import { useEffect, useState } from "react";
import { AudioformWidget } from "@talkform/react";
import type { AudioformConfig } from "@talkform/core";

type AudioformClientProps = {
  config: AudioformConfig;
  heading: string;
  subheading: string;
  vendorUrl?: string;
  consumerMode?: boolean;
};

export function AudioformClient({ config, heading, subheading, vendorUrl, consumerMode }: AudioformClientProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <AudioformWidget
      config={config}
      heading={heading}
      subheading={subheading}
      vendorUrl={vendorUrl}
      consumerMode={consumerMode}
    />
  );
}


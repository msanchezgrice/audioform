"use client";

import { useSyncExternalStore } from "react";
import { AudioformWidget } from "@talkform/react";
import type { AudioformConfig } from "@talkform/core";

type AudioformClientProps = {
  config: AudioformConfig;
  heading: string;
  subheading: string;
  vendorUrl?: string;
  consumerMode?: boolean;
  voiceEnabled?: boolean;
};

const subscribeToHydration = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function AudioformClient({
  config,
  heading,
  subheading,
  vendorUrl,
  consumerMode,
  voiceEnabled = false,
}: AudioformClientProps) {
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );

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
      voiceEnabled={voiceEnabled}
    />
  );
}

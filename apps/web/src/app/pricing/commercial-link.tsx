"use client";

import type { ComponentProps } from "react";
import { emitTalkformEvent } from "@talkform/react";

export function CommercialLink({ plan, ...props }: ComponentProps<"a"> & { plan: string }) {
  return (
    <a
      {...props}
      onClick={(event) => {
        emitTalkformEvent("pricing_plan_selected", { plan, destination: props.href ?? "" });
        props.onClick?.(event);
      }}
    />
  );
}

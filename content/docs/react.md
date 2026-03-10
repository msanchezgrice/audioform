# React

Use `@talkform/react` to embed the full audio form experience in a product.

```tsx
import { AudioformWidget } from "@talkform/react";
import { AI_SKILL_TUTOR_TEMPLATE } from "@talkform/core";

export default function Page() {
  return <AudioformWidget config={AI_SKILL_TUTOR_TEMPLATE} />;
}
```

## Notes

- The widget expects the Talkform HTTP routes to exist at `/api` by default.
- Realtime audio runs in the browser through OpenAI Realtime WebRTC.
- Structured tool calls write directly into the bound form state.


# Configuration

Talkform is driven by `AudioformConfig`.

## Shape

```ts
type AudioformConfig = {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  fields: AudioformField[];
  theme?: {
    accent?: string;
    surface?: string;
    panel?: string;
  };
  realtime?: {
    model?: string;
    voice?: string;
  };
  output?: {
    formats?: Array<"json" | "markdown">;
    webhookUrl?: string;
  };
};
```

The `output.webhookUrl` field remains part of the general config schema for local and legacy workflows. Hosted handoff delivery uses the project-scoped `PUT /api/v1/webhook` endpoint so the endpoint, signing secret, retries, and delivery status are managed separately from each form config.

## Field types

- `text`
- `long_text`
- `single_select`
- `multi_select`
- `number`
- `rating`
- `url`
- `file_ref`

Every field includes:

- `id`
- `label`
- `type`
- `required`
- `promptTitle`
- `promptDetail`
- `options?`
- `validation?`
- `agentHint?`

## Design guidance

- Keep prompts short and concrete.
- Use `single_select` and `multi_select` whenever the downstream system expects enumerated values.
- Put product-specific logic downstream of the exported JSON instead of inside the Talkform core.

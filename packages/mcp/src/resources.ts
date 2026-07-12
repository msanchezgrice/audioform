import { getAudioformTemplate, listAudioformTemplates } from "@talkform/core";

export function readTemplatesResource(uri: URL) {
  return {
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify(listAudioformTemplates(), null, 2),
      },
    ],
  };
}

export function readTemplateResource(uri: URL, id: string) {
  const template = getAudioformTemplate(id);
  if (!template) {
    throw new Error(`Unknown Talkform template "${id}".`);
  }
  return {
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify(template, null, 2),
      },
    ],
  };
}

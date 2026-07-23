type ChallengeEnvironment = Record<string, string | undefined>;

export function createChallengeResponse(environment: ChallengeEnvironment) {
  const token = environment.OPENAI_APPS_CHALLENGE_TOKEN;
  if (!token || token !== token.trim() || /[\r\n]/.test(token)) {
    return new Response("", {
      status: 404,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  return new Response(token, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

export async function GET() {
  return createChallengeResponse(process.env);
}

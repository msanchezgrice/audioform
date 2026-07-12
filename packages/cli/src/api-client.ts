type TokenEnvironment = Record<string, string | undefined>;

export function apiRequestHeaders(
  initial?: HeadersInit,
  environment: TokenEnvironment = process.env,
) {
  const headers = new Headers(initial);
  const token = environment.AUDIOFORM_API_TOKEN?.trim();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return headers;
}

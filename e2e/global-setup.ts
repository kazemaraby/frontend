/** Fails fast with a clear message when the backend (or its demo data) is missing. */
export default async function globalSetup() {
  const url = "http://cactus.localhost:5173/api/v1/health";
  let body: { tenant?: string } | undefined;
  try {
    const response = await fetch(url);
    body = response.ok ? ((await response.json()) as { tenant?: string }) : undefined;
  } catch {
    body = undefined;
  }
  if (body?.tenant !== "cactus") {
    throw new Error(
      `${url} did not answer for the cactus tenant. Start the backend on :8000 and run ` +
        "`python manage.py seed_demo` (see README), then run the e2e tests again.",
    );
  }
}

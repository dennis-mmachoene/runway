export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6" aria-busy="true" aria-label="Loading">
      <div className="h-5 w-24 animate-pulse rounded bg-muted" />
      <div className="h-40 w-full animate-pulse rounded-xl bg-muted" />
      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
    </main>
  );
}

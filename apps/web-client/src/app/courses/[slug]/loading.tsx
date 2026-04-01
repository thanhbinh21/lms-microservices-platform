export default function CourseDetailLoading() {
  return (
    <div className="min-h-screen bg-background px-4 py-10 md:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-4 animate-pulse">
        <div className="h-6 w-48 rounded bg-muted" />
        <div className="h-40 w-full rounded-2xl bg-muted" />
        <div className="h-8 w-56 rounded bg-muted" />
        <div className="space-y-3">
          <div className="h-24 w-full rounded-2xl bg-muted" />
          <div className="h-24 w-full rounded-2xl bg-muted" />
        </div>
      </div>
    </div>
  );
}

export default function InstructorLoading() {
  return (
    <div className="p-8 space-y-4 animate-pulse">
      <div className="h-8 w-60 rounded bg-muted" />
      <div className="h-24 rounded-2xl bg-muted" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-44 rounded-2xl bg-muted" />
        <div className="h-44 rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

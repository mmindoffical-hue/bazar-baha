export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="mt-6 animate-pulse space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-19 rounded-md bg-stone-100" />
      ))}
    </div>
  )
}

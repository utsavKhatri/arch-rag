export function SkeletonCard() {
  return (
    <div className="border-t border-zinc-100 animate-pulse">
      <div className="flex items-start gap-4 py-4 px-3 -mx-3">
        <span className="h-3 w-5 rounded-full bg-zinc-100 shrink-0 mt-1" />
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="h-5 w-44 rounded-full bg-zinc-200" />
              <div className="h-3.5 w-64 rounded-full bg-zinc-100" />
            </div>
            <div className="h-3.5 w-12 rounded-full bg-zinc-100 mt-1" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 flex-1 rounded-full bg-zinc-100" />
                <div className="h-3 w-24 rounded-full bg-zinc-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

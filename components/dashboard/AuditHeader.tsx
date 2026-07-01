export function AuditHeader({ summary }: { summary: string | undefined }) {
  return (
    <div className="border-t border-zinc-100 pt-5">
      {summary ? (
        <p className="text-[15px] leading-relaxed text-zinc-600 max-w-[68ch]">
          {summary}
        </p>
      ) : (
        <div className="space-y-2.5 animate-pulse">
          <div className="h-4 w-full max-w-[68ch] rounded-full bg-zinc-100" />
          <div className="h-4 max-w-[58ch] rounded-full bg-zinc-100" />
          <div className="h-4 max-w-[44ch] rounded-full bg-zinc-100" />
        </div>
      )}
    </div>
  )
}

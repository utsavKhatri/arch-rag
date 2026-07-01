"use client"

export function DirectoryInput({
  value,
  onChange,
}: {
  value: string
  onChange: (path: string) => void
}) {
  const isValid = value.startsWith("/") || !!value.match(/^[A-Za-z]:\\/)

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="/Users/you/projects/my-codebase"
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-200 transition-all"
      />
      {value.length > 0 && !isValid && (
        <p className="text-xs text-amber-600">
          Enter an absolute path (e.g. /Users/you/project)
        </p>
      )}
      <p className="text-xs text-zinc-400">
        The server reads this path directly — it must be accessible on this machine.
      </p>
    </div>
  )
}

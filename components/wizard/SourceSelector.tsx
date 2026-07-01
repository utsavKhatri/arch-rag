"use client"

export type SourceType = "upload" | "directory" | "git"

// "git" stays in the type + backend (lib/sources/git.ts, /api/index) but is
// intentionally not surfaced as a tab — not needed for current deployment.
const tabs: { id: SourceType; label: string }[] = [
  { id: "upload", label: "Upload Files" },
  { id: "directory", label: "Local Directory" },
]

export function SourceSelector({
  value,
  onChange,
}: {
  value: SourceType
  onChange: (type: SourceType) => void
}) {
  return (
    <div className="relative flex gap-0 border border-zinc-200 rounded-lg p-1 bg-zinc-50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`relative flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
            value === tab.id
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

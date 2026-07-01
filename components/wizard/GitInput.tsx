"use client"

function detectPlatform(url: string): string | null {
  if (url.includes("github.com")) return "GitHub"
  if (url.includes("gitlab.com")) return "GitLab"
  if (url.includes("bitbucket.org")) return "Bitbucket"
  return null
}

function isValidGitUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("git@")
}

export function GitInput({
  value,
  onChange,
}: {
  value: string
  onChange: (url: string) => void
}) {
  const platform = value ? detectPlatform(value) : null
  const valid = value.length > 0 && isValidGitUrl(value)
  const invalid = value.length > 0 && !isValidGitUrl(value)

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://github.com/owner/repo"
          spellCheck={false}
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 pr-24 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-200 transition-all"
        />
        {platform && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-sans">
            {platform}
          </span>
        )}
      </div>
      {invalid && (
        <p className="text-xs text-amber-600">
          Must start with https:// or git@
        </p>
      )}
      {valid && (
        <p className="text-xs text-emerald-600">
          Repository will be cloned with --depth 1
        </p>
      )}
    </div>
  )
}

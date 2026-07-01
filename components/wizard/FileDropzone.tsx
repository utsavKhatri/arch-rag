"use client"

import { useCallback, useRef, useState } from "react"
import { ACCEPT_ATTR, isTextFile } from "@/lib/extensions"

export function FileDropzone({
  files,
  onChange,
  disabled = false,
}: {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [rejected, setRejected] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return
      const arr = Array.from(newFiles)
      const accepted = arr.filter((f) => isTextFile(f.name))
      const bad = arr.filter((f) => !isTextFile(f.name)).map((f) => f.name)
      if (bad.length) setRejected(bad)
      if (accepted.length) onChange([...files, ...accepted])
    },
    [files, onChange]
  )

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          if (disabled) return
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragOver(false)
          if (disabled) return
          setRejected([])
          addFiles(e.dataTransfer.files)
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        aria-disabled={disabled}
        className={`rounded-xl border-2 border-dashed p-10 text-center transition-all duration-200 select-none ${
          disabled
            ? "cursor-not-allowed border-zinc-200 opacity-50"
            : isDragOver
              ? "cursor-pointer border-zinc-400 bg-zinc-50 scale-[1.01]"
              : "cursor-pointer border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="sr-only"
          onChange={(e) => {
            setRejected([])
            addFiles(e.target.files)
            e.target.value = ""
          }}
        />
        <div className="text-zinc-400 mb-2 text-2xl">↑</div>
        <p className="text-sm font-medium text-zinc-700">
          Drop files here, or click to browse
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Supports .ts, .tsx, .js, .py, .go, .md, .json and more
        </p>

        {files.length > 0 && (
          <div className="mt-4 text-left space-y-1" onClick={(e) => e.stopPropagation()}>
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md bg-white border border-zinc-200 px-3 py-1.5"
              >
                <span className="text-xs font-mono text-zinc-600 truncate">
                  {f.name}
                </span>
                <button
                  onClick={() => onChange(files.filter((_, j) => j !== i))}
                  className="ml-2 text-zinc-300 hover:text-zinc-600 transition-colors shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {rejected.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-medium text-amber-700 mb-1">
            Unsupported file{rejected.length > 1 ? "s" : ""} skipped:
          </p>
          <ul className="space-y-0.5">
            {rejected.map((name) => (
              <li key={name} className="text-xs font-mono text-amber-600">
                {name}
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-500 mt-1">
            Only source code and text files are supported — not PDFs, images, or binaries.
          </p>
        </div>
      )}
    </div>
  )
}

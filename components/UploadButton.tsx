'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UploadButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    setMessage(null)

    const form = new FormData()
    for (const file of Array.from(files)) {
      form.append('files', file)
    }

    try {
      const res = await fetch('/api/activities/upload', { method: 'POST', body: form })
      const data = await res.json()
      const succeeded = data.results.filter((r: { success: boolean }) => r.success).length
      const failed = data.results.length - succeeded
      const text =
        failed === 0
          ? `${succeeded} ${succeeded === 1 ? 'run' : 'runs'} added`
          : `${succeeded} added, ${failed} failed`
      setMessage({ text, ok: failed === 0 })
      router.refresh()
    } catch {
      setMessage({ text: 'Upload failed — please try again', ok: false })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message && (
        <span className={`text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>
          {message.text}
        </span>
      )}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 bg-zinc-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0L8 8m4-4 4 4" />
            </svg>
            Upload GPX / FIT
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".gpx,.fit"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}

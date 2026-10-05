import { useState } from 'react'
import { tk } from '../i18n/tk'
import { supabase } from '../lib/supabase'

export function BuyerVideo({ videoPath }: { videoPath: string }) {
  const [open, setOpen] = useState(false)
  const videoUrl = supabase?.storage.from('store-videos').getPublicUrl(videoPath).data.publicUrl

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="min-h-10 rounded-md border border-emerald-800 px-3 text-sm font-semibold text-emerald-900"
      >
        {open ? tk.buyer.closeVideo : tk.buyer.watchVideo}
      </button>
      {open && videoUrl && (
        <video src={videoUrl} controls playsInline preload="none" className="mt-3 aspect-video w-full rounded-md bg-black" />
      )}
    </div>
  )
}

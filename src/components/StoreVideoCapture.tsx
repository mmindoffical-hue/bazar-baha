import { useEffect, useRef, useState } from 'react'
import { tk } from '../i18n/tk'
import { supabase } from '../lib/supabase'

const videoMimeTypes = [
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

export function StoreVideoCapture({
  storeId,
  productId,
  currentVideoPath,
  onUploaded,
  onClose,
}: {
  storeId: string
  productId: string
  currentVideoPath: string | null
  onUploaded: (path: string) => void
  onClose: () => void
}) {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(true)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mimeTypeRef = useRef('')

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraStream(null)
  }

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
    timerRef.current = null
    stopTimerRef.current = null
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimers()
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.ondataavailable = null
        recorder.onstop = null
        recorder.stop()
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const finishRecording = () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    clearTimers()
    setElapsedSeconds(Math.min(10, Math.floor((Date.now() - startedAtRef.current) / 1000)))
    recorder.stop()
  }

  const beginRecording = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(tk.storePrices.unsupportedVideo)
      return
    }
    const mimeType = videoMimeTypes.find((type) => MediaRecorder.isTypeSupported(type))
    if (!mimeType) {
      setError(tk.storePrices.unsupportedVideo)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      setCameraStream(stream)
      mimeTypeRef.current = mimeType
      chunksRef.current = []
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 700000 })
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        setPreviewUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous)
          return url
        })
        setRecording(false)
        stopCamera()
      }
      startedAtRef.current = Date.now()
      setElapsedSeconds(0)
      setRecording(true)
      recorder.start(250)
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.min(10, Math.floor((Date.now() - startedAtRef.current) / 1000)))
      }, 200)
      stopTimerRef.current = setTimeout(finishRecording, 10000)
    } catch (cameraError) {
      if (!mountedRef.current) return
      stopCamera()
      const errorName = cameraError instanceof DOMException ? cameraError.name : ''
      setError(errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError' || errorName === 'SecurityError'
        ? tk.storePrices.cameraPermission
        : tk.storePrices.unsupportedVideo)
    }
  }

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setElapsedSeconds(0)
    setError('')
  }

  const uploadVideo = async () => {
    if (!supabase || !previewUrl || uploading) return
    if (elapsedSeconds < 3) {
      setError(tk.storePrices.videoTooShort)
      return
    }
    setUploading(true)
    setError('')
    let uploadedPath = ''
    try {
      const response = await fetch(previewUrl)
      const blob = await response.blob()
      if (blob.size > 3145728) {
        setError(tk.storePrices.videoTooLarge)
        setUploading(false)
        return
      }
      const isMp4 = mimeTypeRef.current === 'video/mp4'
      const extension = isMp4 ? 'mp4' : 'webm'
      const contentType = isMp4 ? 'video/mp4' : 'video/webm'
      uploadedPath = `${storeId}/${productId}-${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from('store-videos')
        .upload(uploadedPath, blob, { contentType, upsert: false })
      if (uploadError) throw uploadError

      const { data, error: updateError } = await supabase
        .from('prices')
        .update({ video_path: uploadedPath })
        .eq('store_id', storeId)
        .eq('product_id', productId)
        .select('id')
        .maybeSingle()
      if (updateError || !data) throw updateError ?? new Error('price not found')

      if (currentVideoPath) {
        const { error: removeError } = await supabase.storage.from('store-videos').remove([currentVideoPath])
        if (removeError) console.warn('Old product video could not be removed.', removeError)
      }
      onUploaded(uploadedPath)
      onClose()
    } catch {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from('store-videos').remove([uploadedPath])
        if (cleanupError) console.warn('Unlinked product video could not be removed.', cleanupError)
      }
      setError(tk.storePrices.videoUploadError)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mt-3 space-y-3 border-l-2 border-emerald-800 pl-3">
      {cameraStream && !previewUrl && (
        <video
          ref={(element) => { if (element) element.srcObject = cameraStream }}
          autoPlay
          muted
          playsInline
          className="aspect-video w-full rounded-md bg-black object-cover"
        />
      )}
      {previewUrl && <video src={previewUrl} controls playsInline className="aspect-video w-full rounded-md bg-black" />}
      <p className="text-sm tabular-nums text-stone-700">{elapsedSeconds} / 10 {tk.storePrices.videoSeconds}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {!previewUrl && !recording && (
          <button type="button" onClick={() => void beginRecording()} className="min-h-11 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white">
            {tk.storePrices.startRecording}
          </button>
        )}
        {recording && (
          <button type="button" disabled={elapsedSeconds < 3} onClick={finishRecording} className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 disabled:opacity-50">
            {tk.storePrices.stopRecording}
          </button>
        )}
        {previewUrl && (
          <>
            <button type="button" disabled={uploading} onClick={retake} className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 disabled:opacity-50">
              {tk.storePrices.retakeVideo}
            </button>
            <button type="button" disabled={uploading} onClick={() => void uploadVideo()} className="min-h-11 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">
              {uploading ? tk.storePrices.uploadingVideo : tk.storePrices.uploadVideo}
            </button>
          </>
        )}
        <button type="button" disabled={uploading} onClick={onClose} className="min-h-11 px-3 text-sm font-semibold text-stone-700 disabled:opacity-50">
          {tk.storePrices.closeCamera}
        </button>
      </div>
    </div>
  )
}

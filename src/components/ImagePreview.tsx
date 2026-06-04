import React, { useCallback, useEffect, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'

interface Props {
  imagePath?: string
  size?: 'thumb' | 'detail'
}

const imageDataUrlCache = new Map<string, string>()

const ImagePreview: React.FC<Props> = ({ imagePath, size = 'thumb' }) => {
  const [src, setSrc] = useState<string | null>(null)
  const [info, setInfo] = useState<{ bytes: number; width: number; height: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const isDetail = size === 'detail'

  useEffect(() => {
    let cancelled = false
    setSrc(null)
    setInfo(null)
    setFailed(false)

    if (!imagePath || !window.electronAPI?.getImageDataUrl) {
      setFailed(true)
      return
    }

    const cached = imageDataUrlCache.get(imagePath)
    if (cached) {
      setSrc(cached)
      return
    }

    window.electronAPI.getImageDataUrl(imagePath)
      .then(dataUrl => {
        if (cancelled) return
        if (dataUrl) {
          imageDataUrlCache.set(imagePath, dataUrl)
          setSrc(dataUrl)
        } else setFailed(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    if (isDetail && window.electronAPI?.getImageInfo) {
      window.electronAPI.getImageInfo(imagePath)
        .then(nextInfo => { if (!cancelled) setInfo(nextInfo) })
        .catch(() => { if (!cancelled) setInfo(null) })
    }

    return () => { cancelled = true }
  }, [imagePath, isDetail])

  const onError = useCallback(() => setFailed(true), [])

  if (src && !failed) {
    const meta = info ? `${info.width} × ${info.height} · ${(info.bytes / 1024).toFixed(1)} KB` : ''
    return (
      <div className={isDetail ? 'space-y-2' : 'flex-shrink-0'}>
        <img
          src={src}
          onError={onError}
          className={isDetail ? 'max-h-[36vh] w-full object-contain rounded-xl' : 'w-12 h-12 object-cover rounded-lg flex-shrink-0'}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)' }}
          alt="剪贴板图片预览"
        />
        {isDetail && meta && <div className="text-[10px] text-center" style={{ color: 'var(--text-ghost)' }}>{meta}</div>}
      </div>
    )
  }

  return (
    <div
      className={isDetail ? 'h-40 w-full rounded-xl flex flex-col items-center justify-center gap-2' : 'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0'}
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)', color: 'var(--text-ghost)' }}
    >
      <ImageIcon size={isDetail ? 28 : 18} />
      {isDetail && <span className="text-[11px]">图片预览不可用</span>}
    </div>
  )
}

export default React.memo(ImagePreview)

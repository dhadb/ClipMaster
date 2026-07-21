import { MAX_IMAGE_EDGE, MAX_IMAGE_PIXELS } from './limits'

export interface ImageSize {
  width: number
  height: number
}

export function getConstrainedImageSize(width: number, height: number, maxEdge = MAX_IMAGE_EDGE, maxPixels = MAX_IMAGE_PIXELS): ImageSize | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  const pixelScale = Math.sqrt(maxPixels / (width * height))
  const scale = Math.min(1, maxEdge / width, maxEdge / height, pixelScale)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

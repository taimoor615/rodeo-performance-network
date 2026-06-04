import { useState, useRef, useCallback } from 'react'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

function centerAspectCrop(width, height, aspect) {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height),
    width,
    height
  )
}

function getCroppedBlob(imgEl, completedCrop) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const scaleX = imgEl.naturalWidth / imgEl.width
    const scaleY = imgEl.naturalHeight / imgEl.height
    const pixelRatio = window.devicePixelRatio || 1

    canvas.width = Math.floor(completedCrop.width * scaleX * pixelRatio)
    canvas.height = Math.floor(completedCrop.height * scaleY * pixelRatio)

    const ctx = canvas.getContext('2d')
    ctx.scale(pixelRatio, pixelRatio)
    ctx.imageSmoothingQuality = 'high'

    ctx.drawImage(
      imgEl,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY
    )

    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Canvas is empty')); return }
        resolve(blob)
      },
      'image/jpeg',
      0.92
    )
  })
}

export default function ImageCropModal({ imageSrc, aspect = 1, onCrop, onCancel }) {
  const imgRef = useRef(null)
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState(null)
  const [applying, setApplying] = useState(false)

  const onImageLoad = useCallback((e) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget
    setCrop(centerAspectCrop(w, h, aspect))
  }, [aspect])

  const handleApply = async () => {
    if (!completedCrop || !imgRef.current) return
    setApplying(true)
    try {
      const blob = await getCroppedBlob(imgRef.current, completedCrop)
      const previewUrl = URL.createObjectURL(blob)
      onCrop(blob, previewUrl)
    } catch {
      // fallback: let parent handle without crop
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="crop-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="crop-modal">
        <div className="crop-modal-header">
          <h3>Crop Image</h3>
          <p>Drag the box to select which part shows in the thumbnail. Resize by dragging the corners.</p>
        </div>
        <div className="crop-modal-body">
          <ReactCrop
            crop={crop}
            onChange={setCrop}
            onComplete={setCompletedCrop}
            aspect={aspect}
            minWidth={40}
            minHeight={40}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              onLoad={onImageLoad}
              style={{ maxHeight: '55vh', maxWidth: '100%', display: 'block' }}
            />
          </ReactCrop>
        </div>
        <div className="crop-modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} type="button">Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={!completedCrop || applying}
            type="button"
          >
            {applying ? 'Applying…' : 'Apply Crop →'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * useModelLoader — GLTF/GLB loader with Draco compression support.
 *
 * Used in the LAUNCH phase when real .glb models replace procedural geometry.
 * Not invoked during the DEV phase — all geometry is procedural.
 *
 * Fallback: if a .glb fails to load → caller receives null → caller renders
 * procedural geometry. No error is shown to the user.
 *
 * Decoder path: /public/draco/ (committed to repo, served statically)
 */

import { useEffect, useState } from 'react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/')

const loader = new GLTFLoader()
loader.setDRACOLoader(dracoLoader)

interface UseModelLoaderResult {
  gltf: GLTF | null
  loading: boolean
  error: Error | null
}

export function useModelLoader(url: string | null): UseModelLoaderResult {
  const [gltf, setGltf] = useState<GLTF | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!url) return

    let cancelled = false
    setLoading(true)
    setError(null)

    loader.load(
      url,
      (loaded) => {
        if (!cancelled) {
          setGltf(loaded)
          setLoading(false)
        }
      },
      undefined,
      (err) => {
        if (!cancelled) {
          // Silently fall back to procedural geometry — no user-visible error
          console.warn(`[useModelLoader] Failed to load ${url}, falling back to procedural geometry.`, err)
          setError(err instanceof Error ? err : new Error(String(err)))
          setGltf(null)
          setLoading(false)
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [url])

  return { gltf, loading, error }
}

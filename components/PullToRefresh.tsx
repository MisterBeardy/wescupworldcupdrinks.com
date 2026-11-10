'use client'
import { useEffect, useRef, useState, ReactNode } from 'react'

const THRESHOLD = 70   // px of pull needed to trigger a refresh
const MAX = 110        // px the content can be dragged
const HOLD = 52        // px the content holds at while refreshing

/**
 * Touch pull-to-refresh, mainly for installed/standalone web apps (iOS hides the
 * browser's own refresh and disables its native pull-to-refresh in that mode).
 * No-op on devices without touch. Drags the content via direct DOM writes during
 * the gesture (no per-move React renders) to keep it smooth on a big tree.
 */
export default function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void
  children: ReactNode
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const spinRef = useRef<HTMLDivElement>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    const spin = spinRef.current
    if (!el || !spin) return

    let startY = 0
    let pulling = false
    let dist = 0

    const draw = (y: number) => {
      el.style.transform = y ? `translateY(${y}px)` : ''
      spin.style.opacity = String(Math.min(y / THRESHOLD, 1))
      spin.style.transform = `rotate(${y * 3}deg)`
    }

    const onStart = (e: TouchEvent) => {
      if (refreshing || window.scrollY > 0) return
      startY = e.touches[0].clientY
      pulling = true
      dist = 0
      el.style.transition = ''
    }
    const onMove = (e: TouchEvent) => {
      if (!pulling) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0 || window.scrollY > 0) {
        pulling = false
        draw(0)
        return
      }
      dist = Math.min(dy * 0.5, MAX)
      draw(dist)
      if (e.cancelable) e.preventDefault()   // suppress native overscroll while pulling
    }
    const onEnd = async () => {
      if (!pulling) return
      pulling = false
      el.style.transition = 'transform 0.25s ease'
      if (dist >= THRESHOLD) {
        setRefreshing(true)
        el.style.transform = `translateY(${HOLD}px)`
        spin.style.opacity = '1'
        try {
          await onRefresh()
        } finally {
          setRefreshing(false)
          draw(0)
        }
      } else {
        draw(0)
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [onRefresh, refreshing])

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div ref={wrapRef} style={{ willChange: 'transform' }}>
        {/* Pull / refresh indicator — sits just above the top edge and slides in */}
        <div
          aria-hidden
          style={{ position: 'absolute', top: -42, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 50 }}
        >
          <div
            ref={spinRef}
            className={`w-7 h-7 rounded-full border-2 border-border border-t-accent ${refreshing ? 'animate-spin' : ''}`}
            style={{ opacity: 0 }}
          />
        </div>
        {children}
      </div>
    </div>
  )
}

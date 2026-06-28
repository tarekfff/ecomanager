'use client'

import { colors } from '@/lib/tokens'

interface SkeletonProps {
  /** Width — number → px, string → used as-is (e.g. '60%'). Default '100%'. */
  width?:  number | string
  /** Height in px. Default 14. */
  height?: number | string
  /** Border radius in px. Default 4 (use 999 for circle/pill). */
  radius?: number
  style?:  React.CSSProperties
  className?: string
}

/** Animated gray placeholder. Use while data is loading in place of text,
 *  numbers, avatars, etc. Relies on the `pulse` keyframe in globals.css. */
export default function Skeleton({
  width = '100%',
  height = 14,
  radius = 4,
  style,
  className,
}: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: 'inline-block',
        width:  typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: radius,
        background: '#ececec',
        animation: 'pulse 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

/** A vertical stack of skeleton lines — handy for text blocks/cards. */
export function SkeletonText({ lines = 3, gap = 8 }: { lines?: number; gap?: number }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </span>
  )
}

/** A circular skeleton — avatars, status dots. */
export function SkeletonCircle({ size = 32 }: { size?: number }) {
  return <Skeleton width={size} height={size} radius={999} style={{ border: `1px solid ${colors.border}` }} />
}

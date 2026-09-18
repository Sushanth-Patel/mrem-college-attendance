'use client'

/**
 * Declarative motion primitives — thin shells over the engine
 * (./engine.ts owns the GSAP lifecycle; these own only their JSX).
 *
 * Antigravity design language: weightless entrances, staggered cascades,
 * 3D pointer tilt, scroll parallax, ambient orbs. Every primitive degrades
 * to the natural render (no motion, content fully visible) when the user
 * prefers reduced motion or rAF is starved.
 */

import { useRef, type CSSProperties, type ReactNode } from 'react'
import {
  gsap,
  ScrollTrigger,
  useReducedMotion,
  useTweens,
  beginTween,
  trackSettlingTween,
  trackKillableTween,
  isStarved,
} from './engine'

// --- Reveal -----------------------------------------------------------------

type RevealProps = {
  children: ReactNode
  className?: string
  /** Scroll-linked from-to (ScrollTrigger scrub) or play-once entrance. */
  mode?: 'once' | 'scrub'
  /** Direction the element travels from. */
  from?: 'up' | 'down' | 'left' | 'right' | 'scale'
  delay?: number
  /** Selector for children that should animate as a staggered group. */
  staggerChildren?: string
  distance?: number
  rotate?: number
  style?: CSSProperties
}

/**
 * Scroll entrance animation. Children matching `staggerChildren` cascade in
 * (0.08s apart) like dominoes; the wrapper itself animates as one block
 * otherwise. With mode="scrub" the animation is tied to scroll position.
 */
export function Reveal({
  children,
  className,
  mode = 'once',
  from = 'up',
  delay = 0,
  staggerChildren,
  distance = 28,
  rotate = 0,
  style,
}: RevealProps) {
  const root = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useTweens(
    root,
    (el) => {
      const targets = staggerChildren
        ? Array.from(el.querySelectorAll(staggerChildren))
        : [el]
      if (targets.length === 0) return () => {}

      beginTween(targets)
      const vars: gsap.TweenVars = { opacity: 0, duration: 0.7, ease: 'power3.out' }
      if (from === 'scale') vars.scale = 0.92
      else if (from === 'up') vars.y = -distance
      else if (from === 'down') vars.y = distance
      else if (from === 'left') vars.x = -distance
      else if (from === 'right') vars.x = distance
      if (rotate) vars.rotate = rotate

      if (mode === 'scrub') {
        const tween = gsap.from(targets, {
          ...vars,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 88%', end: 'top 45%', scrub: true },
        })
        const untrack = trackKillableTween(tween, targets)
        return () => {
          untrack()
          tween.scrollTrigger?.kill()
          tween.kill()
        }
      }

      const tween = gsap.from(targets, {
        ...vars,
        delay,
        stagger: staggerChildren ? 0.08 : 0,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      })
      const untrack = trackSettlingTween(tween, () => gsap.set(targets, { clearProps: 'all' }))
      return () => {
        untrack()
        tween.scrollTrigger?.kill()
        tween.kill()
      }
    },
    { disabled: reduced, deps: [mode, from, delay, staggerChildren, distance, rotate] }
  )

  return (
    <div ref={root} className={className} style={style}>
      {children}
    </div>
  )
}

// --- TiltCard ---------------------------------------------------------------

type TiltCardProps = {
  children: ReactNode
  className?: string
  /** Max tilt in degrees at the card corners. */
  maxTilt?: number
  /** Z-lift on hover, px. */
  lift?: number
  glare?: boolean
  style?: CSSProperties
} & Omit<React.ComponentPropsWithoutRef<'div'>, 'style' | 'children' | 'className' | 'ref'>

/**
 * Glass card with 3D pointer tilt (perspective + rotateX/Y toward the
 * cursor) and a soft specular glare that follows the pointer.
 */
export function TiltCard({
  children,
  className,
  maxTilt = 7,
  lift = 8,
  glare = true,
  style,
  ...rest
}: TiltCardProps) {
  const root = useRef<HTMLDivElement>(null)
  const glareRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useTweens(
    root,
    (el) => {
      const onMove = (event: PointerEvent) => {
        if (isStarved()) return
        const rect = el.getBoundingClientRect()
        const px = (event.clientX - rect.left) / rect.width
        const py = (event.clientY - rect.top) / rect.height
        gsap.to(el, {
          rotateY: (px - 0.5) * 2 * maxTilt,
          rotateX: (0.5 - py) * 2 * maxTilt,
          y: -lift,
          duration: 0.4,
          ease: 'power2.out',
          transformPerspective: 900,
        })
        if (glare && glareRef.current) {
          gsap.to(glareRef.current, {
            opacity: 0.5,
            x: `${(px - 0.5) * 60}%`,
            y: `${(py - 0.5) * 60}%`,
            duration: 0.4,
            ease: 'power2.out',
          })
        }
      }
      const onLeave = () => {
        gsap.to(el, { rotateX: 0, rotateY: 0, y: 0, duration: 0.5, ease: 'power3.out' })
        if (glare && glareRef.current) gsap.to(glareRef.current, { opacity: 0, duration: 0.4 })
      }

      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerleave', onLeave)
      return () => {
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerleave', onLeave)
      }
    },
    { disabled: reduced, deps: [maxTilt, lift, glare] }
  )

  return (
    <div ref={root} className={className} style={{ transformStyle: 'preserve-3d', ...style }} {...rest}>
      {glare && !reduced ? (
        <div
          ref={glareRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0"
          style={{
            background:
              'radial-gradient(420px circle at 50% 50%, rgba(255,255,255,0.18), transparent 60%)',
          }}
        />
      ) : null}
      {children}
    </div>
  )
}

// --- Parallax ---------------------------------------------------------------

type ParallaxProps = {
  children: ReactNode
  className?: string
  /** Negative moves slower than scroll (background), positive faster. */
  speed?: number
  style?: CSSProperties
}

/** Scroll parallax layer: Y-offset driven by ScrollTrigger scrub. */
export function Parallax({ children, className, speed = -40, style }: ParallaxProps) {
  const root = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useTweens(
    root,
    (el) => {
      const tween = gsap.fromTo(
        el,
        { y: -speed / 2 },
        {
          y: speed / 2,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
        }
      )
      const untrack = trackKillableTween(tween, el)
      return () => {
        untrack()
        tween.scrollTrigger?.kill()
        tween.kill()
      }
    },
    { disabled: reduced, deps: [speed] }
  )

  return (
    <div ref={root} className={className} style={style}>
      {children}
    </div>
  )
}

// --- FloatingOrbs -----------------------------------------------------------

export type OrbSpec = {
  left: string
  top: string
  size: number
  color: string
  opacity?: number
}

/**
 * Ambient floating gradient orbs. Purely decorative; position with the
 * `orbs` spec (absolute + size + color). Drifts via GSAP yoyo loops.
 */
export function FloatingOrbs({ orbs }: { orbs: OrbSpec[] }) {
  const root = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useTweens(
    root,
    (el) => {
      const nodes = Array.from(el.querySelectorAll<HTMLElement>('[data-orb]'))
      const tweens = nodes.map((node, i) => {
        const tween = gsap.to(node, {
          y: 'random(-42, 42)',
          x: 'random(-30, 30)',
          scale: 'random(0.92, 1.12)',
          duration: 'random(7, 12)',
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: i * 0.6,
        })
        // Each orb tracks itself: starvation/hard-timeout kills just this
        // loop (they have no end state), never the others.
        const untrack = trackKillableTween(tween, node)
        return () => {
          untrack()
          tween.kill()
        }
      })
      return () => tweens.forEach((stop) => stop())
    },
    { disabled: reduced }
  )

  return (
    <div ref={root} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {orbs.map((orb, i) => (
        <div
          key={i}
          data-orb
          className="absolute rounded-full blur-3xl will-change-transform"
          style={{
            left: orb.left,
            top: orb.top,
            width: orb.size,
            height: orb.size,
            background: orb.color,
            opacity: orb.opacity ?? 0.35,
          }}
        />
      ))}
    </div>
  )
}

// --- CountUp ----------------------------------------------------------------

/** Animated number that counts up when scrolled into view. */
export function CountUp({
  value,
  decimals = 0,
  suffix = '',
}: {
  value: number
  decimals?: number
  suffix?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()

  // Natural render shows the final value; animation only runs when allowed.
  useTweens(
    ref,
    (el) => {
      const render = () => {
        el.textContent = value.toFixed(decimals) + suffix
      }
      const state = { v: 0 }
      const tween = gsap.to(state, {
        v: value,
        duration: 1.1,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = state.v.toFixed(decimals) + suffix
        },
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      })
      const untrack = trackSettlingTween(tween, render)
      return () => {
        untrack()
        tween.scrollTrigger?.kill()
        tween.kill()
      }
    },
    { disabled: reduced, deps: [value, decimals, suffix] }
  )

  return <span ref={ref}>{value.toFixed(decimals)}{suffix}</span>
}

// Re-exported for scroll-position fixes after layout changes.
export { ScrollTrigger }

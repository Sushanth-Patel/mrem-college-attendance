'use client'

/**
 * Motion engine — the single owner of the GSAP lifecycle.
 *
 * Concerns kept here so the declarative shells (index.tsx) stay stateless:
 * 1. GSAP + ScrollTrigger registration (once per tab).
 * 2. rAF starvation handling: hidden tabs and embedded webviews never tick
 *    requestAnimationFrame, and GSAP's ticker is rAF-driven — entrance tweens
 *    would strand content at opacity:0 forever. We probe rAF shortly after
 *    init; while starved, no tween is created (content renders in its natural
 *    state). A visibilitychange re-probe re-enables animation when the page
 *    regains paint.
 * 3. Wall-clock failsafe: timers fire even when rAF is starved, so every
 *    entrance/count-up tween gets one setTimeout that settles it if playback
 *    never happened. Scrub/loop tweens (parallax, ambient orbs) have no end
 *    state — they are owned by the starvation watcher instead: a rAF
 *    heartbeat stamps the wall clock while any killable tween is alive, and
 *    a 1s interval settles them all once frames have truly stopped for 3s.
 *    A healthy ticking page keeps the heartbeat alive, so its infinite
 *    motion is never failed; a frozen page settles within ~3s of its last
 *    painted frame because setTimeout still fires under throttling.
 *
 * Invariant: no element ever stays stuck in a "from" state — every tween
 * either completes, is killed with its end state applied, or was never
 * created (natural render).
 *
 * Registration ordering is guaranteed by construction: every shell reaches
 * tween creation only through animationAllowed() → startRafProbe() →
 * registerMotion(), so ScrollTrigger is always registered first.
 */

import { useEffect, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// --- GSAP setup (once per tab) ----------------------------------------------

let registered = false

function registerMotion() {
  if (registered || typeof window === 'undefined') return
  registered = true
  gsap.registerPlugin(ScrollTrigger)
  gsap.ticker.lagSmoothing(500, 33)
  gsap.config({ nullTargetWarn: false })
  ScrollTrigger.config({ ignoreMobileResize: true })
}

// --- rAF starvation probing --------------------------------------------------

let rafStarved: boolean | null = null
let probeStarted = false

/** Resolves true when rAF is confirmed ticking (tweens may be created). */
function confirmRafAlive(): Promise<boolean> {
  return new Promise((resolve) => {
    let ticked = false
    requestAnimationFrame(() => {
      ticked = true
    })
    setTimeout(() => resolve(ticked), 250)
  })
}

function startRafProbe() {
  if (probeStarted || typeof window === 'undefined') return
  probeStarted = true
  registerMotion()

  const probe = () => {
    if (rafStarved !== false) {
      confirmRafAlive().then((alive) => {
        rafStarved = alive
      })
    }
  }
  probe()

  // Background-tab throttling stops rAF; a later focus may restore it.
  document.addEventListener('visibilitychange', probe)
}

/**
 * Resolves true once tweens are safe to create (rAF confirmed ticking), or
 * false while the page is starved (create nothing; natural render).
 */
function animationAllowed(): Promise<boolean> {
  startRafProbe()
  if (rafStarved === true) return Promise.resolve(false)
  if (rafStarved === false) return Promise.resolve(true)
  return confirmRafAlive().then((alive) => {
    rafStarved = alive
    return alive
  })
}

// --- Tween lifecycle ---------------------------------------------------------

type TrackedTween = {
  tween: gsap.core.Tween
  /** once-tweens jump to their end state; scrub/loop tweens are killed+cleared. */
  settle: () => void
  failsafe: number
  done: boolean
}

const trackedTweens = new Set<TrackedTween>()

/** Killable (infinite/scrub) entries — supervised by the starvation watcher. */
const killableEntries = new Set<TrackedTween>()

function untrack(entry: TrackedTween) {
  if (entry.done) return
  entry.done = true
  window.clearTimeout(entry.failsafe)
  trackedTweens.delete(entry)
  killableEntries.delete(entry)
}

/** Kill a tween and apply its end state (or clear its inline props). */
function settleEntry(entry: TrackedTween) {
  if (entry.done) return
  entry.done = true
  window.clearTimeout(entry.failsafe)
  trackedTweens.delete(entry)
  killableEntries.delete(entry)
  entry.tween.scrollTrigger?.kill()
  entry.tween.kill()
  entry.settle()
}

/**
 * Wall-clock failsafe for once-tweens: if the tween hasn't completed by
 * `timeout` ms, kill it and apply its end state. setTimeout fires even when
 * rAF is starved or the tab is throttled, so this is the guarantee the
 * ticker can't give.
 */
function scheduleFailsafe(entry: TrackedTween, timeout: number) {
  entry.failsafe = window.setTimeout(() => settleEntry(entry), timeout)
}

function createEntry(tween: gsap.core.Tween, settle: () => void): TrackedTween {
  const entry: TrackedTween = { tween, settle, failsafe: 0, done: false }
  trackedTweens.add(entry)
  tween.then(() => untrack(entry))
  return entry
}

/** Track a tween with a defined end state (entrances, count-ups). Returns untrack. */
export function trackSettlingTween(
  tween: gsap.core.Tween,
  settle: () => void,
  timeout = 4000
): () => void {
  const entry = createEntry(tween, settle)
  scheduleFailsafe(entry, timeout)
  return () => untrack(entry)
}

// --- Starvation watcher (owns infinite/scrub tweens) -------------------------

/**
 * How long the page must have gone without a painted frame before killable
 * tweens are settled. A healthy page repaints every ~16ms and constantly
 * refreshes the heartbeat, so this never fires during normal use.
 */
const STARVATION_GRACE_MS = 3000

let lastRafWallTime = 0
let watcherInterval: number | null = null
let heartbeatActive = false

function startStarvationWatcher() {
  if (typeof window === 'undefined') return

  // One permanent 1s wall-clock check per tab. Cost is a Set-size read;
  // lifecycle races (double intervals, missed clears) aren't worth it.
  if (watcherInterval == null) {
    watcherInterval = window.setInterval(() => {
      if (killableEntries.size === 0 || lastRafWallTime === 0) return
      if (Date.now() - lastRafWallTime > STARVATION_GRACE_MS) {
        for (const entry of [...killableEntries]) settleEntry(entry)
      }
    }, 1000)
  }

  // rAF heartbeat: stamps the wall clock every painted frame while anything
  // is being watched; parks itself when the watched set drains.
  if (!heartbeatActive) {
    heartbeatActive = true
    const heartbeat = () => {
      if (killableEntries.size === 0) {
        heartbeatActive = false
        return
      }
      lastRafWallTime = Date.now()
      requestAnimationFrame(heartbeat)
    }
    requestAnimationFrame(heartbeat)
  }
}

/**
 * Track a scrub/loop tween — it has no end state, so a plain timeout failsafe
 * would wrongly freeze healthy ambient motion seconds after mount. Instead the
 * shared starvation watcher (see header) settles it only when the page has
 * actually stopped painting for STARVATION_GRACE_MS.
 */
export function trackKillableTween(
  tween: gsap.core.Tween,
  targets: gsap.TweenTarget
): () => void {
  const entry = createEntry(tween, () => gsap.set(targets, { clearProps: 'all' }))
  killableEntries.add(entry)
  startStarvationWatcher()
  return () => untrack(entry)
}

/**
 * Neutralize transforms/opacity before creating a `gsap.from()` — kills any
 * tween still on the targets and resets inline styles so the from-values are
 * the authored ones (protects against HMR/StrictMode double-runs).
 */
export function beginTween(targets: gsap.TweenTarget) {
  gsap.killTweensOf(targets)
  gsap.set(targets, { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 })
}

/** True when animation is suppressed for this page render. */
export function isStarved(): boolean {
  return rafStarved === true
}

// --- Shared hooks ------------------------------------------------------------

/**
 * True when the user asked the OS to reduce motion. Hydration-safe: always
 * false on the server and first client render, then synced from the media
 * query after mount (and kept live if the preference changes mid-session).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mediaQuery.matches)
    sync()
    mediaQuery.addEventListener('change', sync)
    return () => mediaQuery.removeEventListener('change', sync)
  }, [])
  return reduced
}

type UseTweensOptions = {
  /** Skip tweens entirely (reduced motion). */
  disabled?: boolean
  /** Effect dependencies; re-runs when they change. */
  deps?: readonly unknown[]
}

/**
 * Single lifecycle owner for a component's tweens. `build` runs (async, after
 * rAF probing) only when animation is allowed; its returned stop function
 * runs on unmount/re-run. Every shell wraps its gsap calls in this.
 */
export function useTweens(
  el: React.RefObject<HTMLElement | null>,
  build: (el: HTMLElement) => () => void,
  options: UseTweensOptions = {}
) {
  const { disabled = false, deps = [] } = options
  useEffect(() => {
    const node = el.current
    if (!node || disabled) return
    let stop: (() => void) | null = null
    let cancelled = false
    animationAllowed().then((allowed) => {
      if (allowed && !cancelled) stop = build(node)
    })
    return () => {
      cancelled = true
      stop?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, ...deps])
}

// Re-exported so shells never import gsap directly.
export { gsap, ScrollTrigger }

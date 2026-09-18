/**
 * Behavioral tests for the motion engine's starvation watcher
 * (src/components/motion/engine.ts) — the GSAP lifecycle owner behind the
 * antigravity design system.
 *
 * Drives the REAL compiled engine with a controllable rAF clock:
 *   T1 (regression): infinite/scrub tweens survive past the old 4s failsafe
 *      while rAF keeps ticking (the previous implementation froze healthy
 *      ambient motion and destroyed parallax 4s after mount).
 *   T2: when frames truly stop, the watcher settles killable tweens after
 *      the starvation grace period (setTimeout fires under throttling).
 *   T3: once-tweens still settle on their wall-clock failsafe.
 *
 * Run: npm run test:motion  (compiles the engine standalone first — the
 * source imports 'gsap' and React, so the harness stubs what it touches).
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(here, '.motion-dist')
const engineSource = path.resolve(here, '../src/components/motion/engine.ts')

// Compile the real engine standalone (CommonJS so require() can load it).
// Paths are quoted manually: the project root contains spaces, and a shelled
// spawn would otherwise split them into separate arguments.
execSync(
  `npx tsc "${engineSource}" --outDir "${distDir}" ` +
    '--module commonjs --moduleResolution node --target es2020 --skipLibCheck --jsx preserve',
  { stdio: 'pipe', shell: true }
)

const require = createRequire(import.meta.url)
const enginePath = path.join(distDir, 'engine.js')

// ---- controllable clocks ----------------------------------------------------
const realDateNow = Date.now
let fakeNow = 1_000_000
Date.now = () => fakeNow

let rafQueue = []
globalThis.requestAnimationFrame = (cb) => {
  rafQueue.push(cb)
  return rafQueue.length
}
globalThis.cancelAnimationFrame = () => {}
function pumpFrames(ms) {
  const end = fakeNow + ms
  while (fakeNow < end) {
    fakeNow += 16
    const due = rafQueue
    rafQueue = []
    for (const cb of due) cb(fakeNow)
  }
}
function idleTime(ms) {
  fakeNow += ms
}

// ---- minimal window stub (engine touches setTimeout/setInterval/Date) ------
const intervals = []
globalThis.window = {
  setTimeout: (cb, ms) => setTimeout(() => cb(), Math.min(ms ?? 0, 5)),
  clearTimeout,
  setInterval: (cb) => {
    intervals.push(cb)
    return intervals.length
  },
}
function tickIntervals() {
  for (const cb of intervals) cb()
}

const engine = require(enginePath)

// Stub the gsap surface the engine paths under test touch.
const settledTargets = []
engine.gsap.set = (targets, vars) => {
  if (vars && vars.clearProps === 'all') settledTargets.push(targets)
}
engine.gsap.killTweensOf = () => {}

let passed = 0
let failed = 0
function assert(cond, label, extra = '') {
  if (cond) { passed++; console.log(`  PASS  ${label}`) }
  else { failed++; console.log(`  FAIL  ${label} ${extra}`) }
}

function makeTween() {
  const tween = {
    then: () => tween,
    scrollTrigger: null,
    killed: false,
    kill: () => { tween.killed = true },
  }
  return tween
}

// ---- T1: killable tween survives past the old 4s failsafe while frames tick ----
{
  const tween = makeTween()
  const targets = { id: 'orbs' }
  engine.trackKillableTween(tween, targets)
  pumpFrames(6000) // a healthy page: frames tick for 6 simulated seconds
  tickIntervals()
  assert(!tween.killed, 'killable tween NOT killed while rAF ticks for 6s (old bug froze at 4s)')
  assert(settledTargets.length === 0, 'no clearProps applied to healthy motion')
}

// ---- T2: frames stop -> watcher settles killable tweens after grace ----
{
  const tween = makeTween()
  const targets = { id: 'parallax' }
  engine.trackKillableTween(tween, targets)
  pumpFrames(500) // a few healthy frames to stamp the heartbeat
  idleTime(4000) // frames stop; wall clock advances past the 3s grace
  tickIntervals()
  assert(tween.killed, 'killable tween settled once frames stop for >3s')
  assert(settledTargets.some((t) => t === targets), 'settle applied clearProps to the targets')
}

// ---- T3: once-tween still settles on its wall-clock failsafe ----
{
  const tween = makeTween()
  const settled = { called: false }
  engine.trackSettlingTween(tween, () => { settled.called = true }, 500)
  // window.setTimeout in the stub defers to real timers with a 5ms cap
  setTimeout(() => {
    assert(settled.called, 'once-tween settles via wall-clock failsafe')
    finish()
  }, 20)
}

function finish() {
  console.log(`\n=== MOTION WATCHER RESULT: ${passed} passed, ${failed} failed ===`)
  Date.now = realDateNow
  process.exit(failed > 0 ? 1 : 0)
}

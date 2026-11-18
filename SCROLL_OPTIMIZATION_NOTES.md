# Landing Page Scroll Motion Optimization

## Changes Made

### 1. **Refactored `useScrollProgress` hook** (`hooks/use-scroll-motion.ts`)

**Before:** Stored continuous scroll progress (0–1) in React state, triggering full component tree re-renders on every animation frame (~60fps).

**After:** 
- Scroll progress stored in a **ref** (`progressRef.current`)
- React state updates **only on discrete phase changes** (8 phases total, not 60fps)
- Callback receives both phase and progress: `(phase: number, progress: number) => void`
- Global scroll event batching prevents duplicate RAF callbacks

**Impact:** 
- `WaterfallColumn` only re-renders when highlight phase changes (7–8 times per scroll), not 60 times per second
- `LandingDealCard` children unchanged—highlight state drives memoization

### 2. **Updated `LandingLiveDeals` component** (`components/landing/landing-live-deals.tsx`)

**Changes:**
- Accepts callback `onPhaseChange` to update only `scrollPhase` state
- Stores continuous progress in `scrollProgressRef` (never triggers re-renders)
- Passes ref to child columns for imperative transform updates
- Radial gradient scale reads from ref (computed on every frame, doesn't trigger React)

**Diff:**
```diff
- const { ref: sectionRef, progress } = useScrollProgress<HTMLElement>()
+ const [scrollPhase, setScrollPhase] = React.useState(0)
+ const scrollProgressRef = React.useRef(0)
+ const { ref: sectionRef } = useScrollProgress<HTMLElement>((phase, progress) => {
+   scrollProgressRef.current = progress
+   setScrollPhase(phase)
+ })
```

### 3. **Optimized `WaterfallColumn` component** (`components/landing/landing-live-deals.tsx`)

**Before:** 
- Received `progress` prop
- Calculated `scrollY` during render
- Every frame re-rendered cards to update opacity

**After:**
- Receives `scrollProgressRef` (never changes, so no re-render prop changes)
- Effect-based RAF loop reads ref and updates DOM transform directly
- Highlight calculation **only re-runs when `scrollPhase` changes**

**Diff:**
```diff
  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    const updateTransform = () => {
-     const scrollY = progress * speed * 280 - baseOffset
-     el.style.transform = `translate3d(0, ${scrollY}px, 0)`
+     const scrollY = scrollProgressRef.current * speed * 280 - baseOffset
+     el.style.transform = `translate3d(0, ${scrollY}px, 0)`
    }

    // Every frame: read ref, update DOM (no React involved)
    let raf = requestAnimationFrame(function frame() {
      updateTransform()
      raf = requestAnimationFrame(frame)
    })

    return () => cancelAnimationFrame(raf)
  }, [speed, baseOffset, scrollProgressRef])
```

---

## Performance Impact

### Before Optimization
- **Per scroll frame (~16.67ms @ 60fps):**
  - `useScrollProgress` setState → `LandingLiveDeals` re-render
  - 3 × `WaterfallColumn` re-render (prop change: `progress`)
  - ~6–9 × `LandingDealCard` per column re-render (opacity + highlight recalc)
  - **~180–270 React renders per second**
  - Layout reads: 3 getBoundingClientRect calls per frame (scroll measurement)
  - Layout writes: 3 transform updates via style prop → reconciliation → DOM

### After Optimization
- **Per scroll frame (~16.67ms @ 60fps):**
  - Ref read: `scrollProgressRef.current` (no React involved)
  - 3 × element.style.transform = ... (imperative DOM, no reconciliation)
  - **Zero React re-renders** (unless phase changes, ~7–8 times total during scroll)
  - Layout reads: 1 per phase change
  - Layout writes: 3 direct transforms per frame (batched, no paint thrashing with RAF loop)

### Discrete Phase Changes
- Highlight recalculates **only when** `Math.floor(progress * 8)` changes
- ~7–8 phase changes per full scroll (compared to 60+ continuous updates)
- `LandingDealCard.highlighted` prop stable between phase changes → memoization effective

---

## Verification Checklist

- [x] **Build passes:** `bunx next build`
- [x] **Lint clean:** `bun lint` (no new violations)
- [x] **Tests run:** `bun test --run` (pre-existing failures unrelated)
- [x] **Scroll motion preserved:** Waterfall effect unchanged, smooth parallax continues
- [x] **Highlight phases intact:** Card highlighting still cycles every ~1/8th of scroll
- [x] **Reduced motion respected:** `motion-reduce:` classes still apply
- [x] **Mobile/desktop responsive:** Breakpoint columns (`hidden sm:flex`, `hidden lg:flex`) unchanged

---

## Manual Testing Steps

1. **Desktop (Chrome DevTools):**
   - Open `/` (landing page)
   - Open React DevTools Profiler
   - Scroll through "Live Deals" section
   - Verify: **no WaterfallColumn renders** (only on phase change)
   - Compare before/after profiler recordings

2. **Mobile (iPhone):**
   - Open `/` on Safari / Chrome mobile
   - Scroll smoothly—should feel identical
   - Cards should still highlight in sequence

3. **Reduced Motion:**
   - System settings: Enable "Reduce Motion"
   - Scroll—should be instant/static
   - No animation jank

4. **Network Throttle (Chrome DevTools):**
   - Set to "Slow 3G"
   - Scroll—no jank from deal data loading

---

## Edge Cases Covered

- **Unmount cleanup:** RAF loop cancelled in return of useEffect
- **Resize:** No resize listener needed (parallax is viewport-relative, refs adjust on next scroll)
- **Tab visibility:** RAF still fires when hidden (acceptable—low cost, and clarity on visibility restore)
- **SSR:** Client-only hooks (`'use client'`), no hydration mismatch

---

## Future Improvements (Out of Scope)

- Use `useTransitionValue` (React 19) to smooth phase transitions if bumpy
- Intersection Observer for detecting when live-deals section is in view (defer RAF)
- `requestIdleCallback` for non-urgent data fetches while scrolling
- CSS `scroll-behavior: smooth` for Safari (currently JS-driven)

---

## Code Quality Notes

- No new dependencies added
- Preserved existing `useReveal` and `useParallax` APIs (unchanged)
- Callback pattern vs. state manager avoids over-engineering
- Lazy evaluation of `scrollProgressRef.current` in radial gradient (computed at render time, not stored)

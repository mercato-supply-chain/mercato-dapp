/**
 * Dashboard sidebar collapse preference.
 *
 * The preference is stored under a **versioned** key so the payload shape can
 * evolve without silently mis-reading older values. Data written by the v1
 * implementation (`dashboard-sidebar:collapsed`) is migrated on first read.
 *
 * A tiny, dependency-free bootstrap script ({@link SIDEBAR_COLLAPSED_BOOTSTRAP_SCRIPT})
 * mirrors the stored value onto `<html>` *before* React hydrates, so the first
 * paint already uses the collapsed width and the dashboard never flashes from
 * expanded to collapsed.
 */

export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'mercato.dashboard.sidebar-collapsed.v2'
export const SIDEBAR_COLLAPSED_LEGACY_STORAGE_KEY = 'dashboard-sidebar:collapsed'
export const SIDEBAR_COLLAPSED_ATTRIBUTE = 'data-sidebar-collapsed'
export const SIDEBAR_COLLAPSED_CSS_VAR = '--dashboard-sidebar-width'
export const SIDEBAR_WIDTH_EXPANDED = '16rem'
export const SIDEBAR_WIDTH_COLLAPSED = '4rem'

function parseCollapsed(value: string | null): boolean | null {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function getBrowserStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    // Storage access throws in private mode / when disabled by policy.
    return null
  }
}

/** Reads the versioned preference, migrating the legacy key when needed. */
export function readSidebarCollapsedPreference(): boolean | null {
  const storage = getBrowserStorage()
  if (!storage) return null

  try {
    const versioned = parseCollapsed(storage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY))
    if (versioned !== null) return versioned

    const legacy = parseCollapsed(storage.getItem(SIDEBAR_COLLAPSED_LEGACY_STORAGE_KEY))
    if (legacy === null) return null

    try {
      storage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(legacy))
      storage.removeItem(SIDEBAR_COLLAPSED_LEGACY_STORAGE_KEY)
    } catch {
      // Migration is best-effort; the value is still usable for this session.
    }
    return legacy
  } catch {
    return null
  }
}

/** Persists the preference. Returns `false` when storage is unavailable. */
export function writeSidebarCollapsedPreference(collapsed: boolean): boolean {
  const storage = getBrowserStorage()
  if (!storage) return false

  try {
    storage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed))
    try {
      storage.removeItem(SIDEBAR_COLLAPSED_LEGACY_STORAGE_KEY)
    } catch {
      // Ignore legacy cleanup failures.
    }
    return true
  } catch {
    return false
  }
}

/** Reads the value the pre-hydration script stamped on `<html>`. */
export function readSidebarCollapsedFromDocument(): boolean | null {
  try {
    if (typeof document === 'undefined') return null
    return parseCollapsed(document.documentElement.getAttribute(SIDEBAR_COLLAPSED_ATTRIBUTE))
  } catch {
    return null
  }
}

/** Mirrors the preference onto `<html>` so CSS applies it before hydration. */
export function applySidebarCollapsedToDocument(collapsed: boolean): void {
  try {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.setAttribute(SIDEBAR_COLLAPSED_ATTRIBUTE, String(collapsed))
    root.style.setProperty(
      SIDEBAR_COLLAPSED_CSS_VAR,
      collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
    )
  } catch {
    // No-op when the document is unavailable or read-only.
  }
}

/**
 * Inline bootstrap executed before hydration. It resolves the stored preference
 * and applies it to `<html>` so the sidebar is painted at the correct width on
 * the very first frame, avoiding hydration flicker. Every storage access is
 * wrapped so private/storage-disabled modes cannot throw.
 */
export const SIDEBAR_COLLAPSED_BOOTSTRAP_SCRIPT = `(function(){try{var t='${SIDEBAR_COLLAPSED_STORAGE_KEY}',l='${SIDEBAR_COLLAPSED_LEGACY_STORAGE_KEY}',a='${SIDEBAR_COLLAPSED_ATTRIBUTE}',v='${SIDEBAR_COLLAPSED_CSS_VAR}',e='${SIDEBAR_WIDTH_EXPANDED}',c='${SIDEBAR_WIDTH_COLLAPSED}';var r=document.documentElement;var s=null;try{s=window.localStorage.getItem(t)}catch(_e){s=null}if(s!=='true'&&s!=='false'){var g=null;try{g=window.localStorage.getItem(l)}catch(_e){g=null}if(g==='true'||g==='false'){s=g;try{window.localStorage.setItem(t,g);window.localStorage.removeItem(l)}catch(_e){}}}var y=s==='true';r.setAttribute(a,y?'true':'false');r.style.setProperty(v,y?c:e)}catch(_e){}})();`

import { describe, expect, test } from 'bun:test'
import { activeUserMenuGroupId, getUserMenu, isUserMenuItemActive } from '@/lib/navigation/user-menu-model'

describe('getUserMenu', () => {
  test('keeps investor, pyme, and supplier menus to a single short list', () => {
    for (const role of ['investor', 'pyme', 'supplier'] as const) {
      const menu = getUserMenu(role)
      expect(menu.switchGroups).toBe(false)
      expect(menu.groups).toHaveLength(1)
      expect(menu.groups[0].items.length).toBeGreaterThan(0)
      expect(menu.groups[0].items.length).toBeLessThanOrEqual(4)
    }
  })

  test('splits the admin menu into three groups and never shows them all at once', () => {
    const menu = getUserMenu('admin')
    expect(menu.switchGroups).toBe(true)
    expect(menu.groups.map((group) => group.id)).toEqual(['work', 'people', 'insight'])
    for (const group of menu.groups) {
      expect(group.items.length).toBeGreaterThan(0)
      expect(group.items.length).toBeLessThanOrEqual(5)
    }
    const hrefs = menu.groups.flatMap((group) => group.items.map((item) => item.href))
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})

describe('activeUserMenuGroupId', () => {
  test('opens the admin group that contains the current page', () => {
    const { groups } = getUserMenu('admin')
    expect(activeUserMenuGroupId('/dashboard/admin/releases', groups)).toBe('work')
    expect(activeUserMenuGroupId('/dashboard/admin/users', groups)).toBe('people')
    expect(activeUserMenuGroupId('/dashboard/admin/analytics', groups)).toBe('insight')
    expect(activeUserMenuGroupId('/dashboard/admin', groups)).toBe('work')
    expect(activeUserMenuGroupId('/dashboard', groups)).toBe('work')
  })

  test('does not mark every admin page active from the admin home link', () => {
    const home = getUserMenu('admin').groups[0].items.find((item) => item.href === '/dashboard/admin')
    expect(home).toBeDefined()
    expect(isUserMenuItemActive('/dashboard/admin', home!)).toBe(true)
    expect(isUserMenuItemActive('/dashboard/admin/users', home!)).toBe(false)
  })
})

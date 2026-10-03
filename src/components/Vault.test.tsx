// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Vault } from './Vault.tsx'
import { en } from '../locales/en.ts'

afterEach(cleanup)

function renderVault(version: string | null, loading: boolean) {
  return render(
    <Vault keys={[]} version={version} loading={loading} play={vi.fn()} onDone={vi.fn()} />,
  )
}

describe('Vault subtitle', () => {
  it('shows nothing readable while the catalog loads (no fallback flash)', () => {
    const { container } = renderVault(null, true)
    const subtitle = container.querySelector('.vault-subtitle')
    expect(subtitle?.textContent).not.toContain(en.vault.subtitleUnknown)
    expect(subtitle?.textContent?.trim()).toBe('')
    expect(subtitle?.classList.contains('ready')).toBe(false)
  })

  it('shows the versioned subtitle once loaded', () => {
    const { container, rerender } = render(
      <Vault keys={[]} version={null} loading={true} play={vi.fn()} onDone={vi.fn()} />,
    )
    rerender(<Vault keys={[]} version="1.2.3" loading={false} play={vi.fn()} onDone={vi.fn()} />)
    expect(container.querySelector('.vault-subtitle')?.textContent).toBe(
      'Minecraft sounds for 1.2.3',
    )
    expect(container.querySelector('.vault-subtitle')?.classList.contains('ready')).toBe(true)
  })

  it('falls back to the unknown subtitle when loaded without a version', () => {
    const { container } = renderVault(null, false)
    expect(container.querySelector('.vault-subtitle')?.textContent).toBe(
      en.vault.subtitleUnknown,
    )
  })
})

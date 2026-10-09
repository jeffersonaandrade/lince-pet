import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.hoisted(() => vi.fn())

vi.mock('@/hook/api', () => ({ api: { get, post: vi.fn() } }))

import { searchVeterinarios } from '@/services/veterinarios/veterinarios'

describe('busca de veterinário por plano de saúde', () => {
  beforeEach(() => {
    get.mockReset()
    get.mockResolvedValue({ data: { veterinarios: [] } })
  })

  it('envia o plano marcado no filtro para a API', async () => {
    await searchVeterinarios({ plano: 'Pet Love', cidade: 'Campinas' })

    const url = new URL(get.mock.calls[0][0], 'http://local')
    expect(url.pathname).toBe('/veterinarios/search')
    expect(url.searchParams.get('plano')).toBe('Pet Love')
    expect(url.searchParams.get('cidade')).toBe('Campinas')
  })

  it('omite o plano quando o tutor não filtrou', async () => {
    await searchVeterinarios({ search: 'Ana' })

    const url = new URL(get.mock.calls[0][0], 'http://local')
    expect(url.searchParams.get('plano')).toBeNull()
    expect(url.searchParams.get('search')).toBe('Ana')
  })
})

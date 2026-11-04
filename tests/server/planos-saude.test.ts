import { describe, expect, it, vi } from 'vitest'
import { conferirNovosPlanosSaude } from '@/server/services/planos-saude'

describe('novas associações de plano de saúde', () => {
  it('sem novos vínculos não consulta nem rejeita os antigos', async () => {
    const tx = { $queryRaw: vi.fn() }
    await conferirNovosPlanosSaude(tx as never, [])
    expect(tx.$queryRaw).not.toHaveBeenCalled()
  })
  it('rejeita opções inativas ou inexistentes', async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) }
    await expect(conferirNovosPlanosSaude(tx as never, ['inativo'])).rejects.toMatchObject({ status: 422 })
  })
  it('permite opções ativas sob trava de leitura', async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ id: 'ativo' }]) }
    await conferirNovosPlanosSaude(tx as never, ['ativo'])
    expect(tx.$queryRaw.mock.calls[0][0].join('')).toContain('FOR SHARE')
  })
})

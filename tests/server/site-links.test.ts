import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const raiz = path.resolve(__dirname, '../..')
const ARQUIVOS = ['src/components/Header/Header.tsx', 'src/components/Footer/Footer.tsx']

const ler = (arquivo: string) => readFileSync(path.join(raiz, arquivo), 'utf8')

function linksInternos(fonte: string) {
  return [...fonte.matchAll(/href[=:]\s*\{?\s*["'](\/[^"'#?]*)["']/g)].map((m) => m[1])
}

const paginaExiste = (rota: string) =>
  existsSync(path.join(raiz, 'src/app', rota === '/' ? '' : rota, 'page.tsx'))

describe('links do Header e do Footer', () => {
  it.each(ARQUIVOS)('%s não tem href="#"', (arquivo) => {
    expect(ler(arquivo)).not.toMatch(/href=["']#["']/)
  })

  it.each(ARQUIVOS)('%s só aponta para páginas que existem', (arquivo) => {
    const links = linksInternos(ler(arquivo))
    expect(links.length).toBeGreaterThan(0)
    expect(links.filter((rota) => !paginaExiste(rota))).toEqual([])
  })

  it('Footer cobre as páginas institucionais', () => {
    const links = linksInternos(ler('src/components/Footer/Footer.tsx'))
    for (const rota of ['/como-funciona', '/explorar', '/servicos', '/precos', '/ajuda', '/contato', '/seguranca', '/cookies']) {
      expect(links).toContain(rota)
    }
  })
})

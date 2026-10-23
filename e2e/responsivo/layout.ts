import { expect, type Locator, type Page } from '@playwright/test'

export const TELAS = [
  { nome: 'celular pequeno', width: 360, height: 740 },
  { nome: 'iphone', width: 390, height: 844 },
  { nome: 'tablet', width: 768, height: 1024 },
] as const

/** Alvo mínimo de toque da WCAG 2.2 (2.5.8, nível AA). Links dentro de texto são exceção e ficam de fora. */
const ALVO_MINIMO = 24

type Problema = { tipo: string; elemento: string; detalhe: string }

/**
 * Procura, na tela atual, rolagem horizontal, controles cortados nas laterais e alvos de toque pequenos.
 * Ignora o que está escondido (display none, tamanho zero, dentro de aria-hidden, como o menu lateral fechado).
 */
export async function problemasDeLayout(page: Page): Promise<Problema[]> {
  return page.evaluate((alvoMinimo) => {
    const problemas: { tipo: string; elemento: string; detalhe: string }[] = []
    const largura = window.innerWidth
    const doc = document.documentElement
    if (doc.scrollWidth > largura + 1) {
      problemas.push({ tipo: 'rolagem horizontal', elemento: 'página', detalhe: `${doc.scrollWidth}px > ${largura}px` })
    }

    const descrever = (el: Element) => {
      const texto = (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.getAttribute('placeholder') || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40)
      return `<${el.tagName.toLowerCase()}> ${texto || el.id || el.className.toString().slice(0, 40)}`
    }

    const controles = document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]')
    for (const el of controles) {
      if (el.closest('[aria-hidden="true"], [inert]')) continue
      const estilo = getComputedStyle(el)
      if (estilo.display === 'none' || estilo.visibility === 'hidden' || Number(estilo.opacity) === 0) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue

      const naFaixaComRolagem = (() => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX
          if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth) {
            const rp = p.getBoundingClientRect()
            return rp.left >= -1 && rp.right <= largura + 1
          }
        }
        return false
      })()
      if (!naFaixaComRolagem && (r.left < -1 || r.right > largura + 1)) {
        problemas.push({ tipo: 'fora da tela', elemento: descrever(el), detalhe: `x ${Math.round(r.left)}..${Math.round(r.right)} de ${largura}px` })
      }
      const linkNoTexto = el.tagName === 'A' && estilo.display === 'inline'
      // 0,5px de folga para arredondamento de subpixel.
      if (!linkNoTexto && (r.width < alvoMinimo - 0.5 || r.height < alvoMinimo - 0.5)) {
        problemas.push({ tipo: 'alvo pequeno', elemento: descrever(el), detalhe: `${Math.round(r.width)}x${Math.round(r.height)}px` })
      }
    }
    return problemas
  }, ALVO_MINIMO)
}

export async function semProblemasDeLayout(page: Page) {
  const problemas = await problemasDeLayout(page)
  expect(problemas, problemas.map((p) => `${p.tipo}: ${p.elemento} (${p.detalhe})`).join('\n')).toEqual([])
}

/** Clique de teste: falha se o botão estiver coberto por outro elemento, desabilitado ou fora de alcance. */
export async function clicavel(alvo: Locator) {
  await alvo.scrollIntoViewIfNeeded()
  await alvo.click({ trial: true, timeout: 5_000 })
}

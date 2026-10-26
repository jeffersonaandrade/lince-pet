/** Para onde o login devolve o usuário: só caminhos do próprio site (evita redirecionamento aberto). */
const BASE = "http://lincepet.local";

export function destinoSeguro(valor: string | null | undefined): string {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\")) return "/";
  try {
    const url = new URL(valor, BASE);
    // "/.//host" normaliza para "//host", que o navegador lê como outra origem.
    if (url.origin !== BASE || url.pathname === "/login" || url.pathname.startsWith("//")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

/** Link do login que volta para `destino` (padrão: a página atual) depois de entrar. */
export function urlDeLogin(destino?: string): string {
  const atual =
    destino ?? (typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}${window.location.hash}`);
  const seguro = destinoSeguro(atual);
  return seguro === "/" ? "/login" : `/login?next=${encodeURIComponent(seguro)}`;
}

/** Troca explícita de contexto, preservando a página pública de origem. */
export function urlDePerfis(): string {
  const atual = typeof window === 'undefined' ? '/' : `${window.location.pathname}${window.location.search}`;
  return `/perfis?voltar=${encodeURIComponent(destinoSeguro(atual))}`;
}

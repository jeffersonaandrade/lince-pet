"use client";

/** Ano pelo relógio do navegador: páginas estáticas não ficam presas ao ano do build. */
export function AnoAtual() {
  return <span suppressHydrationWarning>{new Date().getFullYear()}</span>;
}

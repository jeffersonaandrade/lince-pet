"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[Página] Erro inesperado:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-5 py-16 text-center">
      <h2 className="m-0 mb-3 font-[family-name:var(--font-heading)] text-2xl font-semibold text-[var(--text-color)] sm:text-4xl">
        Algo deu errado
      </h2>
      <p className="m-0 mb-8 max-w-md text-base text-[var(--text-muted)] sm:text-lg">
        Tivemos um problema ao carregar esta página. Tente novamente em alguns instantes.
      </p>
      <div className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[var(--primary)] px-6 py-3 font-semibold text-white transition-colors hover:bg-[var(--primary-dark)] sm:w-auto"
        >
          <RotateCcw size={16} />
          Tentar novamente
        </button>
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center rounded-xl border border-solid border-gray-200 bg-white px-6 py-3 font-semibold text-[var(--text-color)] transition-colors hover:bg-gray-50 sm:w-auto"
        >
          Voltar para o Início
        </Link>
      </div>
      {error.digest && <p className="m-0 mt-6 text-xs text-gray-400">Código do erro: {error.digest}</p>}
    </div>
  );
}

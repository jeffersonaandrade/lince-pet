import Link from "next/link";
import type { ReactNode } from "react";

export function PaginaInstitucional({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1160px] px-4 py-12 text-[#333] sm:px-8 sm:py-16">
      <header className="mb-10 text-center sm:mb-14">
        <h1 className="m-0 font-[family-name:var(--font-heading)] text-3xl font-semibold text-[var(--primary)] sm:text-4xl">
          {titulo}
        </h1>
        {subtitulo && <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-gray-500 sm:text-lg">{subtitulo}</p>}
      </header>
      <div className="flex flex-col gap-12">{children}</div>
    </div>
  );
}

export function Secao({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="m-0 mb-5 border-0 border-b-2 border-solid border-gray-100 pb-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-slate-700">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export function Paragrafo({ children }: { children: ReactNode }) {
  return <p className="m-0 mb-4 leading-7 text-slate-600">{children}</p>;
}

export function Lista({ itens }: { itens: ReactNode[] }) {
  return (
    <ul className="m-0 mb-4 flex list-disc flex-col gap-2 pl-6 leading-7 text-slate-600">
      {itens.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function Grade({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 md:grid-cols-3">{children}</div>;
}

export function Card({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border border-solid border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="m-0 mb-3 font-[family-name:var(--font-heading)] text-xl font-semibold text-[var(--primary)]">{titulo}</h3>
      <div className="flex-1 text-slate-600">{children}</div>
    </div>
  );
}

export function LinkTexto({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-[var(--primary)] no-underline hover:underline">
      {children}
    </Link>
  );
}

export function BotaoCta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-block rounded-xl bg-[var(--primary)] px-6 py-3 font-semibold text-white no-underline transition-colors hover:bg-[var(--primary-dark)]"
    >
      {children}
    </Link>
  );
}

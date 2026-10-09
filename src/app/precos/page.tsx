import type { Metadata } from "next";
import Image from "next/image";
import { BotaoCta, PaginaInstitucional, Paragrafo, Secao } from "@/components/Institucional/PaginaInstitucional";
import { PLANOS_CLINICA, PLANOS_VETERINARIO, type PlanoMetadata } from "@/config/planos";

export const metadata: Metadata = {
  title: "Preços | Lince Pet",
  description: "Planos da Lince Pet para veterinários e clínicas.",
};

function Planos({ planos }: { planos: PlanoMetadata[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {planos.map((plano) => (
        <div key={plano.code} className="flex flex-col rounded-xl border border-solid border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <Image src={plano.iconPath} alt="" width={40} height={40} />
            <div>
              <h3 className="m-0 font-[family-name:var(--font-heading)] text-xl font-semibold text-slate-700">{plano.name}</h3>
              <p className="m-0 text-sm text-gray-500">{plano.description}</p>
            </div>
          </div>
          <p className="m-0 mb-4 text-3xl font-bold text-[var(--primary)]">
            {plano.defaultPrice}
            <span className="text-base font-normal text-gray-500">/mês</span>
          </p>
          <ul className="m-0 mb-6 flex flex-1 list-none flex-col gap-2 p-0 text-sm text-slate-600">
            {plano.benefits.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="text-[var(--primary)]">✓</span>
                {b}
              </li>
            ))}
          </ul>
          <BotaoCta href="/signup">Começar</BotaoCta>
        </div>
      ))}
    </div>
  );
}

export default function PrecosPage() {
  return (
    <PaginaInstitucional titulo="Preços" subtitulo="Para tutores, a Lince Pet é gratuita. Profissionais podem começar no plano gratuito e evoluir quando quiserem.">
      <Secao titulo="Veterinários" id="veterinario">
        <Paragrafo>Plano gratuito com agenda e perfil na busca. Planos pagos com agendamentos ilimitados e destaque.</Paragrafo>
        <Planos planos={PLANOS_VETERINARIO} />
      </Secao>
      <Secao titulo="Clínicas" id="clinica">
        <Planos planos={PLANOS_CLINICA} />
      </Secao>
      <p className="m-0 text-center text-sm text-gray-500">Valores mensais de referência. O valor final aparece na assinatura, conforme ciclo e forma de pagamento.</p>
    </PaginaInstitucional>
  );
}

import type { StatusAnalise } from "@/contexts/AuthContext";

interface AvisoAnaliseProps {
  /** O que está em análise, ex.: "Seu CRMV". */
  item: string;
  status: StatusAnalise | null | undefined;
  motivo?: string | null;
  /** O que fica bloqueado enquanto não aprova. */
  consequencia: string;
}

const ESTILO: Record<StatusAnalise, string> = {
  pendente: "border-amber-300 bg-amber-50 text-amber-900",
  aprovado: "border-emerald-300 bg-emerald-50 text-emerald-900",
  reprovado: "border-red-300 bg-red-50 text-red-900",
};

/** Status da análise do admin (CRMV do vet, RT da clínica). Aprovado não mostra nada. */
export default function AvisoAnalise({ item, status, motivo, consequencia }: AvisoAnaliseProps) {
  if (!status || status === "aprovado") return null;
  return (
    <div role="status" className={`mb-4 rounded-xl border px-4 py-3 text-sm ${ESTILO[status]}`}>
      {status === "pendente" ? (
        <p>
          <strong>{item} está em análise pela equipe Lince Pet.</strong> {consequencia} Você será avisado assim que
          a análise terminar.
        </p>
      ) : (
        <p>
          <strong>{item} foi reprovado.</strong> {motivo ? `Motivo: ${motivo}. ` : ""}Corrija os dados e envie de
          novo para nova análise.
        </p>
      )}
    </div>
  );
}

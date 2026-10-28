import { Mail, Phone, User as UserIcon } from "lucide-react";
import { formatPhone } from "@/utils/formatters";

interface TutorContactProps {
  nome?: string;
  sobrenome?: string;
  telefone?: string | null;
  email?: string | null;
}

export default function TutorContact({ nome, sobrenome, telefone, email }: TutorContactProps) {
  const nomeCompleto = [nome, sobrenome].filter(Boolean).join(" ") || "Tutor";

  return (
    <div className="col-span-full flex min-w-0 flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <UserIcon size={16} className="shrink-0 text-orange-500" />
        <div className="flex flex-col">
          <span className="text-xs text-gray-500">Tutor</span>
          <span className="text-sm font-semibold text-gray-800">{nomeCompleto}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
        <Phone size={14} className="shrink-0 text-gray-400" />
        <span>{telefone ? formatPhone(telefone) : "Não informado"}</span>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-700">
        <Mail size={14} className="shrink-0 text-gray-400" />
        {email ? (
          <a href={`mailto:${email}`} className="break-all text-orange-600 hover:underline">
            {email}
          </a>
        ) : (
          <span>Não informado</span>
        )}
      </div>
    </div>
  );
}

import { normalizarGrade, type GradeSemanal } from "@/lib/horarios";
import { abbreviateAddress, formatPhone, toWhatsAppLink } from "@/utils/formatters";

export interface VeterinarioDaClinicaApi {
  id: string;
  user?: { nome?: string | null; sobrenome?: string | null; profilePic?: string | null } | null;
  especialidades?: { nome: string }[];
  crmv?: string | null;
  fotoUrl?: string | null;
  rating?: number | null;
  precoConsulta?: number | string | null;
  enderecos?: { horariosDisponibilidade?: unknown; precoConsulta?: number | string | null }[];
}

export interface ClinicaDetalheApi {
  id: string;
  nomeClinica?: string | null;
  fotoPerfil?: string | null;
  fotoCapa?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  descricao?: string | null;
  sobre?: string | null;
  especialidades?: { nome: string }[];
  planos?: { name: string }[];
  comodidades?: unknown;
  horariosFuncionamento?: unknown;
  veterinarios?: VeterinarioDaClinicaApi[];
}

export interface AvaliacaoDaClinicaApi {
  estrelasClinica: number;
  comentarioClinica?: string | null;
  data?: string | null;
  tutor?: { nome: string; sobrenome?: string | null } | null;
}

export interface ProfissionalDaClinica {
  id: string;
  name: string;
  specialty: string;
  crmv: string;
  fotoUrl: string | null;
  rating: number;
  specificSchedule: GradeSemanal | null;
  /** Preço que o backend cobra ao agendar por esta clínica; `null` se não houver. */
  price: number | null;
}

export interface PerfilClinica {
  id: string;
  name: string;
  logo: string | null;
  cover: string | null;
  rating: number;
  reviewCount: number;
  address: string;
  phone: string | null;
  whatsappLink: string | null;
  description: string;
  specialties: string[];
  planos: string[];
  amenities: string[];
  horarios: GradeSemanal;
  professionals: ProfissionalDaClinica[];
  reviews: { rating: number; date: string; userName: string; comment: string }[];
}

const COMODIDADES: Record<string, string> = {
  estacionamento: "Estacionamento Próprio",
  acessibilidade: "Acessibilidade (Rampa/Elevador)",
  arcondicionado: "Ar Condicionado",
  wifi: "Wi-Fi Gratuito",
  salaespera: "Sala de Espera Confortável",
  banheiro: "Banheiro para Clientes",
  atendimento24h: "Atendimento 24h",
  farmacia: "Farmácia Veterinária",
  internacao: "Internação",
  raiox: "Raio-X / Ultrassom",
};

const DESCRICAO_PADRAO =
  "Referência em medicina veterinária na região, cuidando do seu melhor amigo com carinho e excelência.";

/** Comodidades marcadas (objeto ou JSON em texto), com o rótulo de exibição. */
export function comodidadesMarcadas(valor: unknown): string[] {
  let bruto = valor;
  if (typeof bruto === "string") {
    try {
      bruto = JSON.parse(bruto);
    } catch {
      return [];
    }
  }
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return [];
  return Object.entries(bruto).flatMap(([chave, marcada]) => (marcada ? [COMODIDADES[chave] ?? chave] : []));
}

const numeroOuNull = (valor: number | string | null | undefined) => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

/** Mesma regra do POST /agendamentos com clinica_id: preço do endereço na clínica, senão o do veterinário. */
function precoNaClinica(v: VeterinarioDaClinicaApi): number | null {
  const endereco = v.enderecos?.[0];
  return endereco ? numeroOuNull(endereco.precoConsulta) : numeroOuNull(v.precoConsulta);
}

function profissional(v: VeterinarioDaClinicaApi): ProfissionalDaClinica {
  const grade = v.enderecos?.[0]?.horariosDisponibilidade;
  return {
    id: v.id,
    name: v.user?.nome ? `${v.user.nome} ${v.user.sobrenome || ""}`.trim() : "Veterinário",
    specialty: v.especialidades?.[0]?.nome || "Médico Veterinário",
    crmv: v.crmv || "N/A",
    fotoUrl: v.fotoUrl || v.user?.profilePic || null,
    rating: v.rating || 0,
    specificSchedule: grade ? normalizarGrade(grade) : null,
    price: precoNaClinica(v),
  };
}

export function perfilDaClinica(
  data: ClinicaDetalheApi,
  avaliacoes: { media?: number; total?: number; avaliacoes?: AvaliacaoDaClinicaApi[] },
): PerfilClinica {
  const telefone = data.telefone || data.whatsapp || null;
  const local = [data.cidade, data.estado].filter(Boolean).join(" - ");
  return {
    id: data.id,
    name: data.nomeClinica || "Clínica",
    logo: data.fotoPerfil || null,
    cover: data.fotoCapa || null,
    rating: avaliacoes.media || 0,
    reviewCount: avaliacoes.total || 0,
    address: [abbreviateAddress(data.endereco || ""), local].filter(Boolean).join(", "),
    phone: telefone ? formatPhone(telefone) : null,
    whatsappLink: toWhatsAppLink(data.whatsapp || data.telefone),
    description: data.descricao || data.sobre || DESCRICAO_PADRAO,
    specialties: data.especialidades?.map((e) => e.nome) || [],
    planos: data.planos?.map((p) => p.name) || [],
    amenities: comodidadesMarcadas(data.comodidades),
    horarios: normalizarGrade(data.horariosFuncionamento),
    professionals: data.veterinarios?.map(profissional) || [],
    reviews: (avaliacoes.avaliacoes || []).map((a) => ({
      rating: a.estrelasClinica,
      date: a.data || "",
      userName: a.tutor?.nome ? `${a.tutor.nome} ${a.tutor.sobrenome || ""}`.trim() : "Tutor anônimo",
      comment: a.comentarioClinica || "",
    })),
  };
}

/** "150" ou "149,90"; `null` vira "a combinar". */
export function formatarPrecoConsulta(preco: number | null): string {
  if (preco === null) return "Valor a combinar";
  const arredondado = Math.round(preco * 100) / 100;
  return `R$ ${arredondado % 1 === 0 ? arredondado.toFixed(0) : arredondado.toFixed(2).replace(".", ",")}`;
}

import type { PetRecord, PortePet } from "@/services/pets/pets";

const PORTES = new Set(["pequeno", "medio", "grande"]);

export type FormularioPet = { nome: string; especie: string; raca: string; idade: string; porte: string };

export const FORMULARIO_PET_VAZIO: FormularioPet = { nome: "", especie: "", raca: "", idade: "", porte: "" };

/**
 * Valida o formulário e devolve o corpo da API, ou a primeira mensagem de erro.
 * Idade é em anos inteiros (0 a 40).
 */
export function dadosDoFormularioPet(
  form: FormularioPet
):
  | { erro: string }
  | { dados: { nome: string; especie: string; raca?: string; idade?: number; porte: PortePet } } {
  const nome = form.nome.trim();
  const especie = form.especie.trim();
  if (!nome) return { erro: "Informe o nome do pet" };
  if (!especie) return { erro: "Informe a espécie" };
  const idadeTexto = form.idade.trim();
  const idade = idadeTexto ? Number(idadeTexto) : undefined;
  if (idade !== undefined && (!Number.isInteger(idade) || idade < 0 || idade > 40)) {
    return { erro: "Idade deve ser um número de 0 a 40" };
  }
  if (!PORTES.has(form.porte)) return { erro: "Informe o porte do animal" };
  return {
    dados: { nome, especie, raca: form.raca.trim() || undefined, idade, porte: form.porte as PortePet },
  };
}

export const formularioDoPet = (pet: PetRecord): FormularioPet => ({
  nome: pet.nome,
  especie: pet.especie,
  raca: pet.raca ?? "",
  idade: pet.idade !== null && pet.idade !== undefined ? String(pet.idade) : "",
  porte: pet.porte ?? "",
});

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

/** Converte o pet da API (snake_case, com `fotoUrl` em respostas antigas) para `PetRecord`. */
export function petDaApi(valor: unknown): PetRecord {
  if (!valor || typeof valor !== "object") throw new TypeError("Pet inválido na resposta da API");
  const p = valor as Record<string, unknown>;
  if (p.id === undefined || p.id === null) throw new TypeError("Pet sem id na resposta da API");

  const idade = typeof p.idade === "number" ? p.idade : typeof p.idade === "string" && p.idade.trim() ? Number(p.idade) : null;
  const porte = typeof p.porte === "string" && PORTES.has(p.porte) ? (p.porte as PetRecord["porte"]) : null;

  return {
    id: String(p.id),
    tutor_id: String(p.tutor_id ?? p.tutorId ?? ""),
    nome: String(p.nome ?? ""),
    especie: String(p.especie ?? ""),
    raca: texto(p.raca),
    idade: idade !== null && Number.isFinite(idade) ? idade : null,
    porte,
    foto_url: texto(p.foto_url) ?? texto(p.fotoUrl),
    created_at: typeof p.created_at === "string" ? p.created_at : undefined,
  };
}

export const formatCep = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 5) {
    return numbers;
  }
  return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
};

export const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 2) {
    return numbers;
  }
  if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  }
  if (numbers.length <= 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(
      7
    )}`;
  }
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(
    7,
    11
  )}`;
};

export const removeMask = (value: string): string => {
  return value.replace(/\D/g, "");
};

/**
 * Normaliza nomes para comparação (remove acentos, espaços extras e case)
 */
const normalizeName = (value?: string): string => {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
};

/**
 * Formata o título do evento/consulta evitando duplicação como "José - José".
 * Regras:
 * - Se tutor e pet forem iguais (ignorando acentos/case), exibe apenas um nome (prioriza o pet).
 * - Se um dos campos estiver vazio, mostra o que existir.
 * - Se ambos vazios, retorna "Consulta".
 * - Caso contrário, retorna "Tutor - Pet".
 */
export const formatEventTitle = (
  tutorNome?: string,
  petNome?: string
): string => {
  const tutor = (tutorNome || "").trim();
  const pet = (petNome || "").trim();

  if (!tutor && !pet) return "Consulta";
  if (!pet) return tutor;
  if (!tutor) return pet;

  if (normalizeName(tutor) === normalizeName(pet)) {
    // Se forem iguais, mostra apenas um (prioriza o pet)
    return pet;
  }

  return `${tutor} - ${pet}`;
};

/**
 * Formata uma data para YYYY-MM-DD em horário LOCAL.
 * Evita problemas de timezone que ocorrem ao usar toISOString().
 */
export const formatDateToISO = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
/**
 * Abbreviates common Brazilian address terms to save space on mobile.
 */
export const abbreviateAddress = (address: string): string => {
  if (!address) return "";
  return address
    .replace(/\bRua\b/gi, "R.")
    .replace(/\bAvenida\b/gi, "Av.")
    .replace(/\bAlameda\b/gi, "Al.")
    .replace(/\bTravessa\b/gi, "Tv.")
    .replace(/\bComplemento\b/gi, "Compl.")
    .replace(/\bApartamento\b/gi, "Apt.")
    .replace(/\bEdifício\b/gi, "Ed.")
    .replace(/\bConjunto\b/gi, "Conj.")
    .replace(/\bRodovia\b/gi, "Rod.");
};

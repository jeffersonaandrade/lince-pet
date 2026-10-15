type Opcao = { value: string; label: string };

const opcoes = (...nomes: string[]): Opcao[] => nomes.map((nome) => ({ value: nome, label: nome }));

export const ESPECIES: Opcao[] = opcoes("Canina", "Felina", "Ave", "Roedor", "Réptil", "Coelho", "Outro");

export const RACAS_POR_ESPECIE: Record<string, Opcao[]> = {
  Canina: opcoes(
    "Labrador", "Golden Retriever", "Pastor Alemão", "Bulldog", "Poodle", "Beagle", "Rottweiler", "Yorkshire",
    "Boxer", "Dachshund", "Shih Tzu", "Pug", "Husky Siberiano", "Chihuahua", "Border Collie", "Vira-lata",
    "SRD (Sem Raça Definida)", "Outro"
  ),
  Felina: opcoes(
    "Persa", "Siamês", "Maine Coon", "Ragdoll", "Bengal", "Sphynx", "British Shorthair", "Abissínio",
    "Scottish Fold", "Angorá", "Vira-lata", "SRD (Sem Raça Definida)", "Outro"
  ),
  Ave: opcoes("Calopsita", "Periquito", "Papagaio", "Canário", "Agapornis", "Cacatua", "Arara", "Outro"),
  Roedor: opcoes("Hamster", "Porquinho-da-índia", "Chinchila", "Rato", "Gerbil", "Outro"),
  Réptil: opcoes("Iguana", "Jabuti", "Tartaruga", "Gecko", "Cobra", "Camaleão", "Outro"),
  Coelho: opcoes("Mini Lion", "Angorá", "Rex", "Holandês", "Fuzzy Lop", "SRD (Sem Raça Definida)", "Outro"),
  Outro: opcoes("Não especificado"),
};

export const PORTES_PET: Opcao[] = [
  { value: "pequeno", label: "Pequeno" },
  { value: "medio", label: "Médio" },
  { value: "grande", label: "Grande" },
];

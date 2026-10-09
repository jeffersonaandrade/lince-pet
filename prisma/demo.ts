import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { Genero, Porte, PrismaClient, TipoClinica, UserType } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'

/** Contas de demonstração. Não sobrescreve a senha de um e-mail que já existe. */
export const SENHA_DEMO = 'senha123'

const AGENDA = {
  segunda: ['08:00', '09:00', '10:00', '14:00', '15:00', '16:00'],
  terca: ['08:00', '09:00', '10:00', '14:00', '15:00', '16:00'],
  quarta: ['08:00', '09:00', '10:00', '14:00', '15:00', '16:00'],
  quinta: ['08:00', '09:00', '10:00', '14:00', '15:00'],
  sexta: ['08:00', '09:00', '10:00', '11:00', '15:00'],
}

const AGENDA_ONLINE = {
  terca: ['19:00', '20:00', '21:00'],
  quinta: ['19:00', '20:00', '21:00'],
  sabado: ['09:00', '10:00', '11:00'],
}

type Endereco = {
  cep: string
  rua: string
  numero: string
  bairro: string
  cidade: string
  estado: string
}

export type TutorDemo = Endereco & {
  email: string
  nome: string
  sobrenome: string
  celular: string
  genero: Genero
  portrait: string
  cpf: string
  whatsappOptIn: number
}

export type VetDemo = TutorDemo & {
  crmv: string
  bio: string
  especialidades: string[]
  planos: string[]
  atendeOnline: boolean
  atendeDomicilio: boolean
  precoConsulta: number
  precoOnline: number
  creditos: number
  planCode: 'pro' | 'pro_plus'
  consultasNoMes: number
}

export type ClinicaDemo = {
  email: string
  nome: string
  sobrenome: string
  celular: string
  portrait: string
  nomeClinica: string
  tipoClinica: TipoClinica
  quantidadeVets: string
  razaoSocial: string
  cnpj: string
  endereco: string
  cep: string
  cidade: string
  estado: string
  telefone: string
  whatsapp: string
  latitude: string
  longitude: string
  planCode: 'starter' | 'clinic' | 'clinic_pro'
  especialidades: string[]
  planos: string[]
  diferenciais: string[]
  sobre: string
  descricao: string
}

export type PrestadorDemo = Endereco & {
  email: string
  nome: string
  sobrenome: string
  celular: string
  portrait: string
  cpf: string
  tipo: 'tosador' | 'passeador' | 'adestrador' | 'pet_sitter'
  bio: string
  raioKm: number
  atendeLocalProprio: boolean
  servicos: { nome: string; preco: number; duracaoMin: number | null }[]
}

/** Grade padrão dos prestadores de demonstração: seg a sáb, 08:00 às 18:00 (0=domingo). */
const HORARIOS_PRESTADOR = Object.fromEntries([1, 2, 3, 4, 5, 6].map((dia) => [String(dia), ['08:00', '18:00']]))

const foto = (path: string) => `https://randomuser.me/api/portraits/${path}.jpg`

const cidade = (estado: string, nome: string, cep: string, rua: string, numero: string, bairro: string): Endereco => ({
  cep,
  rua,
  numero,
  bairro,
  cidade: nome,
  estado,
})

const sp = (cep: string, rua: string, numero: string, bairro: string) => cidade('SP', 'São Paulo', cep, rua, numero, bairro)
const rj = (cep: string, rua: string, numero: string, bairro: string) => cidade('RJ', 'Rio de Janeiro', cep, rua, numero, bairro)
const mg = (cep: string, rua: string, numero: string, bairro: string) => cidade('MG', 'Belo Horizonte', cep, rua, numero, bairro)
const pr = (cep: string, rua: string, numero: string, bairro: string) => cidade('PR', 'Curitiba', cep, rua, numero, bairro)
const rs = (cep: string, rua: string, numero: string, bairro: string) => cidade('RS', 'Porto Alegre', cep, rua, numero, bairro)

function tutor(
  email: string,
  nome: string,
  sobrenome: string,
  celular: string,
  genero: Genero,
  fotoPath: string,
  cpf: string,
  endereco: Endereco,
  whatsappOptIn = 1
): TutorDemo {
  return { email, nome, sobrenome, celular, genero, portrait: foto(fotoPath), cpf, whatsappOptIn, ...endereco }
}

function veterinario(
  email: string,
  nome: string,
  sobrenome: string,
  celular: string,
  genero: Genero,
  fotoPath: string,
  cpf: string,
  crmv: string,
  endereco: Endereco,
  extra: Omit<VetDemo, keyof TutorDemo | 'crmv'>
): VetDemo {
  return { ...tutor(email, nome, sobrenome, celular, genero, fotoPath, cpf, endereco), crmv, ...extra }
}

export const TUTORES: TutorDemo[] = [
  tutor('joao.silva.mockup@email.com', 'João', 'Silva', '(11) 98765-4321', Genero.masculino, 'men/1', '80000000001', sp('01310100', 'Avenida Paulista', '1578', 'Bela Vista')),
  tutor('maria.santos.mockup@email.com', 'Maria', 'Santos', '(21) 97654-3210', Genero.feminino, 'women/1', '80000000002', rj('22070900', 'Avenida Atlântica', '1702', 'Copacabana')),
  tutor('pedro.oliveira.mockup@email.com', 'Pedro', 'Oliveira', '(31) 99876-5432', Genero.masculino, 'men/2', '80000000003', mg('30130010', 'Avenida Afonso Pena', '1500', 'Centro')),
  tutor('ana.costa.mockup@email.com', 'Ana', 'Costa', '(41) 98765-1234', Genero.feminino, 'women/2', '80000000004', pr('80060000', 'Rua XV de Novembro', '800', 'Centro')),
  tutor('carlos.pereira.mockup@email.com', 'Carlos', 'Pereira', '(51) 97654-8901', Genero.masculino, 'men/3', '80000000005', rs('90010270', 'Rua dos Andradas', '1234', 'Centro')),
  tutor('lucia.ferreira.mockup@email.com', 'Lúcia', 'Ferreira', '(11) 98801-1006', Genero.feminino, 'women/3', '80000000006', sp('05422001', 'Rua Harmonia', '412', 'Vila Madalena')),
  tutor('bruno.almeida.mockup@email.com', 'Bruno', 'Almeida', '(19) 98802-1007', Genero.masculino, 'men/4', '80000000007', cidade('SP', 'Campinas', '13015100', 'Rua Barão de Jaguara', '120', 'Centro')),
  tutor('camila.rocha.mockup@email.com', 'Camila', 'Rocha', '(48) 98803-1008', Genero.feminino, 'women/4', '80000000008', cidade('SC', 'Florianópolis', '88015200', 'Rua Felipe Schmidt', '50', 'Centro')),
  tutor('diego.nascimento.mockup@email.com', 'Diego', 'Nascimento', '(71) 98804-1009', Genero.masculino, 'men/5', '80000000009', cidade('BA', 'Salvador', '40020000', 'Avenida Sete de Setembro', '900', 'Centro')),
  tutor('elena.martins.mockup@email.com', 'Elena', 'Martins', '(61) 98805-1010', Genero.feminino, 'women/5', '80000000010', cidade('DF', 'Brasília', '70040902', 'SCS Quadra 2', '18', 'Asa Sul')),
  tutor('felipe.barbosa.mockup@email.com', 'Felipe', 'Barbosa', '(81) 98806-1011', Genero.masculino, 'men/6', '80000000011', cidade('PE', 'Recife', '50030230', 'Rua do Bom Jesus', '210', 'Recife')),
  tutor('helena.dias.mockup@email.com', 'Helena', 'Dias', '(62) 98807-1012', Genero.feminino, 'women/6', '80000000012', cidade('GO', 'Goiânia', '74003100', 'Avenida Goiás', '640', 'Centro'), 0),
]

export const VETERINARIOS: VetDemo[] = [
  veterinario('dra.fernanda.mockup@vetclinic.com', 'Fernanda', 'Rodrigues', '(11) 91234-5678', Genero.feminino, 'women/10', '81000000001', 'SP12345', sp('05402000', 'Rua da Consolação', '3000', 'Consolação'), {
    bio: 'Clínica de pequenos animais há 12 anos. Foco em prevenção, vacinação e acompanhamento de cães idosos.',
    especialidades: ['Clínica Médica de Pequenos Animais', 'Medicina Veterinária Preventiva'],
    planos: ['Porto Seguro Pet', 'SulAmérica Pet'],
    atendeOnline: true,
    atendeDomicilio: true,
    precoConsulta: 180,
    precoOnline: 120,
    creditos: 40,
    planCode: 'pro_plus',
    consultasNoMes: 18,
  }),
  veterinario('dr.ricardo.mockup@petcare.com', 'Ricardo', 'Almeida', '(21) 92345-6789', Genero.masculino, 'men/10', '81000000002', 'RJ23456', rj('22250040', 'Rua Visconde de Pirajá', '500', 'Ipanema'), {
    bio: 'Cirurgião de tecidos moles. Atendo encaminhamentos e faço retorno pós-operatório presencial e online.',
    especialidades: ['Cirurgia de Pequenos Animais', 'Anestesiologia Veterinária'],
    planos: ['SulAmérica Pet', 'Pet Love'],
    atendeOnline: false,
    atendeDomicilio: false,
    precoConsulta: 320,
    precoOnline: 0,
    creditos: 12,
    planCode: 'pro',
    consultasNoMes: 9,
  }),
  veterinario('dra.juliana.mockup@animalsaude.com', 'Juliana', 'Martins', '(31) 93456-7890', Genero.feminino, 'women/11', '81000000003', 'MG34567', mg('30140071', 'Rua da Bahia', '1200', 'Centro'), {
    bio: 'Dermatologia veterinária. Trato alergias, otites de repetição e doenças de pele em cães e gatos.',
    especialidades: ['Dermatologia Veterinária', 'Clínica Médica de Pequenos Animais'],
    planos: ['Porto Seguro Pet'],
    atendeOnline: true,
    atendeDomicilio: false,
    precoConsulta: 220,
    precoOnline: 140,
    creditos: 8,
    planCode: 'pro',
    consultasNoMes: 11,
  }),
  veterinario('dr.gabriel.mockup@vetplus.com', 'Gabriel', 'Ferreira', '(41) 94567-8901', Genero.masculino, 'men/11', '81000000004', 'PR45678', pr('80250030', 'Rua Marechal Deodoro', '630', 'Centro'), {
    bio: 'Cardiologista. Faço eletrocardiograma, ecocardiograma e acompanhamento de sopro e insuficiência.',
    especialidades: ['Cardiologia Veterinária'],
    planos: ['Pet Love', 'Petlove Saúde'],
    atendeOnline: true,
    atendeDomicilio: false,
    precoConsulta: 280,
    precoOnline: 160,
    creditos: 25,
    planCode: 'pro_plus',
    consultasNoMes: 14,
  }),
  veterinario('dra.patricia.mockup@clinicapet.com', 'Patrícia', 'Lima', '(51) 95678-9012', Genero.feminino, 'women/12', '81000000005', 'RS56789', rs('90020090', 'Avenida Borges de Medeiros', '2500', 'Centro'), {
    bio: 'Ortopedia e reabilitação. Atendo claudicação, displasia e pós-operatório de fraturas.',
    especialidades: ['Ortopedia Veterinária', 'Clínica Médica de Pequenos Animais'],
    planos: ['Petlove Saúde', 'Pet Plan'],
    atendeOnline: false,
    atendeDomicilio: true,
    precoConsulta: 260,
    precoOnline: 0,
    creditos: 5,
    planCode: 'pro',
    consultasNoMes: 7,
  }),
  veterinario('dr.henrique.mockup@vetclinic.com', 'Henrique', 'Souza', '(11) 93456-2201', Genero.masculino, 'men/12', '81000000006', 'SP67890', sp('04543011', 'Avenida Brigadeiro Faria Lima', '2012', 'Itaim Bibi'), {
    bio: 'Medicina felina. Consultório separado para gatos, com manejo de baixo estresse.',
    especialidades: ['Medicina Felina', 'Clínica Médica de Pequenos Animais'],
    planos: ['Pet Love', 'Jofi'],
    atendeOnline: true,
    atendeDomicilio: true,
    precoConsulta: 200,
    precoOnline: 130,
    creditos: 15,
    planCode: 'pro_plus',
    consultasNoMes: 16,
  }),
  veterinario('dra.beatriz.mockup@petcare.com', 'Beatriz', 'Campos', '(19) 93456-2202', Genero.feminino, 'women/13', '81000000007', 'SP78901', cidade('SP', 'Campinas', '13010001', 'Rua Dr. Quirino', '880', 'Centro'), {
    bio: 'Oftalmologia. Avaliação de úlcera de córnea, catarata e acompanhamento de glaucoma.',
    especialidades: ['Oftalmologia Veterinária'],
    planos: ['Care pet', 'Eupet'],
    atendeOnline: false,
    atendeDomicilio: false,
    precoConsulta: 300,
    precoOnline: 0,
    creditos: 0,
    planCode: 'pro',
    consultasNoMes: 6,
  }),
  veterinario('dr.marcelo.mockup@animalsaude.com', 'Marcelo', 'Teixeira', '(48) 93456-2203', Genero.masculino, 'men/13', '81000000008', 'SC89012', cidade('SC', 'Florianópolis', '88010400', 'Rua Esteves Júnior', '315', 'Centro'), {
    bio: 'Nutrição clínica. Monto planos para obesidade, doença renal e alergia alimentar.',
    especialidades: ['Nutrição Animal', 'Medicina Veterinária Preventiva'],
    planos: ['Pet Plan', 'Pet top'],
    atendeOnline: true,
    atendeDomicilio: false,
    precoConsulta: 190,
    precoOnline: 150,
    creditos: 20,
    planCode: 'pro',
    consultasNoMes: 10,
  }),
  veterinario('dra.aline.mockup@vetplus.com', 'Aline', 'Moreira', '(71) 93456-2204', Genero.feminino, 'women/14', '81000000009', 'BA90123', cidade('BA', 'Salvador', '40140110', 'Rua da Graça', '140', 'Graça'), {
    bio: 'Oncologia. Conduta para nódulos, quimioterapia e cuidado paliativo com a família.',
    especialidades: ['Oncologia Veterinária', 'Clínica Médica de Pequenos Animais'],
    planos: ['Porto Seguro Pet', 'Petlove Saúde'],
    atendeOnline: true,
    atendeDomicilio: false,
    precoConsulta: 350,
    precoOnline: 180,
    creditos: 30,
    planCode: 'pro_plus',
    consultasNoMes: 8,
  }),
  veterinario('dr.thiago.mockup@clinicapet.com', 'Thiago', 'Ramos', '(61) 93456-2205', Genero.masculino, 'men/14', '81000000010', 'DF01234', cidade('DF', 'Brasília', '70297400', 'CLS 202', '12', 'Asa Sul'), {
    bio: 'Urgência e emergência. Plantão para trauma, intoxicação e dispneia.',
    especialidades: ['Medicina Veterinária de Urgência e Emergência', 'Medicina Veterinária Intensiva'],
    planos: ['Jofi', 'Eupet'],
    atendeOnline: false,
    atendeDomicilio: true,
    precoConsulta: 240,
    precoOnline: 0,
    creditos: 3,
    planCode: 'pro',
    consultasNoMes: 22,
  }),
]

export const CLINICAS: ClinicaDemo[] = [
  {
    email: 'contato@petcenter.mockup.com',
    nome: 'Pet Center',
    sobrenome: 'Indaiatuba',
    celular: '(19) 3875-1234',
    portrait: foto('women/20'),
    nomeClinica: 'Pet Center Centro Veterinário',
    tipoClinica: TipoClinica.multipla,
    quantidadeVets: '5-10',
    razaoSocial: 'Pet Center LTDA',
    cnpj: '12.345.678/0001-90',
    endereco: 'Rua Pedro de Toledo, 1200',
    cep: '13330000',
    cidade: 'Indaiatuba',
    estado: 'SP',
    telefone: '(19) 3875-1234',
    whatsapp: '(19) 98765-4321',
    latitude: '-23.0884',
    longitude: '-47.2110',
    planCode: 'clinic_pro',
    especialidades: ['Clínica Médica de Pequenos Animais', 'Cirurgia de Pequenos Animais', 'Ortopedia Veterinária'],
    planos: ['Porto Seguro Pet', 'Pet Love', 'Jofi', 'Care pet'],
    diferenciais: ['Estacionamento', 'Internação', 'Exames de imagem', 'Farmácia', 'Acessibilidade'],
    sobre: 'Referência em medicina veterinária em Indaiatuba, com equipe multidisciplinar, centro cirúrgico e internação.',
    descricao: 'Centro veterinário completo com especialidades, cirurgias e internação.',
  },
  {
    email: 'contato@vilaanimal.mockup.com',
    nome: 'Vila Animal',
    sobrenome: 'Pinheiros',
    celular: '(11) 3090-2210',
    portrait: foto('men/20'),
    nomeClinica: 'Vila Animal Pinheiros',
    tipoClinica: TipoClinica.multipla,
    quantidadeVets: '2-5',
    razaoSocial: 'Vila Animal Serviços Veterinários LTDA',
    cnpj: '23.456.789/0001-10',
    endereco: 'Rua dos Pinheiros, 840',
    cep: '05422001',
    cidade: 'São Paulo',
    estado: 'SP',
    telefone: '(11) 3090-2210',
    whatsapp: '(11) 98800-2210',
    latitude: '-23.5671',
    longitude: '-46.6912',
    planCode: 'clinic',
    especialidades: ['Medicina Felina', 'Dermatologia Veterinária', 'Nutrição Animal'],
    planos: ['SulAmérica Pet', 'Petlove Saúde', 'Pet Plan'],
    diferenciais: ['Atendimento felino', 'Banho e tosa', 'Wi-Fi', 'Acessibilidade'],
    sobre: 'Clínica de bairro em Pinheiros, com consultório exclusivo para gatos e nutricionista na equipe.',
    descricao: 'Clínica de pequenos animais com foco em felinos e dermatologia.',
  },
  {
    email: 'contato@litoralpets.mockup.com',
    nome: 'Litoral Pets',
    sobrenome: 'Copacabana',
    celular: '(21) 2548-7700',
    portrait: foto('women/21'),
    nomeClinica: 'Litoral Pets Copacabana',
    tipoClinica: TipoClinica.solo,
    quantidadeVets: '1',
    razaoSocial: 'Litoral Pets ME',
    cnpj: '34.567.890/0001-21',
    endereco: 'Rua Barata Ribeiro, 500',
    cep: '22040002',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    telefone: '(21) 2548-7700',
    whatsapp: '(21) 98811-7700',
    latitude: '-22.9642',
    longitude: '-43.1763',
    planCode: 'starter',
    especialidades: ['Clínica Médica de Pequenos Animais', 'Medicina Veterinária de Urgência e Emergência'],
    planos: ['Pet Love', 'Eupet'],
    diferenciais: ['Atendimento 24h', 'Estacionamento', 'Farmácia'],
    sobre: 'Pronto atendimento no litoral, com farmácia própria e estabilização de emergência.',
    descricao: 'Pronto-socorro veterinário com consulta clínica e emergência.',
  },
]

export const PETS: Record<string, { nome: string; especie: string; raca: string; idade: number; porte: Porte }[]> = {
  'joao.silva.mockup@email.com': [
    { nome: 'Thor', especie: 'Cão', raca: 'Golden Retriever', idade: 4, porte: Porte.grande },
    { nome: 'Luna', especie: 'Cão', raca: 'SRD', idade: 2, porte: Porte.medio },
  ],
  'maria.santos.mockup@email.com': [
    { nome: 'Mel', especie: 'Gato', raca: 'Siamês', idade: 3, porte: Porte.pequeno },
    { nome: 'Nina', especie: 'Gato', raca: 'Persa', idade: 6, porte: Porte.pequeno },
  ],
  'pedro.oliveira.mockup@email.com': [
    { nome: 'Bob', especie: 'Cão', raca: 'Bulldog Francês', idade: 5, porte: Porte.pequeno },
    { nome: 'Pipoca', especie: 'Cão', raca: 'Poodle', idade: 8, porte: Porte.pequeno },
  ],
  'ana.costa.mockup@email.com': [
    { nome: 'Fred', especie: 'Cão', raca: 'Labrador', idade: 1, porte: Porte.grande },
    { nome: 'Amora', especie: 'Gato', raca: 'SRD', idade: 2, porte: Porte.pequeno },
  ],
  'carlos.pereira.mockup@email.com': [
    { nome: 'Duque', especie: 'Cão', raca: 'Pastor Alemão', idade: 7, porte: Porte.grande },
    { nome: 'Lola', especie: 'Cão', raca: 'Shih Tzu', idade: 4, porte: Porte.pequeno },
  ],
  'lucia.ferreira.mockup@email.com': [
    { nome: 'Simba', especie: 'Gato', raca: 'Maine Coon', idade: 3, porte: Porte.medio },
    { nome: 'Bilu', especie: 'Cão', raca: 'Beagle', idade: 2, porte: Porte.medio },
  ],
  'bruno.almeida.mockup@email.com': [
    { nome: 'Max', especie: 'Cão', raca: 'Border Collie', idade: 3, porte: Porte.medio },
    { nome: 'Kika', especie: 'Gato', raca: 'SRD', idade: 1, porte: Porte.pequeno },
  ],
  'camila.rocha.mockup@email.com': [
    { nome: 'Paçoca', especie: 'Cão', raca: 'Dachshund', idade: 6, porte: Porte.pequeno },
    { nome: 'Otto', especie: 'Cão', raca: 'Husky Siberiano', idade: 2, porte: Porte.grande },
  ],
  'diego.nascimento.mockup@email.com': [
    { nome: 'Zeus', especie: 'Cão', raca: 'Rottweiler', idade: 5, porte: Porte.grande },
    { nome: 'Mimi', especie: 'Gato', raca: 'Angorá', idade: 4, porte: Porte.pequeno },
  ],
  'elena.martins.mockup@email.com': [
    { nome: 'Flor', especie: 'Gato', raca: 'SRD', idade: 9, porte: Porte.pequeno },
    { nome: 'Toby', especie: 'Cão', raca: 'Cocker Spaniel', idade: 3, porte: Porte.medio },
  ],
  'felipe.barbosa.mockup@email.com': [
    { nome: 'Rex', especie: 'Cão', raca: 'Pit Bull', idade: 4, porte: Porte.grande },
    { nome: 'Chanel', especie: 'Cão', raca: 'Yorkshire', idade: 6, porte: Porte.pequeno },
  ],
  'helena.dias.mockup@email.com': [
    { nome: 'Bolota', especie: 'Cão', raca: 'SRD', idade: 2, porte: Porte.medio },
    { nome: 'Frida', especie: 'Gato', raca: 'SRD', idade: 5, porte: Porte.pequeno },
  ],
}

export const PRESTADORES: PrestadorDemo[] = [
  {
    email: 'tosa.bianca.mockup@email.com',
    nome: 'Bianca',
    sobrenome: 'Tosa',
    celular: '11988887771',
    portrait: foto('women/31'),
    cpf: '511.222.333-01',
    tipo: 'tosador',
    bio: 'Banho e tosa com produtos hipoalergênicos. Atendo em domicílio com van equipada.',
    raioKm: 10,
    atendeLocalProprio: true,
    servicos: [
      { nome: 'Banho porte pequeno', preco: 60, duracaoMin: 60 },
      { nome: 'Banho e tosa porte médio', preco: 110, duracaoMin: 120 },
    ],
    ...sp('04538133', 'Rua Funchal', '200', 'Vila Olímpia'),
  },
  {
    email: 'passeio.rafael.mockup@email.com',
    nome: 'Rafael',
    sobrenome: 'Passos',
    celular: '21988887772',
    portrait: foto('men/41'),
    cpf: '511.222.333-02',
    tipo: 'passeador',
    bio: 'Passeios individuais ou em dupla, com relatório e fotos ao final.',
    raioKm: 5,
    atendeLocalProprio: false,
    servicos: [
      { nome: 'Passeio 30 min', preco: 30, duracaoMin: 30 },
      { nome: 'Passeio 1 hora', preco: 50, duracaoMin: 60 },
    ],
    ...rj('22290030', 'Rua Voluntários da Pátria', '45', 'Botafogo'),
  },
  {
    email: 'adestra.carla.mockup@email.com',
    nome: 'Carla',
    sobrenome: 'Mendes',
    celular: '31988887773',
    portrait: foto('women/52'),
    cpf: '511.222.333-03',
    tipo: 'adestrador',
    bio: 'Adestramento positivo: obediência básica, passeio sem puxar e socialização.',
    raioKm: 15,
    atendeLocalProprio: false,
    servicos: [{ nome: 'Aula de adestramento', preco: 120, duracaoMin: 60 }],
    ...mg('30130110', 'Avenida Afonso Pena', '1500', 'Centro'),
  },
  {
    email: 'sitter.lucas.mockup@email.com',
    nome: 'Lucas',
    sobrenome: 'Ferraz',
    celular: '41988887774',
    portrait: foto('men/63'),
    cpf: '511.222.333-04',
    tipo: 'pet_sitter',
    bio: 'Hospedagem em casa com quintal, um pet por vez, com atualização diária.',
    raioKm: 20,
    atendeLocalProprio: true,
    servicos: [{ nome: 'Diária de hospedagem', preco: 90, duracaoMin: null }],
    ...pr('80250104', 'Rua Comendador Araújo', '300', 'Centro'),
  },
]

const COMENTARIOS = [
  'Explicou o diagnóstico com calma e o pet saiu bem.',
  'Pontual, clínica limpa e retorno marcado na hora.',
  'Atendimento cuidadoso. Meu gato, que é arisco, ficou tranquilo.',
  'Consulta objetiva e receita fácil de seguir em casa.',
  'Esperava mais tempo de conversa, mas o exame foi completo.',
  'Ótimo com filhote. Saiu vacinado e com a carteirinha atualizada.',
]

const scrypt = new Scrypt({ cost: 16384, blockSize: 8, parallelization: 1, maxMemory: 33554432 })

function agora() {
  const date = new Date()
  date.setMilliseconds(0)
  return date
}

function motivo(status: string, tipo: string) {
  if (status === 'cancelado') return `consulta ${tipo} cancelada pelo tutor`
  if (status === 'pendente') return `pedido de consulta ${tipo}`
  if (status === 'confirmado') return `consulta ${tipo} confirmada`
  return `consulta ${tipo} realizada`
}

async function mapaPorNome(
  prisma: PrismaClient,
  tabela: 'especialidade' | 'plano' | 'diferencial',
  nomes: string[]
) {
  const unicos = [...new Set(nomes)]
  const rows =
    tabela === 'especialidade'
      ? await prisma.especialidade.findMany({ where: { nome: { in: unicos } }, select: { id: true, nome: true } })
      : tabela === 'plano'
        ? await prisma.plano.findMany({ where: { name: { in: unicos } }, select: { id: true, name: true } })
        : await prisma.diferencial.findMany({ where: { nome: { in: unicos } }, select: { id: true, nome: true } })
  const map = new Map(rows.map((row) => [('nome' in row ? row.nome : row.name) as string, row.id]))
  const faltando = unicos.filter((nome) => !map.has(nome))
  if (faltando.length) throw new Error(`Catálogo ausente em ${tabela}: ${faltando.join(', ')}`)
  return map
}

async function usuario(
  prisma: PrismaClient,
  seed: { email: string; nome: string; sobrenome: string; celular: string; cep: string; rua: string; numero: string; bairro: string; cidade: string; estado: string; portrait: string; whatsappOptIn?: number },
  userType: UserType,
  senhaHash: string
) {
  const existing = await prisma.user.findUnique({ where: { email: seed.email } })
  if (existing) return existing
  const quando = agora()
  return prisma.user.create({
    data: {
      id: randomUUID(),
      email: seed.email,
      password: senhaHash,
      userType,
      nome: seed.nome,
      sobrenome: seed.sobrenome,
      celular: seed.celular,
      cep: seed.cep,
      rua: seed.rua,
      numero: seed.numero,
      bairro: seed.bairro,
      cidade: seed.cidade,
      estado: seed.estado,
      ativo: 1,
      isEmailVerified: 1,
      profilePic: seed.portrait,
      notificarWhatsapp: seed.whatsappOptIn ?? 1,
      createdAt: quando,
      updatedAt: quando,
    },
  })
}

export async function seedDemonstracao(prisma: PrismaClient) {
  const senhaHash = await scrypt.make(SENHA_DEMO)
  const quando = agora()
  const especialidadeId = await mapaPorNome(prisma, 'especialidade', [
    ...VETERINARIOS.flatMap((item) => item.especialidades),
    ...CLINICAS.flatMap((item) => item.especialidades),
  ])
  const planoId = await mapaPorNome(prisma, 'plano', [
    ...VETERINARIOS.flatMap((item) => item.planos),
    ...CLINICAS.flatMap((item) => item.planos),
  ])
  const diferencialId = await mapaPorNome(prisma, 'diferencial', CLINICAS.flatMap((item) => item.diferenciais))

  const tutores = []
  for (const seed of TUTORES) {
    const user = await usuario(prisma, seed, UserType.tutor, senhaHash)
    let tutorRow = await prisma.tutor.findFirst({ where: { userId: user.id } })
    if (!tutorRow) {
      tutorRow = await prisma.tutor.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          cpf: seed.cpf,
          genero: seed.genero,
          createdAt: quando,
          updatedAt: quando,
        },
      })
    }
    tutores.push({ seed, user, tutor: tutorRow })
  }

  const veterinarios = []
  for (const seed of VETERINARIOS) {
    const user = await usuario(prisma, seed, UserType.veterinario, senhaHash)
    let vet = await prisma.veterinario.findFirst({ where: { userId: user.id } })
    if (!vet) {
      vet = await prisma.veterinario.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          cpf: seed.cpf,
          crmv: seed.crmv,
          genero: seed.genero,
          bio: seed.bio,
          fotoUrl: seed.portrait,
          atendePresencial: 1,
          atendeOnline: seed.atendeOnline ? 1 : 0,
          atendeDomicilio: seed.atendeDomicilio ? 1 : 0,
          precoConsulta: seed.precoConsulta,
          precoConsultaOnline: seed.atendeOnline ? seed.precoOnline : null,
          horariosOnline: seed.atendeOnline ? AGENDA_ONLINE : undefined,
          creditos: seed.creditos,
          onboardingComplete: 1,
          isVerified: 1,
          onboardingStep: 7,
          subscriptionPlanCode: seed.planCode,
          monthlyAppointmentsUsed: seed.consultasNoMes,
          monthlyAppointmentsResetAt: quando,
          createdAt: quando,
          updatedAt: quando,
        },
      })
    }

    for (const nome of seed.especialidades) {
      await prisma.especialidadeRelacionamento.upsert({
        where: {
          entidadeId_especialidadeId_entidadeTipo: {
            entidadeId: vet.id,
            especialidadeId: especialidadeId.get(nome)!,
            entidadeTipo: 'veterinario',
          },
        },
        create: {
          entidadeId: vet.id,
          especialidadeId: especialidadeId.get(nome)!,
          entidadeTipo: 'veterinario',
          ativo: 1,
          createdAt: quando,
          updatedAt: quando,
        },
        update: { ativo: 1 },
      })
    }
    for (const nome of seed.planos) {
      await prisma.veterinarioPlano.upsert({
        where: { veterinarioId_planoId: { veterinarioId: vet.id, planoId: planoId.get(nome)! } },
        create: { veterinarioId: vet.id, planoId: planoId.get(nome)!, createdAt: quando, updatedAt: quando },
        update: {},
      })
    }

    const endereco = await prisma.veterinarioEndereco.findFirst({ where: { veterinarioId: vet.id, isPrimary: 1 } })
    const enderecoData = {
      rua: seed.rua,
      numero: seed.numero,
      bairro: seed.bairro,
      cidade: seed.cidade,
      estado: seed.estado,
      cep: seed.cep,
      complemento: 'Sala 1',
      horariosDisponibilidade: AGENDA,
      precoConsulta: seed.precoConsulta,
      aceitaEmergencia: seed.especialidades.some((nome) => nome.includes('Urgência')) ? 1 : 0,
      nomeClinica: `Consultório ${seed.nome} ${seed.sobrenome}`,
      ativo: 1,
      isPrimary: 1,
      updatedAt: agora(),
    }
    if (endereco) {
      await prisma.veterinarioEndereco.update({ where: { id: endereco.id }, data: enderecoData })
    } else {
      await prisma.veterinarioEndereco.create({
        data: { id: randomUUID(), veterinarioId: vet.id, ...enderecoData, createdAt: quando },
      })
    }

    const experiencias = [
      {
        local: `Hospital Veterinário ${seed.cidade}`,
        cargo: 'Veterinário clínico',
        dataInicio: new Date('2016-03-01T00:00:00.000Z'),
        dataFim: new Date('2021-12-01T00:00:00.000Z'),
        descricao: `Atendimento ambulatorial e retornos em ${seed.cidade}.`,
      },
      {
        local: seed.planos[0],
        cargo: 'Credenciado',
        dataInicio: new Date('2022-01-10T00:00:00.000Z'),
        dataFim: null,
        descricao: 'Atendimento de beneficiários do plano e emissão de laudos.',
      },
    ]
    for (const item of experiencias) {
      const existing = await prisma.experienciaVeterinario.findFirst({
        where: { veterinarioId: vet.id, local: item.local, cargo: item.cargo },
      })
      if (existing) continue
      await prisma.experienciaVeterinario.create({
        data: { id: randomUUID(), veterinarioId: vet.id, ...item, ativo: 1, createdAt: quando, updatedAt: quando },
      })
    }
    veterinarios.push({ seed, user, veterinario: vet })
  }

  const clinicas = []
  for (const [index, seed] of CLINICAS.entries()) {
    const user = await usuario(
      prisma,
      { ...seed, rua: seed.endereco, numero: 's/n', bairro: 'Centro' },
      UserType.clinica,
      senhaHash
    )
    let clinica = await prisma.clinica.findFirst({ where: { userId: user.id } })
    if (!clinica) {
      clinica = await prisma.clinica.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          nomeClinica: seed.nomeClinica,
          tipoClinica: seed.tipoClinica,
          quantidadeVets: seed.quantidadeVets,
          razaoSocial: seed.razaoSocial,
          cnpj: seed.cnpj,
          endereco: seed.endereco,
          cep: seed.cep,
          cidade: seed.cidade,
          estado: seed.estado,
          latitude: seed.latitude,
          longitude: seed.longitude,
          telefone: seed.telefone,
          whatsapp: seed.whatsapp,
          horariosFuncionamento: {
            segunda: '08:00-18:00',
            terca: '08:00-18:00',
            quarta: '08:00-18:00',
            quinta: '08:00-18:00',
            sexta: '08:00-18:00',
            sabado: '08:00-12:00',
            domingo: 'Fechado',
          },
          comodidades: { estacionamento: true, acessibilidade: true, wifi: true },
          sobre: seed.sobre,
          descricao: seed.descricao,
          onboardingComplete: 1,
          isVerified: 1,
          subscriptionPlanCode: seed.planCode,
          createdAt: quando,
          updatedAt: quando,
        },
      })
    }

    for (const nome of seed.especialidades) {
      await prisma.especialidadeRelacionamento.upsert({
        where: {
          entidadeId_especialidadeId_entidadeTipo: {
            entidadeId: clinica.id,
            especialidadeId: especialidadeId.get(nome)!,
            entidadeTipo: 'clinica',
          },
        },
        create: {
          entidadeId: clinica.id,
          especialidadeId: especialidadeId.get(nome)!,
          entidadeTipo: 'clinica',
          ativo: 1,
          createdAt: quando,
          updatedAt: quando,
        },
        update: { ativo: 1 },
      })
    }
    for (const nome of seed.planos) {
      await prisma.clinicaPlano.upsert({
        where: { clinicaId_planoId: { clinicaId: clinica.id, planoId: planoId.get(nome)! } },
        create: { clinicaId: clinica.id, planoId: planoId.get(nome)!, createdAt: quando, updatedAt: quando },
        update: {},
      })
    }
    for (const nome of seed.diferenciais) {
      await prisma.clinicaDiferencial.upsert({
        where: { clinicaId_diferencialId: { clinicaId: clinica.id, diferencialId: diferencialId.get(nome)! } },
        create: {
          clinicaId: clinica.id,
          diferencialId: diferencialId.get(nome)!,
          ativo: 1,
          createdAt: quando,
          updatedAt: quando,
        },
        update: { ativo: 1 },
      })
    }

    const equipe = veterinarios.filter((_, vetIndex) => vetIndex % CLINICAS.length === index)
    for (const membro of equipe) {
      await prisma.veterinarioClinica.upsert({
        where: { veterinarioId_clinicaId: { veterinarioId: membro.veterinario.id, clinicaId: clinica.id } },
        create: {
          veterinarioId: membro.veterinario.id,
          clinicaId: clinica.id,
          ativo: 1,
          status: 'aceito',
          createdAt: quando,
          updatedAt: quando,
        },
        update: {},
      })
    }
    clinicas.push({ seed, user, clinica, equipe })
  }

  const pendente = veterinarios[1]
  const clinicaPendente = clinicas[2]
  if (pendente && clinicaPendente) {
    await prisma.veterinarioClinica.upsert({
      where: {
        veterinarioId_clinicaId: {
          veterinarioId: pendente.veterinario.id,
          clinicaId: clinicaPendente.clinica.id,
        },
      },
      create: {
        veterinarioId: pendente.veterinario.id,
        clinicaId: clinicaPendente.clinica.id,
        ativo: 1,
        status: 'pendente',
        createdAt: quando,
        updatedAt: quando,
      },
      update: {},
    })
  }

  const pets = new Map<string, { id: string; nome: string }[]>()
  for (const item of tutores) {
    const lista = []
    for (const petSeed of PETS[item.seed.email]) {
      let pet = await prisma.pet.findFirst({ where: { tutorId: item.tutor.id, nome: petSeed.nome } })
      if (!pet) {
        pet = await prisma.pet.create({
          data: {
            id: randomUUID(),
            tutorId: item.tutor.id,
            ...petSeed,
            createdAt: quando,
            updatedAt: quando,
          },
        })
      }
      lista.push(pet)
    }
    pets.set(item.tutor.id, lista)
  }

  const clinicaPorVet = new Map<string, (typeof clinicas)[number]>()
  for (const clinica of clinicas) {
    for (const membro of clinica.equipe) clinicaPorVet.set(membro.veterinario.id, clinica)
  }

  const hoje = DateTime.utc().startOf('day')
  const horarios = ['08:00', '09:00', '10:00', '14:00', '15:00', '16:00']
  let agendamentos = 0
  let avaliacoes = 0
  let prontuarios = 0

  for (const [tutorIndex, item] of tutores.entries()) {
    const petsDoTutor = pets.get(item.tutor.id) ?? []
    for (let slot = 0; slot < 3; slot++) {
      const vetItem = veterinarios[(tutorIndex + slot) % veterinarios.length]
      const pet = petsDoTutor[slot % petsDoTutor.length]
      const ciclo = (tutorIndex + slot) % 5
      const status = ciclo === 0 ? 'cancelado' : ciclo === 1 ? 'pendente' : ciclo === 2 ? 'confirmado' : 'realizado'
      const tipo = vetItem.seed.atendeOnline && slot === 1 ? 'online' : vetItem.seed.atendeDomicilio && slot === 2 ? 'domicilio' : 'presencial'
      const dias = status === 'realizado' || status === 'cancelado' ? -(tutorIndex + slot + 1) : tutorIndex + slot + 1
      const clinica = tipo === 'presencial' ? clinicaPorVet.get(vetItem.veterinario.id) : undefined
      const observacoes = `${pet.nome}: ${motivo(status, tipo)} (${item.seed.email} #${slot})`
      const dataConsulta = hoje.plus({ days: dias }).toISODate()!
      const inicio = hoje.plus({ days: dias }).plus({ hours: 8 }).toJSDate()
      inicio.setMilliseconds(0)

      let agendamento = await prisma.agendamento.findFirst({ where: { observacoes } })
      if (!agendamento) {
        agendamento = await prisma.agendamento.create({
          data: {
            id: randomUUID(),
            tutorId: item.tutor.id,
            veterinarioId: vetItem.veterinario.id,
            petId: pet.id,
            clinicaId: clinica?.clinica.id ?? null,
            dataConsulta,
            horarioConsulta: horarios[(tutorIndex + slot) % horarios.length],
            status,
            tipoConsulta: tipo,
            precoConsulta: tipo === 'online' ? vetItem.seed.precoOnline : vetItem.seed.precoConsulta,
            observacoes,
            localNome: clinica?.seed.nomeClinica ?? (tipo === 'online' ? 'Teleconsulta' : tipo === 'domicilio' ? 'Domicílio' : 'Consultório'),
            localEndereco: clinica?.seed.endereco ?? `${vetItem.seed.rua}, ${vetItem.seed.numero}`,
            paymentStatus: status === 'realizado' || status === 'confirmado' ? 'paid' : 'unpaid',
            confirmadoEm: status === 'confirmado' || status === 'realizado' ? dataConsulta : null,
            canceladoEm: status === 'cancelado' ? dataConsulta : null,
            motivoCancelamento: status === 'cancelado' ? 'Tutor precisou remarcar' : null,
            startedAt: status === 'realizado' ? inicio : null,
            endedAt: status === 'realizado' ? new Date(inicio.getTime() + 30 * 60 * 1000) : null,
            createdAt: quando,
            updatedAt: quando,
          },
        })
      }
      agendamentos++

      if (status === 'realizado') {
        const avaliacao = await prisma.avaliacao.findUnique({ where: { agendamentoId: agendamento.id } })
        if (!avaliacao) {
          await prisma.avaliacao.create({
            data: {
              id: randomUUID(),
              agendamentoId: agendamento.id,
              tutorId: item.tutor.id,
              veterinarioId: vetItem.veterinario.id,
              clinicaId: clinica?.clinica.id ?? null,
              estrelas: 3 + ((tutorIndex + slot) % 3),
              comentario: COMENTARIOS[(tutorIndex + slot) % COMENTARIOS.length],
              estrelasClinica: clinica ? 4 + (slot % 2) : null,
              comentarioClinica: clinica ? 'Recepção organizada e pouco tempo de espera.' : null,
              createdAt: quando,
              updatedAt: quando,
            },
          })
        }
        avaliacoes++

        const registro = await prisma.registroClinico.findUnique({ where: { agendamentoId: agendamento.id } })
        if (!registro) {
          await prisma.registroClinico.create({
            data: {
              id: randomUUID(),
              agendamentoId: agendamento.id,
              petId: pet.id,
              veterinarioId: vetItem.veterinario.id,
              queixa: `${pet.nome}: ${tipo === 'online' ? 'orientação à distância' : 'exame presencial'}.`,
              diagnostico: slot % 2 === 0 ? 'Quadro estável, sem achados agudos.' : 'Otite externa leve.',
              tratamento: slot % 2 === 0 ? 'Manter prevenção e retorno em 6 meses.' : 'Limpeza otológica e anti-inflamatório por 7 dias.',
              pesoKg: 4 + ((tutorIndex + slot) % 28),
              vacinasMedicacoes: slot % 2 === 0 ? 'Antirrábica em dia.' : 'Sem vacina nesta visita.',
              retornoSugerido: hoje.plus({ days: 30 }).toISODate(),
              planoSaude: vetItem.seed.planos[0],
              encaminhamento: slot === 2 ? 'Encaminhado para retorno com especialista se não melhorar.' : null,
              createdAt: quando,
              updatedAt: quando,
            },
          })
          prontuarios++
        }
      }
    }
  }

  const primeiraRealizada = await prisma.agendamento.findFirst({
    where: { status: 'realizado', veterinarioId: { not: null }, observacoes: { contains: 'mockup' } },
    orderBy: { dataConsulta: 'desc' },
  })
  if (primeiraRealizada?.veterinarioId) {
    const nota = await prisma.agendamentoAnotacao.findUnique({ where: { agendamentoId: primeiraRealizada.id } })
    if (!nota) {
      await prisma.agendamentoAnotacao.create({
        data: {
          id: randomUUID(),
          agendamentoId: primeiraRealizada.id,
          veterinarioId: primeiraRealizada.veterinarioId,
          localAtendimento: primeiraRealizada.localNome ?? 'Consultório',
          statusPagamento: 'pago',
          formaPagamento: 'pix',
          observacoes: 'Tutor pagou no PIX ao final. Pet colaborou bem no exame.',
          createdAt: quando,
          updatedAt: quando,
        },
      })
    }
  }

  const plantonista = veterinarios.find((item) => item.seed.crmv === 'DF01234')
  if (plantonista) {
    const motivoBloqueio = 'Quinta à tarde em plantão externo (demonstração)'
    const bloqueio = await prisma.bloqueioAgenda.findFirst({
      where: { veterinarioId: plantonista.veterinario.id, motivo: motivoBloqueio },
    })
    if (!bloqueio) {
      await prisma.bloqueioAgenda.create({
        data: {
          id: randomUUID(),
          veterinarioId: plantonista.veterinario.id,
          dataInicio: hoje.toISODate()!,
          recorrente: 1,
          diasSemana: [4],
          horarios: ['14:00', '14:30', '15:00', '15:30', '16:00'],
          motivo: motivoBloqueio,
          createdAt: quando,
          updatedAt: quando,
        },
      })
    }
  }

  let favoritos = 0
  for (const [index, item] of tutores.entries()) {
    for (const vetItem of [veterinarios[index % veterinarios.length], veterinarios[(index + 3) % veterinarios.length]]) {
      const existing = await prisma.favorite.findFirst({
        where: { tutorId: item.tutor.id, veterinarioId: vetItem.veterinario.id },
      })
      if (!existing) {
        await prisma.favorite.create({
          data: {
            id: randomUUID(),
            tutorId: item.tutor.id,
            veterinarioId: vetItem.veterinario.id,
            createdAt: quando,
            updatedAt: quando,
          },
        })
      }
      favoritos++
    }
    const clinica = clinicas[index % clinicas.length]
    const favClinica = await prisma.favorite.findFirst({
      where: { tutorId: item.tutor.id, clinicaId: clinica.clinica.id },
    })
    if (!favClinica) {
      await prisma.favorite.create({
        data: {
          id: randomUUID(),
          tutorId: item.tutor.id,
          clinicaId: clinica.clinica.id,
          createdAt: quando,
          updatedAt: quando,
        },
      })
    }
    favoritos++
  }

  const avisos: [string, string, string][] = [
    ['NOVO_AGENDAMENTO', 'Consulta confirmada', 'A consulta de um dos pets foi confirmada.'],
    ['LEMBRETE', 'Consulta amanhã', 'Lembre de levar a carteira de vacinação.'],
  ]
  const avisosVet: [string, string, string][] = [
    ['NOVO_AGENDAMENTO', 'Novo agendamento', 'Um tutor pediu horário na sua agenda.'],
    ['VINCULO_CLINICA_SOLICITADO', 'Vínculo com clínica', 'Há uma clínica vinculada ao seu perfil.'],
  ]
  let notificacoes = 0
  for (const item of [...tutores.map((row) => ({ userId: row.user.id, itens: avisos })), ...veterinarios.map((row) => ({ userId: row.user.id, itens: avisosVet }))]) {
    for (const [type, title, message] of item.itens) {
      const existing = await prisma.notification.findFirst({ where: { userId: item.userId, title } })
      if (existing) continue
      await prisma.notification.create({
        data: {
          id: randomUUID(),
          userId: item.userId,
          type,
          title,
          message,
          isRead: 0,
          createdAt: quando,
          updatedAt: quando,
        },
      })
      notificacoes++
    }
  }

  const tipos = new Map(
    (await prisma.tipoServico.findMany({ select: { id: true, slug: true, modalidade: true } })).map((t) => [t.slug, t])
  )
  let prestadores = 0
  for (const [index, seed] of PRESTADORES.entries()) {
    const tipo = tipos.get(seed.tipo)
    if (!tipo) throw new Error(`Catálogo ausente em tipos_servico: ${seed.tipo}`)
    const user = await usuario(prisma, seed, UserType.prestador, senhaHash)
    let prestador = await prisma.prestador.findFirst({ where: { userId: user.id } })
    if (!prestador) {
      prestador = await prisma.prestador.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          tipoServicoId: tipo.id,
          cpf: seed.cpf,
          bio: seed.bio,
          fotoUrl: seed.portrait,
          atendeDomicilio: 1,
          atendeLocalProprio: seed.atendeLocalProprio ? 1 : 0,
          raioKm: seed.raioKm,
          horarios: HORARIOS_PRESTADOR,
          onboardingStep: 4,
          onboardingComplete: 1,
          subscriptionPlanCode: 'free',
          createdAt: quando,
          updatedAt: quando,
          servicos: {
            create: seed.servicos.map((s) => ({
              id: randomUUID(),
              nome: s.nome,
              preco: s.preco,
              duracaoMin: s.duracaoMin,
              createdAt: quando,
              updatedAt: quando,
            })),
          },
        },
      })
    }
    prestadores++

    const item = tutores[index % tutores.length]
    const pet = pets.get(item.tutor.id)?.[0]
    const servico = await prisma.servicoOferecido.findFirst({ where: { prestadorId: prestador.id } })
    const jaTemPedido = await prisma.agendamento.findFirst({ where: { prestadorId: prestador.id } })
    if (pet && servico && !jaTemPedido) {
      const inicio = DateTime.now().setZone('America/Sao_Paulo').plus({ days: 3 + index }).set({ hour: 10, minute: 0, second: 0, millisecond: 0 })
      const fim = servico.duracaoMin ? inicio.plus({ minutes: servico.duracaoMin }) : inicio.plus({ days: 3 })
      const dias = servico.duracaoMin ? 1 : 3
      await prisma.agendamento.create({
        data: {
          id: randomUUID(),
          tutorId: item.tutor.id,
          petId: pet.id,
          prestadorId: prestador.id,
          servicoOferecidoId: servico.id,
          inicioEm: inicio.toUTC().toJSDate(),
          fimEm: fim.toUTC().toJSDate(),
          dataConsulta: inicio.toISODate(),
          horarioConsulta: inicio.toFormat('HH:mm'),
          tipoConsulta: tipo.slug,
          precoConsulta: Number(servico.preco) * dias,
          status: 'pendente',
          observacoes: 'pedido de demonstração',
          createdAt: quando,
          updatedAt: quando,
        },
      })
    }
  }

  const petsTotal = [...pets.values()].reduce((total, lista) => total + lista.length, 0)
  console.log(
    `Demonstração: ${tutores.length} tutores, ${veterinarios.length} veterinários, ${clinicas.length} clínicas, ${prestadores} prestadores, ${petsTotal} pets, ${agendamentos} consultas, ${avaliacoes} avaliações, ${prontuarios} prontuários novos, ${favoritos} favoritos, ${notificacoes} notificações novas. Senha das contas novas: ${SENHA_DEMO}`
  )
}

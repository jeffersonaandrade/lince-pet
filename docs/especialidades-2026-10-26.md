# Complementação do catálogo de especialidades

A migration `20261026120000_complementar_especialidades` completa as 40 opções
do catálogo versionado, incluindo oito opções novas. O seed inclui as mesmas opções para bancos novos.
Não altera IDs, vínculos nem a ativação de registros existentes. Pode ser executada
novamente sem duplicar nomes; ignora diferenças de caixa e espaços nas extremidades.

Em 26/10/2026, o projeto Supabase Lince Pet tinha somente quatro especialidades.
O SQL foi aplicado via MCP: 36 registros inseridos, totalizando 40 opções ativas.
Os quatro IDs existentes foram preservados. A migration Prisma fica idempotente
para o próximo deploy, sem depender do histórico de migrations do Supabase.

## Nomes solicitados já cobertos pelo catálogo

| Solicitação | Nome atual preservado |
| --- | --- |
| Anestesiologia | Anestesiologia Veterinária |
| Cardiologia | Cardiologia Veterinária |
| Clínica Médica de Felinos (Medicina Felina) | Medicina Felina |
| Dermatologia | Dermatologia Veterinária |
| Diagnóstico por Imagem | Diagnóstico por Imagem Veterinária |
| Endocrinologia | Endocrinologia Veterinária |
| Gastroenterologia | Gastrologia Veterinária |
| Hematologia | Hematologia Veterinária |
| Medicina Comportamental | Comportamento animal |
| Medicina de Emergência e Cuidados Intensivos (UTI) | Medicina Veterinária de Urgência e Emergência e Medicina Veterinária Intensiva (opções separadas) |
| Nefrologia e Urologia | Nefrologia e Urologia Veterinárias |
| Neurologia | Neurologia Veterinária |
| Oftalmologia | Oftalmologia Veterinária |
| Oncologia | Oncologia Veterinária |
| Ortopedia | Ortopedia Veterinária |
| Patologia Clínica | Patologia clínica veterinária |

Anestesiologia foi enviada duas vezes. Fisioterapia fica representada por
Fisioterapia e Reabilitação. Nutrologia foi adicionada separadamente de Nutrição
Animal; Cirurgia Geral (Tecidos Moles), separadamente das cirurgias por porte;
Acupuntura e Medicina Integrativa, separadamente de Acupuntura Veterinária.
Esses agrupamentos não são tratados automaticamente como sinônimos.

## Aplicação e verificação

Aplicar pelo fluxo normal `prisma migrate deploy`, ou executar o SQL da migration
no projeto Supabase correto. Não executar o seed inteiro em produção apenas para
incluir especialidades: ele também mantém outros catálogos.

A inclusão de um nome no catálogo não comprova título de especialista.
Validar com a responsável veterinária a nomenclatura exibida e os critérios de
comprovação antes de apresentar os profissionais como especialistas verificados.

## Administração

Implementado `/admin/especialidades`: listar, buscar, criar, editar, inativar e
reativar, com permissão de administrador no servidor e na API. Nenhuma exclusão
física pelo CRUD. Nomes duplicados por caixa ou espaços são recusados, inclusive
entre inativas. Alterações exigem revisão do estado lido; edição desatualizada
retorna 409. Uma trava transacional impede criação concorrente de duplicatas.
O CRUD não implementa um histórico persistente de autoria das alterações.

Inativar preserva os relacionamentos existentes e impede novos vínculos a essa
opção no backend de clínicas e veterinários. A página pública `/servicos` é
revalidada após gravações. Filtros públicos ainda pesquisam pelo nome: URLs antigas
com um nome renomeado não ganham redirecionamento ou sinônimo automaticamente.

A interface mantém navegação, tipografia, cartões e tokens de cor do site.
A orientação permanente do dono de preservar o padrão visual está registrada
nas regras de negócio de `docs/ARQUITETURA.md`.

Exames: já há CRUD de ofertas por clínica em `/dashboard/clinica/exames`.
Um catálogo central seria uma entidade adicional de tipos de exame, referenciada
pelas ofertas; preço, preparo, duração, capacidade e disponibilidade continuam
por clínica. Planejar a migração dos nomes livres existentes antes de exigir esse
vínculo. Essa mudança de modelo não faz parte da complementação de especialidades.

## Validação do CRUD

- 111 testes unitários e de rotas passaram, incluindo regressões de clínicas,
  veterinários e seed.
- `npm run build` passou com TypeScript. Permanecem 45 avisos de lint em código
  existente e três avisos de tracing de arquivos em `notifications.ts`.
- Os quatro cenários de `e2e/admin-especialidades.spec.ts` passaram contra o build
  de produção em banco local: permissões de visitante/tutor, CRUD pela interface
  em desktop/celular, duplicação concorrente/revisão antiga e preservação de
  vínculos com bloqueio de novas associações a inativas.
- Capturas desktop/celular revisadas visualmente. Testes não criaram registros
  no Supabase de produção.

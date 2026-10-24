# Homologação de laboratórios — 24/10/2026

**Resultado:** os fluxos solicitados passaram após corrigir a perda do encaminhamento no link de agendamento. Laboratório usa a conta de clínica e não precisa cadastrar ou vincular veterinários. Para oferecer exames continuam necessários plano de clínica e responsável técnico aprovado, conforme Graphify.

## Método e limites

- Navegador Chromium real via Playwright, aplicação Next.js e PostgreSQL local (`localhost:3000`, banco `127.0.0.1:5433`). Cadastro e onboarding feitos pelas telas, sem criar vínculos de veterinários. Foram usadas contas distintas de laboratório, dois tutores, veterinário e admin.
- Apenas a consulta externa de CEP foi substituída no teste. APIs da aplicação e gravações de exames, agendamentos e encaminhamentos foram reais no banco local.
- O plano do laboratório foi atribuído como pré-condição somente no banco local, após comprovar o bloqueio sem plano. Não houve contratação ou cobrança Asaas nesta rodada; pagamentos foram homologados separadamente.
- MCP autenticado no projeto Supabase `prezaxlfnpzirpbaodns` para verificar o esquema e aplicar a correção de default. Os testes de navegador não criaram contas ou exames nesse banco remoto.

## Cenários aprovados

| Cenário | Evidência |
| --- | --- |
| Cadastro pelo menu “Clínica e laboratório” | Conta criada e onboarding concluído pelas telas |
| Laboratório sem veterinários | Zero vínculos antes/depois dos agendamentos; novos cadastros iniciam `quantidade_vets='0'` |
| Sem plano | Painel oferece planos; tentativa direta de ligar exames responde 403 |
| Catálogo | Hemograma, urinálise e ultrassom com preços, preparos e capacidades independentes |
| Responsável técnico | Catálogo oculto antes da aprovação; admin aprova pela tela e a busca passa a exibi-lo |
| Tutor sem encaminhamento | Dois exames avulsos no mesmo pedido, total R$ 100, confirmado e `veterinario_id` nulo |
| Outro tutor | Reserva outro exame com vaga; exame lotado não oferece horário e forçar pela API responde 409 |
| Veterinário encaminha | Encaminhamento criado durante atendimento, recebido e aceito pelo laboratório sem equipe vinculada |
| Tutor segue o encaminhamento | Perfil → “Agendar exame” preserva encaminhamento e pet; `agendamento_destino_id` gravado no encaminhamento, tipo `exame`, sem veterinário |
| Combos e laudos | Combo com preço próprio, capacidade, realização, PDF e leitura no prontuário por tutor/vet; outro tutor recebe 403 |
| Regressão de encaminhamentos | Aceite, recusa, motivo, prontuário, status e isolamento entre tutores continuaram funcionando |
| Inserção sem plano explícito | PostgreSQL local aplicou o novo default `none` |

## Defeitos corrigidos

1. **Contexto perdido ao agendar exame:** o perfil da clínica recebia `?encaminhamento=...&pet=...`, mas o link de exames apontava somente para `/exames/:id`. A regressão reproduziu a perda da URL antes da correção. Agora a seção recebe e preserva os dois parâmetros; o backend continua exigindo aceite, tutor, pet e destino corretos.
2. **Quantidade fictícia de veterinários:** o cadastro preenchia `quantidade_vets='1'` mesmo sem vínculos. Novas clínicas/laboratórios começam com zero. Registros existentes não foram reescritos.
3. **Default indevido de plano:** Prisma/PostgreSQL usavam `pro` legado ao omitir o plano de um veterinário. A migração `20261024200000_veterinario_plano_padrao_none` altera somente o default para `none`.

O perfil legado remoto de teste manual em produção foi preservado, conforme esclarecimento do dono. Verificação antes/depois pelo MCP confirmou os mesmos IDs e planos; não foi executado `UPDATE` desses perfis. A migração foi registrada nos históricos Supabase e Prisma com checksum `29aeb9c7f2ead4b8d7471ca46e5594060e7e2561aca82f111e32976b7109f509`.

## Verificações

- Quatro testes finais de integração/navegador aprovados, em `laboratorio.spec.ts`, `clinica-exames.spec.ts` e `encaminhamento.spec.ts`.
- Suíte completa: 1.424 testes aprovados; 41 testes de contrato ignorados por dependerem de ambiente próprio.
- TypeScript sem erros. As duas falhas anteriores dos testes Google foram resolvidas corrigindo o hook `beforeEach`, que retornava uma função mock e era executado como cleanup; nenhum comportamento de autenticação da aplicação foi alterado.
- Build aprovado, com 45 avisos de lint e três avisos já existentes do Turbopack sobre acesso dinâmico ao sistema de arquivos em notificações.
- Esquema Supabase: dez tabelas relevantes presentes, RLS habilitado e `agendamentos.veterinario_id` nullable. Default e histórico Prisma conferidos após migração.
- Evidências locais: `reports/laboratorio-e2e-final.log`, `reports/laboratorio-unitarios.log`, `reports/default-none-verified.json` e screenshot `laboratorio-encaminhamento.png` nos resultados do Playwright. Arquivos de sessão e credenciais não entram no Git.

O resultado comprova os cenários acima. Push não confirma conclusão do deploy; as mudanças do front precisam estar no deploy para o comportamento corrigido aparecer no site público.

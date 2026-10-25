# Homologação das regras de negócio — 24/10/2026

**Veredito: VIÁVEL COM RISCOS.** As decisões solicitadas foram implementadas e testadas. Arquivamento protege o histórico na aplicação; prazo de retenção e eliminação definitiva continuam dependendo da política validada pelos responsáveis técnico e jurídico. Esta rodada não declara o produto inteiro homologado em produção.

## Decisões do dono

1. Profissional pet consome o limite no aceite, no mês de Brasília. Pendente não consome. Recusar/cancelar antes do início libera a unidade do mês correspondente. Remarcar libera a reserva anterior e exige novo aceite.
2. Até três pedidos pendentes por tutor para o mesmo profissional, inclusive no Pro.
3. Consulta veterinária agendada só pode ser concluída depois do início com o código do tutor.
4. Recuperação de CNPJ exige análise manual, comprovação de representação, justificativa e administrador identificado. Recupera a conta original e preserva clínica, histórico e plano.
5. O novo e-mail precisa ser confirmado antes da análise. Aprovar invalida senha anterior, sessões, resets antigos, inscrições push e credenciais locais do Google. Redefinir senha é obrigatório antes do acesso, inclusive pelo Google.
6. Havendo referências de cliente/assinatura Asaas, administrador deve conferir/atualizar manualmente o contato de faturamento e registrar a conferência antes de aprovar. O fluxo não altera cobranças nem contatos no provedor automaticamente.
7. Retirar um pet do cadastro ativo arquiva, sem apagar histórico. Pets arquivados continuam no prontuário das pessoas autorizadas, mas não podem receber novos agendamentos ou remarcações. Não foi presumido um prazo legal de retenção.

As decisões estão registradas em `docs/ARQUITETURA.md` e no cache semântico do Graphify.

## Problemas reproduzidos antes da correção

| Reprodução local | Comportamento anterior |
| --- | --- |
| Dois pedidos com apenas uma unidade restante | Ambos respondiam 201; contador terminava em 10 apesar de dois novos pedidos |
| Cancelamento de pedido do mês anterior | Reduzia o contador do mês atual |
| Concluir consulta pendente sem código | Respondia 200, com início e uso do código nulos |
| Excluir pet com registro clínico | Apagava o registro em cascata e removia o vínculo do agendamento com o pet |
| Mesmo CNPJ com/sem máscara | Criava duas clínicas |

Evidência de caracterização: `reports/regras-negocio-diagnostico.log`, somente dados fictícios no PostgreSQL local.

## Implementação e testes de comportamento

| Área | Resultado verificado |
| --- | --- |
| Pendentes e limite | Envio não consome; quarto pendente do tutor/profissional recebe 409 |
| Último aceite | Dois aceites simultâneos: apenas um passa; o outro recebe 403 |
| Cancelamento repetido | Apenas uma requisição cancela; não devolve duas unidades |
| Outro mês | Liberar consumo antigo não reduz o uso real do mês corrente |
| Remarcação | Libera consumo, volta a pendente e consome novamente só após aceite |
| Início versus cancelamento | Corrida testada tanto no prestador quanto no veterinário; só uma transição vence |
| Exames | Dois tutores e pets diferentes disputam a última unidade do plano; um recebe 201 e outro 403. Cancelar permite outro agendamento |
| Conclusão veterinária | Sem início/código recebe 400; com início registra conclusão e término; repetição não duplica a notificação |
| Arquivamento pela tela | Pet sai da lista ativa, histórico continua acessível na seção de arquivados; registro e vínculo permanecem no banco |
| Permissões | Outro tutor continua sem acesso ao prontuário; novo agendamento de pet arquivado é recusado |
| CNPJ canônico | Máscara não permite cadastro duplicado, inclusive por inserção direta no PostgreSQL sem passar pela API (23505) |
| Recuperação pela tela | Solicitação não transfere acesso; e-mail confirmado sozinho também não. Admin precisa registrar comprovação/justificativa e conferência de faturamento |
| Credenciais | Sessão antiga é recusada, senha anterior deixa de funcionar, reset libera o novo login; clínica e plano preservados |
| Revisão e falhas | Token inválido, expirado e reutilizado; usuário sem privilégio; reprovação; pedidos concorrentes; acesso alterado durante análise; e-mail ocupado e falha no envio de redefinição cobertos |

O consumo de prestadores fica registrado no agendamento; a contagem mensal é refeita pelos registros, sob trava por profissional e assinatura. Não depende de subtrair um contador possivelmente desatualizado. A conferência de limite de exames foi movida também para dentro da transação da clínica, preservando os limites existentes de 100/300/ilimitado e o mês da criação.

As jornadas existentes também passaram: exames/combos/laudos, encaminhamentos, cadastro de laboratório sem veterinários, serviços de profissionais pet e consulta completa com prontuário.

## Migrações pelo MCP do Supabase

Projeto: `prezaxlfnpzirpbaodns`. Preflight sem CNPJs normalizados duplicados; não houve mesclagem ou transferência de contas existentes.

| Migração Prisma | SHA-256 conferido no banco |
| --- | --- |
| `20261025010000_protecoes_regras_negocio` | `8322f787e9fdd541efbe3021e52c317c66328925cee966f6b50f4853c8a02f78` |
| `20261025011000_recuperacao_acesso_seguranca` | `927e0c34b761e8e605a93b0476620c2b3dcfde77e1fbb788dc770c634d2d016c` |

Ambas aplicadas por `apply_migration`, com registro Prisma na mesma transação e histórico Supabase confirmado. Verificados: colunas novas, índice único por CNPJ normalizado e RLS de `recuperacoes_cnpj`. A primeira migração adapta o contador de prestadores à nova regra; não altera códigos de plano.

Após aplicação: quatro pets ativos preservados, nenhum reset obrigatório ativado em conta existente, nenhuma solicitação de recuperação criada em produção. Planos de teste existentes preservados: veterinário `pro`, clínica `clinic`, prestadores `pro` e `free`. Os testes funcionais usaram somente banco local; nenhuma recuperação real ou cobrança foi executada no ambiente publicado.

## Verificações e evidências

- Suíte com cobertura: **1.476 aprovados**, **41 ignorados** (contrato entre backends antigo/atual, que depende de ambiente próprio). Meta de 95% por arquivo atendida; serviços com **99,89% das linhas** e **100% das funções** cobertas.
- **14 testes de segurança aprovados.**
- **16 cenários de integração/navegador**, além dos preparativos de autenticação, entre a nova suíte de regras e as cinco suítes de jornadas relacionadas.
- TypeScript sem erros e build aprovado, com 45 avisos de lint e três de tracing já existentes; nenhum aviso novo foi mantido.
- Graphify atualizado por AST e cache semântico das regras. O extrator informou ausência de `tree_sitter_sql`; as migrações foram verificadas diretamente no PostgreSQL/MCP e registradas na arquitetura, sem presumir extração AST de SQL.
- Logs locais em `reports/regras-negocio-cobertura-final.log`, `reports/regras-negocio-seguranca.log`, `reports/regras-negocio-e2e-aceite.log`, `reports/regras-negocio-e2e-jornadas.log`, `reports/regras-negocio-types-final.log` e `reports/regras-negocio-build-final.log`. Verificação remota em `reports/regras-negocio-verificado.json`. Não entram no Git sessões ou credenciais.

## Uso operacional e limites

- Solicitação pública: `/recuperar-clinica`, também vinculada no cadastro de clínica/laboratório. Revisão administrativa: `/admin/recuperacoes`.
- Comprovação é manual: registra-se referência ao protocolo/documentação privada. Não é upload para o bucket público de imagens, nem verificação automática de poderes de representação. E-mail e CNPJ público não substituem comprovação.
- E-mail e WhatsApp de testes usam log. Na confirmação de e-mail da recuperação, o teste substitui a entrega por token conhecido somente no fixture local e exercita a validação real da API. Isso não comprova entregabilidade do provedor real.
- Asaas nesta rodada: referências fictícias para testar a exigência administrativa; nenhuma chamada financeira. A conferência do contato de faturamento é responsabilidade do administrador, conforme decisão do dono.
- Eliminação definitiva e prazo de retenção precisam de política validada. Até lá, o comportamento entregue é arquivamento, sem rotina automática de apagamento.
- Publicar o commit não comprova conclusão do deploy nem substitui o aceite no ambiente publicado.

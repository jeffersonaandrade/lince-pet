# Pendências para fechar a v1 — 27/10/2026

**VIÁVEL COM RISCOS.** Publicação do código não equivale a homologação comercial e operacional da v1. Esta revisão confronta a lista anterior com o código, testes e relatórios existentes; não declara execução de pagamentos reais, restauração de backup ou aprovação jurídica.

## O que ainda falta

| Prioridade | Pendência atual | Critério para fechar |
| --- | --- | --- |
| Bloqueante para cobrar clientes | Pagamentos no ambiente publicado | Conferir ambiente/chave Asaas, webhook autenticado e cron de reconciliação efetivamente em execução. Provar pagamento → acesso ao plano → solicitação de cancelamento → confirmação remota, incluindo recuperação após falha temporária e ausência de cobrança recorrente remanescente. As provas existentes são principalmente de sandbox/local. |
| Bloqueante operacional | Recuperação e alertas | Restaurar backup em ambiente isolado, recuperar banco e arquivos privados, conferir integridade e permissões e registrar tempos/perda aceitáveis. Demonstrar alerta acionável de queda da aplicação, cron parado e cancelamentos/cobranças sem conciliação. Há health check e monitor de capacidade; isso não comprova restauração nem alertas de todos os processos. |
| Bloqueante para lançamento comercial | Operação e política de dados | Nomear responsáveis por CRMV/RT, suporte, reclamações, cobrança e cancelamentos; definir rotinas de atendimento e contingência. Validar termos, privacidade, retenção e eliminação definitiva de prontuários com os responsáveis técnico/jurídico. Não presumir prazo legal nem prometer exclusão imediata. |
| Alta | Regressão E2E completa da candidata | Executar toda a suíte de navegador com banco isolado e expectativas atualizadas ao freemium de 5. As rodadas recentes cobriram contratação/cadastro, exames, encaminhamentos e concorrência da agenda; não equivalem à suíte inteira. Existem expectativas antigas como o default `none` em `e2e/demandas/laboratorio.spec.ts`, enquanto a regra atual é `free`. |
| Alta | Operação do suporte | O dono confirmou `contato@lincepet.com.br`, configurado em `src/config/site.ts` para a página de contato. Falta confirmar recebimento da caixa e responsável/rotina de atendimento. WhatsApp de suporte continua sem número; avisos manuais pelo profissional seguem na v1; automação fica para depois. |
| Alta | Busca e crescimento do catálogo | Corrigir UF minúscula e cidade sem acento, remover os respectivos `test.fail()` após comprovar os resultados e implementar paginação no banco e na interface sem ocultar silenciosamente profissionais. Evidência: `e2e/filtros/explorar.spec.ts` e pendência NV-19 em `docs/CORRECOES-AUDITORIA-SEGURANCA.md`. |
| Alta operacional | Automação da publicação | Configurar `RENDER_API_KEY` e `RENDER_SERVICE_ID` nos secrets corretos do GitHub e demonstrar o job de deploy concluído. Hoje os testes passam, mas esse job falha por ausência dos secrets; a publicação foi executada manualmente pelo conector do Render, com workspace confirmado e revisão do commit implantado. |

## Itens da lista anterior que já têm decisão e implementação

| Item | Situação comprovada |
| --- | --- |
| Cotas e devoluções | Veterinário consome ao reservar; prestador no aceite. Cinco por perfil/mês civil de Brasília. Cancelar antes de iniciar libera uma vez no mês original; concorrência protegida por transação. Testes unitários e PostgreSQL real. |
| Concluir consulta sem início | Recusado sem início com código do tutor. Conclusão repetida não duplica efeitos. Implementação e homologação local documentadas. |
| CNPJ reservado | Recuperação manual pelo admin, com confirmação do novo e-mail, comprovação/justificativa, conferência de faturamento e revogação das credenciais anteriores. Não é transferência automática de conta. |
| Retirar pet | Arquivamento preserva histórico e permissões; pet arquivado não recebe novos agendamentos. Política de retenção e eliminação definitiva ainda precisa de validação operacional/jurídica. |
| Cancelamento Asaas com falha temporária | Fila persistida, estados solicitado/confirmado, retentativa, conciliação e interface implementados; falha real de sandbox e cron concorrente testados. Falta encerrar a homologação na configuração efetivamente publicada. |
| Exames e encaminhamentos | Cadastro da clínica sem equipe, RT aprovado, encaminhamento aceito, vínculo do pet/agendamento, realização e laudo consultado pelo tutor e pelo veterinário testados com frontend, API e PostgreSQL locais reais. Storage de produção e entrega externa não são comprovados pelo driver local. |
| Respostas antigas da disponibilidade | Corrigido no PR #12, commit de produção `3c46fef`. Seis cenários de navegador passaram no site publicado; antes do deploy, cinco reproduziram a falha na versão anterior. |
| Oferta inicial individual | Gratuito com cinco agendamentos e Pro pago. Starter fora de novas adesões; financeiro e retorno do Starter ficam para v2. |

## Fora do escopo da v1 por decisão do dono

- Notificações automáticas por WhatsApp: fora da oferta da v1. Sem promessa nos planos, home, ajuda e textos legais de envio pelo número da Lince Pet. Aviso manual pelo profissional permanece. Features/histórico/opt-out preservados para possível automação na v2.
- Gestão financeira e retorno do Starter: v2, sem preço ou diferenciação futura presumidos.

## Fontes

- `docs/HOMOLOGACAO-REGRAS-DE-NEGOCIO-2026-10-24.md`: decisões, integração e limites da prova local.
- `docs/CORRECAO-CANCELAMENTO-ASAAS-2026-10-24.md`: supera o defeito de cancelamento descrito na homologação Asaas anterior; ainda exige conferir o ambiente publicado.
- `docs/ARQUITETURA.md`: freemium vigente e fluxos administrativos.
- `src/config/site.ts`, `e2e/filtros/explorar.spec.ts`, `e2e/demandas/laboratorio.spec.ts` e `docs/ADMIN-CAPACIDADE.md`: pendências ainda observáveis.

Próxima prioridade: homologar cobrança/webhook/cron no destino e a restauração/alertas, antes de declarar a v1 pronta para venda ampla.

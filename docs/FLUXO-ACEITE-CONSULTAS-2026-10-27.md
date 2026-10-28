# Aceite de consultas — situação encontrada em 27/10/2026

**Decisão posterior do dono, em 27/10/2026:** não exigir aceite ou recusa manual nas consultas veterinárias. A sugestão de generalizar esse fluxo foi descartada. A reserva não deve ser comunicada como “Aguardando confirmação” no WhatsApp. O envio manual é opcional e não altera o status do agendamento.

## Evidências atuais

- `src/app/api/agendamentos/route.ts`: a reserva de consulta é criada como `pendente`.
- `src/server/services/consulta-domicilio.ts`, `aceitarConsultaDomicilio`: o aceite explícito de veterinário é restrito a `tipoConsulta === 'domicilio'`; outros tipos retornam erro.
- `src/app/api/veterinarios/agendamentos/[id]/iniciar/route.ts`: o código pode iniciar consultas em `pendente` ou `confirmado`. Portanto “iniciar atendimento” não comprova um aceite anterior.
- `src/components/Prestador/PainelPedidos.tsx`: pedidos de serviços já oferecem aceite/recusa; esse comportamento não deve ser presumido para todas as consultas veterinárias.
- A reserva de teste `d03b8f3b-a9c7-4df1-9650-5b85cf5467d1` foi consultada novamente: `status=pendente`, `confirmado_em=null`, `started_at=null`. O agente fez a reserva pelo tutor e não aceitou nem iniciou pelo veterinário.
- A mensagem “Agendamento confirmado” após a reserva pelo tutor não representa o aceite pelo profissional; a apresentação precisa acompanhar o fluxo definido.

## Sugestão anterior descartada

A proposta anterior era generalizar aceite/recusa para consultas presenciais/online e exigir aceite antes do início. **Não implementar essa proposta:** o dono decidiu manter a reserva sem essa nova etapa. Na mensagem manual, omitir a linha de situação para os status internos `pendente` e `aguardando`, inclusive variações de caixa/espaços. Preservar informações de cancelamento, realização e demais situações existentes, sem converter pendência em confirmação.

Não migrar status existentes nem alterar cota, pagamento, início por código ou o aceite específico de domicílio para liberar endereço. Pedidos de serviços de prestadores, clínicas e exames mantêm suas próprias regras. Esta correção altera o texto da mensagem manual; não elimina transições de outros fluxos.

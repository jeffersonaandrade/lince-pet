# Aceite de consultas — situação encontrada em 27/10/2026

O fluxo solicitado pelo dono é coerente: tutor solicita → profissional aceita ou recusa → sistema guarda a decisão → profissional pode avisar manualmente pelo WhatsApp. O envio manual não deve alterar o status. Esta nota registra a lacuna; a correção do modal não altera as regras de atendimento.

## Evidências atuais

- `src/app/api/agendamentos/route.ts`: a reserva de consulta é criada como `pendente`.
- `src/server/services/consulta-domicilio.ts`, `aceitarConsultaDomicilio`: o aceite explícito de veterinário é restrito a `tipoConsulta === 'domicilio'`; outros tipos retornam erro.
- `src/app/api/veterinarios/agendamentos/[id]/iniciar/route.ts`: o código pode iniciar consultas em `pendente` ou `confirmado`. Portanto “iniciar atendimento” não comprova um aceite anterior.
- `src/components/Prestador/PainelPedidos.tsx`: pedidos de serviços já oferecem aceite/recusa; esse comportamento não deve ser presumido para todas as consultas veterinárias.
- A reserva de teste `d03b8f3b-a9c7-4df1-9650-5b85cf5467d1` foi consultada novamente: `status=pendente`, `confirmado_em=null`, `started_at=null`. O agente fez a reserva pelo tutor e não aceitou nem iniciou pelo veterinário.
- A mensagem “Agendamento confirmado” após a reserva pelo tutor não representa o aceite pelo profissional; a apresentação precisa acompanhar o fluxo definido.

## Adequação necessária

Generalizar as transições para consultas presenciais/online, definir a atuação da clínica vinculada, registrar recusa/motivo e preservar agenda/cota/notificações com concorrência e idempotência. Se o aceite for obrigatório, o backend também deve impedir início de uma consulta pendente. Diferenciar na interface solicitação, confirmação, recusa, cancelamento e início; gerar a mensagem manual a partir da decisão persistida. Não exigir envio de WhatsApp para efetivar a decisão.

Clínicas e exames têm regras próprias e não recebem essa mudança por inferência. Nenhuma regra de aceite foi alterada nesta correção visual.

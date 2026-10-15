# Lince Pet WhatsApp Gateway

POC de servico separado para envio de WhatsApp transacional por provider nao oficial.

## Veredito

VIAVEL COM RISCOS. Este servico nao torna WhatsApp nao oficial seguro para producao; ele isola o risco operacional fora do app principal e permite medir estabilidade antes de vender o canal ao cliente.

## Arquitetura

- App principal chama este gateway por HTTP interno.
- Gateway valida token, enfileira a mensagem e responde `202`.
- Worker unico consome a fila com timeout, retry e circuit breaker simples.
- Provider inicial:
  - `log`: nao envia; apenas registra.
  - `evolution`: chama Evolution API.

## Endpoints

- `GET /health/live`: processo vivo.
- `GET /health/ready`: configuracao minima pronta.
- `GET /provider/status`: estado do provider.
- `POST /messages`: enfileira mensagem.
- `GET /messages/:id`: consulta status local.
- `POST /webhooks/evolution/messages-upsert`: recebe eventos de mensagem da Evolution API e ignora grupos.

Todos os endpoints, exceto `/health/live`, exigem header:

```http
X-Gateway-Token: <GATEWAY_TOKEN>
```

Payload de envio:

```json
{
  "to": "5581999999999",
  "text": "Mensagem de teste",
  "idempotencyKey": "agendamento-123-confirmacao"
}
```

## Rodar localmente

```bash
npm install
npm run dev
```

## Render

Crie como Web Service separado. Use uma unica instancia. Nao escale horizontalmente enquanto houver um unico numero/sessao.

Variaveis obrigatorias para Evolution:

- `WHATSAPP_PROVIDER=evolution`
- `EVOLUTION_BASE_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`
- `GATEWAY_TOKEN`

## Criterios da POC

- Pareamento funciona com numero real.
- Restart nao exige intervencao manual.
- Servico fica conectado por 7 dias.
- Falhas nao quebram o app principal.
- Mensagens nao duplicam com `idempotencyKey`.
- Logs mostram erro, latencia, tentativa e provider.
- Mensagens de grupo sao ignoradas e nunca geram resposta automatica.

## Limites conhecidos

- Fila e historico sao em memoria nesta POC.
- Restart perde itens pendentes locais.
- Persistencia duravel deve ser adicionada antes de producao real.
- WhatsApp nao oficial pode bloquear numero ou quebrar sem aviso.
- Respostas automaticas futuras devem entrar na mesma fila de envio, com limite de cadencia, nunca responder em massa.

## Autoresposta de teste

Para validar recebimento ponta a ponta, defina `AUTO_REPLY_TEXT`. O gateway responde somente mensagens individuais recebidas de terceiros, ignora grupos e ignora mensagens enviadas pelo proprio numero.

```bash
AUTO_REPLY_TEXT="Recebemos sua mensagem. Este e um teste da Lince Pet."
AUTO_REPLY_COOLDOWN_MS=86400000
```

Em producao, use texto de redirecionamento para o site, nao atendimento:

```text
Olá! Este número é usado apenas para avisos automáticos da Lince Pet.

Para acessar sua conta, agendar, remarcar, cancelar ou usar os canais corretos, acesse:
https://www.lincepet.com.br/

Esta conversa não é monitorada para atendimento.
```

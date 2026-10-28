# Aviso manual por WhatsApp

Disponível nas consultas do veterinário e da clínica, pedidos do prestador e agenda de exames. O destinatário é o telefone cadastrado pelo tutor. O remetente é a conta conectada no dispositivo de quem clica; o portal não escolhe essa conta.

O link `https://wa.me` é acionado diretamente pelo usuário, sem `window.open`, espera de API ou envio automático. A mensagem contém data/hora, situação e local, mais o link fixo para o painel autenticado do tutor. Não contém laudo, nomes de exames, prontuário, códigos de início nem texto de observações. Abrir a conversa não registra envio ou entrega. Opt-out e restrições existentes de telefone são preservados; telefone ausente/incompleto não gera link.

## Validação automatizada

- `npx vitest run`: 1.664 testes aprovados, 48 ignorados (integração/contrato sem ambientes específicos).
- `npx playwright test --config=playwright.whatsapp-manual.config.ts`: 12 testes aprovados, seis Chromium e seis WebKit com perfil iPhone 13. APIs controladas, sem seed, sem alterações no banco e sem mensagens reais.
- Cobertura de navegador: abertura de nova página por clique nos quatro fluxos, telefone do portal, horário de Brasília na virada do dia, link de resultado autenticado, ausência de telefone e opt-out. Verifica ausência de overflow horizontal em viewport de 390 px.
- O destino externo é interceptado para verificar a abertura sem acessar uma conta real de WhatsApp. Esse teste comprova o acionamento do link pelo navegador; não comprova a transição para o aplicativo instalado no iOS nem a entrega da mensagem.

## Homologação em iPhone físico

Pendente: abrir um agendamento na conta do veterinário de teste pelo Safari, tocar em “Avisar tutor pelo WhatsApp”, conferir telefone, mensagem e conta remetente, e confirmar que o aplicativo ou WhatsApp Web abre. O envio continua dependendo de ação humana.

Decisão registrada também em `docs/ARQUITETURA.md` e no Graphify (`rule_whatsapp_manual_v1`). A automação de WhatsApp continua fora da oferta da v1.

# Aviso manual por WhatsApp

Disponível nas consultas do veterinário e da clínica, pedidos do prestador e agenda de exames. O destinatário é o telefone cadastrado pelo tutor. O remetente é a conta conectada no dispositivo de quem clica; o portal não escolhe essa conta.

O link `https://wa.me` é acionado diretamente pelo usuário, sem `window.open`, espera de API ou envio automático. A mensagem contém data/hora, situação e local, mais o link fixo para o painel autenticado do tutor. Não contém laudo, nomes de exames, prontuário, códigos de início nem texto de observações. Abrir a conversa não registra envio ou entrega. Opt-out e restrições existentes de telefone são preservados; telefone ausente/incompleto não gera link.

## Validação automatizada

- `npx vitest run`: 1.664 testes aprovados, 48 ignorados (integração/contrato sem ambientes específicos).
- `npx playwright test --config=playwright.whatsapp-manual.config.ts`: 16 casos, oito Chromium e oito WebKit com perfil iPhone 13. APIs controladas, sem seed, sem alterações no banco e sem mensagens reais.
- Cobertura de navegador: abertura de nova página por clique nos quatro fluxos, telefone do portal, horário de Brasília na virada do dia, link de resultado autenticado, ausência de telefone e opt-out. Verifica ausência de overflow horizontal em viewport de 390 px.
- O destino externo é interceptado para verificar a abertura sem acessar uma conta real de WhatsApp. Esse teste comprova o acionamento do link pelo navegador; não comprova a transição para o aplicativo instalado no iOS nem a entrega da mensagem.

## Homologação em iPhone físico

O cliente identificou corte do cabeçalho no iPhone 13 físico em 27/10, depois da primeira publicação. Os 12 testes anteriores de viewport fixo não cobriam o deslocamento da área visível pelas barras do Safari. Foram acrescentados casos para consultas pendentes do veterinário e da clínica: visualViewport com altura 600/offsetTop 64, depois altura 450/offsetTop 100 (barras/teclado). Os dois casos falharam no WebKit antes da correção, com o título em y=58, fora da área visível que começava em y=64.

A correção usa portal no body, dimensões/offset do visualViewport e listeners de resize/scroll, fallback em dvh, safe areas e bloqueio/restauração da rolagem do fundo. Cabeçalho/rodapé não encolhem; só o conteúdo rola. Testes verificam geometria dos controles, redimensionamento e desbloqueio ao fechar.

Pendente após a correção: repetir no iPhone físico a leitura do título, fechamento, rolagem e abertura do WhatsApp. O envio continua dependendo de ação humana.

Decisão registrada também em `docs/ARQUITETURA.md` e no Graphify (`rule_whatsapp_manual_v1`). A automação de WhatsApp continua fora da oferta da v1.

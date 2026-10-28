# Navegação de pagamento

Fluxo implementado: contratação com preço e aceite explícitos → cobrança preparada na LincePet → link acionado pelo usuário abre nova aba → preparação autenticada do retorno da fatura → Asaas → retorno automático à LincePet nas formas com confirmação imediata → consulta ao banco → painel/onboarding quando ativo. A aba original permanece aberta e atualiza ao recuperar foco.

## Limites importantes

- A chegada a `/pagamento/retorno`, inclusive com `?status=paid`, não ativa plano. O webhook continua sendo a fonte da ativação.
- Boleto depende de compensação; fechar ou retornar ao site não comprova pagamento.
- A preparação só altera `callback` da fatura existente. Não cria cobrança nem altera preço, forma de pagamento ou status financeiro. O backend escolhe assinatura/fatura pelo titular, sem aceitar IDs ou destino enviados pelo navegador.
- A origem do callback vem de `NEXT_PUBLIC_APP_URL` ou `https://lincepet.com.br`; o domínio precisa corresponder ao cadastro comercial do Asaas. Não foi executado pagamento real para homologar essa configuração externa.
- Acompanhamento em intervalos de 10 segundos por até dois minutos, sem requisições concorrentes no hook, pausado em aba oculta e retomado por foco. A consulta usa somente o banco (`incluir_fatura=0`). Há atualização manual após esse período ou em falha.

## Validação

- Testes de unidade verificam URL oficial, origem de callback, atualização exclusiva do callback, isolamento por titular, cancelamento concorrente, fatura quitada, erro do provedor e sanitização de logs.
- `npx playwright test --config=playwright.pagamentos.config.ts`: desktop Chromium e WebKit com perfil iPhone. Todas as APIs e a página externa são interceptadas, sem seed, cobrança ou alteração real de dados.
- Os cenários cobrem contratação sem sair da LincePet, nova aba, ausência de duplicação de assinatura, atualização da aba original, retorno pendente, liberação persistida e redirecionamento, continuidade do onboarding dos três perfis, consulta com falha, retomada da mesma cobrança e limite do acompanhamento automático.
- Prints em `.playwright-mcp/pagamentos/desktop/` e `.playwright-mcp/pagamentos/iphone-webkit/` são capturas reais das telas locais com respostas simuladas. Não comprovam pagamento real nem comportamento do aplicativo de pagamento em iPhone físico.

Referências oficiais consultadas: https://docs.asaas.com/docs/redirecionamento-apos-o-pagamento e https://docs.asaas.com/reference/criar-nova-assinatura.

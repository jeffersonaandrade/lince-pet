import json
from pathlib import Path
from graphify.build import build_merge
from graphify.cache import save_semantic_cache
from graphify.export import to_json

DOC = "docs/ARQUITETURA.md"
graph_path = Path("graphify-out/graph.json")
g = json.loads(graph_path.read_text(encoding="utf-8"))

keep = ("id", "label", "file_type", "rationale", "source_file", "source_location", "contributor")
doc_nodes = [{k: n.get(k) for k in keep} for n in g["nodes"] if n.get("source_file") == DOC]
doc_ids = {n["id"] for n in doc_nodes}
doc_edges = [
    {k: e.get(k) for k in ("source", "target", "relation", "confidence", "confidence_score", "source_file", "weight")}
    for e in g["links"]
    if e.get("source_file") == DOC
]

def rule(id_, label, rationale):
    return {
        "id": id_, "label": label, "file_type": "rationale", "rationale": rationale,
        "source_file": DOC, "source_location": None, "contributor": "regras-de-negocio",
    }

new_nodes = [
    rule("concept_regras_de_negocio", "Regras de negocio (docs/ARQUITETURA.md)",
         "Toda decisao de negocio nova e registrada na secao Regras de negocio de docs/ARQUITETURA.md e no grafo."),
    rule("rule_bloqueio_pontual_agenda", "Bloqueio pontual de agenda (nao altera grade semanal)",
         "Bloqueio vale so para as datas informadas; a grade semanal (horarios_funcionamento/horarios_online) continua recorrente."),
    rule("rule_bloqueio_diario_ou_periodo", "Bloqueio diario ou por periodo, dia inteiro ou horarios",
         "data_inicio/data_fim YYYY-MM-DD, max 31 dias, sem datas passadas; horarios null = dia inteiro, lista HH:mm = so esses horarios em cada dia."),
    rule("rule_bloqueio_recorrente_semanal", "Bloqueio recorrente toda semana (dias da semana, sem fim opcional)",
         "recorrente=1 + dias_semana (0=domingo) repete o bloqueio a partir de data_inicio; data_fim null = ate remover; sem limite de 31 dias; nao altera a grade do Perfil."),
    rule("rule_bloqueio_intervalo_horarios", "Bloqueio por intervalo de horarios (Das/Ate)",
         "Modal marca todos os horarios de 30 min do intervalo (fim exclusivo) para o vet fechar parte do dia e atender so no restante."),
    rule("rule_bloqueio_quem_pode", "Vet e clinica com vinculo aceito podem bloquear",
         "Veterinario bloqueia a propria agenda; clinica bloqueia vets com veterinario_clinicas.status = aceito, senao 404."),
    rule("rule_bloqueio_cancela_consultas", "Bloqueio cancela consultas no periodo e avisa o tutor",
         "Preview lista consultas pendente/confirmado; ao confirmar cancela com motivo 'Agenda bloqueada pelo profissional', devolve uso mensal e notifica tutor (in-app + e-mail)."),
    rule("rule_bloqueio_sem_estorno", "Sem estorno automatico em consulta cancelada por bloqueio",
         "Consulta paga cancelada pelo bloqueio e estornada manualmente."),
    rule("rule_bloqueio_todos_locais", "Bloqueio vale para todos os locais do vet",
         "O bloqueio e do veterinario, nao do endereco: presencial e online."),
    rule("rule_bloqueio_trava_backend", "Agendar/reagendar em horario bloqueado retorna 400",
         "POST /agendamentos e PATCH /agendamentos/:id/reagendar recusam horario bloqueado; disponibilidade inclui bloqueados em horarios_ocupados e dia_bloqueado."),
]

anotacao_nodes = [
    rule("rule_anotacao_privada_visibilidade", "Anotacao privada: so o veterinario dono ve e edita",
         "Tabela agendamento_anotacoes (1:1 com consulta); GET/PUT /veterinarios/agendamentos/:id/anotacao; outro vet 404; nunca incluida em rotas de tutor ou clinica."),
    rule("rule_anotacao_quando_pode", "Anotacao liberada a partir do inicio do atendimento",
         "Permitida com started_at preenchido (em andamento) ou consulta concluida, editavel depois; pendente/confirmada/cancelada retorna 400."),
    rule("rule_anotacao_campos", "Campos da anotacao: local, pagamento, plano e observacoes",
         "Local (enderecos, Online, Domicilio ou texto), status pago/pendente/isento, forma pix/cartao/dinheiro/plano_pet/outro, plano so com plano_pet, observacoes ate 5000 caracteres."),
    rule("rule_anotacao_historico_por_pet", "Historico de anotacoes por pet, so do proprio vet",
         "GET /veterinarios/agendamentos/:id/anotacao/historico: anotacoes do mesmo vet em outras consultas do mesmo pet, mais recentes primeiro; anotacoes de outros vets nunca aparecem; visivel em qualquer status exceto cancelada."),
    rule("rule_anotacao_nao_altera_pagamento", "Anotacao nao altera o pagamento real",
         "Campos de pagamento sao registro do vet; payment_status da consulta e Asaas nao mudam."),
]
new_nodes += anotacao_nodes

prontuario_nodes = [
    rule("rule_prontuario_registro_campos", "Registro clinico: 8 campos por consulta",
         "registros_clinicos 1:1 com a consulta: queixa, diagnostico, tratamento, peso 0-500 kg, vacinas/medicacoes, retorno (hoje ou futuro), plano de saude, encaminhamento texto livre; textos ate 5000."),
    rule("rule_prontuario_autor", "Registro clinico: so o vet da consulta escreve",
         "GET/PUT /veterinarios/agendamentos/:id/registro; outro vet 404; mesma janela da anotacao (podeAnotar): a partir do inicio, editavel depois; cancelada sem registro."),
    rule("rule_prontuario_acesso", "Prontuario visivel ao tutor dono e a vets/clinicas com consulta do pet",
         "GET /pets/:id/prontuario: tutor dono ou vet/clinica com consulta nao cancelada (inclusive futura, confirmado pela dona do produto) veem o prontuario inteiro, com registros de outros profissionais; demais 404."),
    rule("rule_prontuario_tutor_ve_tudo", "Tutor ve todos os registros clinicos do pet",
         "Sem marcacao de compartilhamento: todo registro clinico aparece para o tutor dono."),
    rule("rule_prontuario_sem_nota_privada", "Prontuario nunca inclui a anotacao privada do vet",
         "prontuarioDoPet seleciona so agendamento + registroClinico; agendamento_anotacoes fica fora; plano da anotacao e financeiro, plano clinico fica no registro."),
    rule("rule_prontuario_pet_novo_vazio", "Pet novo comeca com prontuario vazio",
         "Linha do tempo = consultas nao canceladas do pet, mais recentes primeiro; sem consultas mostra 'Este pet ainda nao tem registros'."),
]
new_nodes += prontuario_nodes

def edge(s, t, rel="conceptually_related_to"):
    return {"source": s, "target": t, "relation": rel, "confidence": "EXTRACTED",
            "confidence_score": 1.0, "source_file": DOC, "weight": 1.0}

anotacao_rules = [n["id"] for n in anotacao_nodes]
prontuario_rules = [n["id"] for n in prontuario_nodes]
rules = [n["id"] for n in new_nodes[1:] if n["id"] not in anotacao_rules + prontuario_rules]
new_edges = [edge("concept_regras_de_negocio", r) for r in rules]
new_edges += [edge("rule_bloqueio_pontual_agenda", r) for r in rules[1:]]
impl = {
    "src_server_services_bloqueios": rules,
    "src_app_api_agendamentos_disponibilidade_veterinario_id_route": ["rule_bloqueio_trava_backend", "rule_bloqueio_diario_ou_periodo"],
    "src_app_api_agendamentos_route": ["rule_bloqueio_trava_backend"],
    "src_app_api_agendamentos_id_reagendar_route": ["rule_bloqueio_trava_backend"],
    "src_components_bloqueioagenda_bloqueioagendamodal": [
        "rule_bloqueio_cancela_consultas", "rule_bloqueio_diario_ou_periodo",
        "rule_bloqueio_recorrente_semanal", "rule_bloqueio_intervalo_horarios",
    ],
    "src_services_veterinarios_bloqueios": ["rule_bloqueio_recorrente_semanal"],
}
new_edges += [edge("concept_regras_de_negocio", r) for r in anotacao_rules]
new_edges += [edge("rule_anotacao_privada_visibilidade", r) for r in anotacao_rules[1:]]
impl.update({
    "src_server_services_anotacoes": anotacao_rules,
    "src_app_api_veterinarios_agendamentos_id_anotacao_route": ["rule_anotacao_privada_visibilidade", "rule_anotacao_quando_pode"],
    "src_components_anotacaoprivada_anotacaoprivada": ["rule_anotacao_campos", "rule_anotacao_privada_visibilidade"],
    "src_components_anotacaoprivada_historicoanotacoes": ["rule_anotacao_historico_por_pet"],
    "src_app_api_veterinarios_agendamentos_id_anotacao_historico_route": ["rule_anotacao_historico_por_pet"],
})
new_edges += [edge("concept_regras_de_negocio", r) for r in prontuario_rules]
new_edges += [edge("rule_prontuario_acesso", r) for r in prontuario_rules if r != "rule_prontuario_acesso"]
new_edges += [edge("rule_prontuario_sem_nota_privada", "rule_anotacao_privada_visibilidade", "references")]
new_edges += [edge("rule_prontuario_autor", "rule_anotacao_quando_pode", "references")]
impl.update({
    "src_server_services_prontuario": prontuario_rules,
    "src_app_api_veterinarios_agendamentos_id_registro_route": ["rule_prontuario_autor", "rule_prontuario_registro_campos"],
    "src_app_api_pets_id_prontuario_route": ["rule_prontuario_acesso", "rule_prontuario_tutor_ve_tudo", "rule_prontuario_sem_nota_privada"],
    "src_components_prontuario_registroclinicoform": ["rule_prontuario_registro_campos", "rule_prontuario_autor"],
    "src_components_prontuario_prontuariopet": ["rule_prontuario_acesso", "rule_prontuario_pet_novo_vazio"],
    "tests_server_prontuario_test": ["rule_prontuario_acesso", "rule_prontuario_sem_nota_privada"],
})

whatsapp_nodes = [
    rule("rule_whatsapp_numero_central", "WhatsApp: um numero central da Lince Pet",
         "Todas as mensagens saem de um unico numero da plataforma para tutores, vets e clinicas; profissional nao conecta numero proprio."),
    rule("rule_whatsapp_provedor_agnostico", "WhatsApp: provedor agnostico (driver por WHATSAPP_PROVIDER)",
         "Interface WhatsAppProvider; padrao 'log' so registra; trocar Z-API/UltraMsg/Evolution = novo driver. Provedor nao oficial tem risco de banimento."),
    rule("rule_whatsapp_eventos_destinatarios", "WhatsApp: eventos e destinatarios",
         "Confirmacao (tutor) e novo agendamento (profissional) na criacao; lembretes 24h/2h (tutor); cancelamento pelo tutor (profissional); cancelamento por bloqueio (tutor); remarcacao (ambos). Profissional = celular do vet ou WhatsApp da clinica."),
    rule("rule_whatsapp_regra_plano", "WhatsApp: so com plano do vet ou da clinica",
         "Envia se o vet OU a clinica da consulta tiver a feature whatsapp_notifications; senao registra ignorado/sem_plano."),
    rule("rule_whatsapp_opt_out", "WhatsApp: opt-out do tutor e do vet no perfil (padrao ligado)",
         "users.notificar_whatsapp em Perfil > Avisos de consulta (tutor e vet); desligado bloqueia so quem desligou, inclusive pelo WhatsApp da clinica; a outra parte continua recebendo."),
    rule("rule_whatsapp_lembretes_24h_2h", "WhatsApp: lembretes 24h e 2h via cron protegido",
         "GET /api/cron/lembretes-whatsapp com Bearer CRON_SECRET a cada 15 min; janela 24h (24h a 2h antes) e 2h (ate o inicio); consulta criada apos a janela abrir pula aquele lembrete."),
    rule("rule_whatsapp_idempotencia", "WhatsApp: envio idempotente e registrado",
         "whatsapp_envios com unique (consulta, evento, destinatario, data+hora); cron repetido nao duplica; remarcacao muda a referencia; status enviado/falhou/ignorado."),
    rule("rule_whatsapp_nao_bloqueia", "WhatsApp: falha nunca bloqueia o fluxo",
         "Envio em after(), ate 2 tentativas so para erro temporario (429/5xx/rede); erro do provedor e registrado e nao derruba agendamento/cancelamento/remarcacao."),
]
nodes_ids = {n["id"] for n in new_nodes}
new_nodes += [n for n in whatsapp_nodes if n["id"] not in nodes_ids]
whatsapp_rules = [n["id"] for n in whatsapp_nodes]
new_edges += [edge("concept_regras_de_negocio", r) for r in whatsapp_rules]
new_edges += [edge("rule_whatsapp_eventos_destinatarios", r) for r in whatsapp_rules if r != "rule_whatsapp_eventos_destinatarios"]
new_edges += [edge("rule_whatsapp_eventos_destinatarios", "rule_bloqueio_cancela_consultas", "references")]
impl.update({
    "src_server_services_whatsapp": ["rule_whatsapp_provedor_agnostico", "rule_whatsapp_numero_central", "rule_whatsapp_nao_bloqueia"],
    "src_server_services_whatsapp_mensagens": ["rule_whatsapp_eventos_destinatarios"],
    "src_server_services_whatsapp_notificacoes": [
        "rule_whatsapp_eventos_destinatarios", "rule_whatsapp_regra_plano", "rule_whatsapp_opt_out",
        "rule_whatsapp_idempotencia", "rule_whatsapp_nao_bloqueia",
    ],
    "src_server_services_whatsapp_lembretes": ["rule_whatsapp_lembretes_24h_2h", "rule_whatsapp_idempotencia"],
    "src_app_api_cron_lembretes_whatsapp_route": ["rule_whatsapp_lembretes_24h_2h"],
    "netlify_functions_lembretes_whatsapp": ["rule_whatsapp_lembretes_24h_2h"],
    "src_app_api_agendamentos_route": ["rule_bloqueio_trava_backend", "rule_whatsapp_eventos_destinatarios", "rule_whatsapp_nao_bloqueia"],
    "src_app_api_agendamentos_id_cancelar_route": ["rule_whatsapp_eventos_destinatarios", "rule_whatsapp_nao_bloqueia"],
    "src_app_api_agendamentos_id_reagendar_route": ["rule_bloqueio_trava_backend", "rule_whatsapp_eventos_destinatarios"],
    "src_app_api_me_notificacoes_route": ["rule_whatsapp_opt_out"],
    "src_app_dashboard_tutor_perfil_page": ["rule_whatsapp_opt_out"],
    "tests_server_whatsapp_test": whatsapp_rules,
})
new_edges += [edge("src_server_services_bloqueios", "rule_whatsapp_eventos_destinatarios", "implements")]

equipe_nodes = [
    rule("rule_clinica_remove_vinculo", "Clinica remove veterinario = desfaz vinculo (nao apaga conta)",
         "GET /clinicas/professionals e GET /veterinarios listam vinculos 'aceito'; DELETE /clinicas/professionals/:id e DELETE /veterinarios/:id apagam so o vinculo; conta, consultas e historico do vet permanecem; sem vinculo 404."),
]
nodes_ids = {n["id"] for n in new_nodes}
new_nodes += [n for n in equipe_nodes if n["id"] not in nodes_ids]
new_edges += [edge("concept_regras_de_negocio", "rule_clinica_remove_vinculo")]
impl.update({
    "src_server_services_clinica_equipe": ["rule_clinica_remove_vinculo"],
    "src_app_api_veterinarios_route": ["rule_clinica_remove_vinculo"],
    "src_app_api_veterinarios_id_route": ["rule_clinica_remove_vinculo"],
    "src_app_api_clinicas_professionals_route": ["rule_clinica_remove_vinculo"],
    "src_app_api_clinicas_professionals_id_route": ["rule_clinica_remove_vinculo"],
    "tests_server_clinica_equipe_test": ["rule_clinica_remove_vinculo"],
})

site_nodes = [
    rule("rule_site_sem_link_quebrado", "Site: nenhum link com # ou para rota inexistente",
         "Header/Footer so linkam paginas existentes; pagina futura nao tem link; externos em nova aba; garantido por tests/server/site-links.test.ts."),
    rule("rule_site_contatos_config", "Site: contatos e redes em src/config/site.ts",
         "E-mail, WhatsApp e redes centralizados; campo vazio nao vira link ('Em breve'); rede sem URL nao aparece no rodape."),
    rule("rule_site_planos_fonte_unica", "Site: planos publicos com fonte unica",
         "/precos e alterar-plano (vet e clinica) leem src/config/planos.ts."),
    rule("rule_site_ano_vigente", "Site e e-mails: copyright sempre com o ano vigente",
         "Footer usa AnoAtual (client, nao fica preso ao ano do build); templates de e-mail usam new Date().getFullYear(); teste falha com '(c) 20xx' fixo em src."),
]
nodes_ids = {n["id"] for n in new_nodes}
new_nodes += [n for n in site_nodes if n["id"] not in nodes_ids]
new_edges += [edge("concept_regras_de_negocio", n["id"]) for n in site_nodes]
impl.update({
    "src_components_footer_footer": ["rule_site_sem_link_quebrado", "rule_site_contatos_config", "rule_site_ano_vigente"],
    "src_components_footer_anoatual": ["rule_site_ano_vigente"],
    "src_server_emails_appointment_confirmation": ["rule_site_ano_vigente"],
    "src_server_emails_new_appointment_vet": ["rule_site_ano_vigente"],
    "src_server_emails_appointment_rescheduled": ["rule_site_ano_vigente"],
    "src_server_emails_appointment_rescheduled_vet": ["rule_site_ano_vigente"],
    "src_server_emails_appointment_cancellation": ["rule_site_ano_vigente"],
    "src_config_site": ["rule_site_contatos_config"],
    "src_app_contato_page": ["rule_site_contatos_config"],
    "src_config_planos": ["rule_site_planos_fonte_unica"],
    "src_app_precos_page": ["rule_site_planos_fonte_unica"],
    "src_app_dashboard_veterinario_alterar_plano_page": ["rule_site_planos_fonte_unica"],
    "src_app_dashboard_clinica_alterar_plano_page": ["rule_site_planos_fonte_unica"],
    "tests_server_site_links_test": ["rule_site_sem_link_quebrado", "rule_site_ano_vigente"],
})
seed_nodes = [
    rule("rule_seed_banco_vazio", "Seed Prisma popula catalogo de um banco vazio",
         "npx prisma db seed grava planos de assinatura, especialidades oficiais, planos de saude e diferenciais. Sem isso a listagem de planos e o cadastro de especialidades ficam vazios."),
    rule("rule_seed_planos_assinatura", "Planos de assinatura do seed seguem o banco do Adonis",
         "free, pro, pro_plus, starter, clinic, clinic_pro com preco, limite, features, prioridade e trial ja ajustados. Upsert por code sem trocar id. /precos continua em src/config/planos.ts."),
    rule("rule_seed_demonstracao", "Seed de demonstracao e idempotente e so usa e-mails mockup",
         "prisma db seed cria tutores, vets, clinicas, pets, consultas, avaliacoes, favoritos, prontuario e um bloqueio. Senha senha123 so nas contas novas com e-mail mockup; nao troca senha existente e nao duplica."),
]
nodes_ids = {n["id"] for n in new_nodes}
new_nodes += [n for n in seed_nodes if n["id"] not in nodes_ids]
new_edges += [edge("concept_regras_de_negocio", n["id"]) for n in seed_nodes]
impl.update({
    "prisma_seed": ["rule_seed_banco_vazio", "rule_seed_planos_assinatura", "rule_seed_demonstracao"],
    "prisma_demo": ["rule_seed_demonstracao"],
    "prisma_catalogo": ["rule_seed_planos_assinatura"],
    "src_data_especialidades": ["rule_seed_banco_vazio"],
    "tests_server_catalogo_seed_test": ["rule_seed_banco_vazio", "rule_seed_planos_assinatura"],
})
canais_nodes = [
    rule("rule_canais_por_usuario", "Canais de aviso: tutor e vet escolhem e-mail e WhatsApp",
         "GET/PUT /api/me/notificacoes (users.notificar_email, users.notificar_whatsapp, padrao ligado); aviso so sai pelos canais ligados; in-app (sino) sempre ligado."),
    rule("rule_canais_email_codigo_no_painel", "E-mail desligavel; codigo de inicio no painel do tutor",
         "Desligar e-mail corta todos os e-mails de consulta; o codigo de inicio aparece no painel (codigo_inicio em GET /agendamentos) em consultas futuras nao canceladas e nao iniciadas."),
    rule("rule_google_agenda_conexao_e_canal", "Google Agenda: canal ativo = conta conectada",
         "Sem interruptor separado; tutor e vet conectam a propria conta via /api/google/calendar/auth; vet precisa de plano Pro (trava no front)."),
    rule("rule_google_agenda_sincroniza_evento", "Google Agenda: criar/remarcar/cancelar atualiza o evento",
         "Criar insere; remarcar faz PATCH (404/410 cria outro); cancelar pelo tutor ou por bloqueio apaga; id em agendamento_google_eventos; falha nunca derruba o fluxo; 401/403 desliga a integracao."),
    rule("rule_google_agenda_desconectar", "Google Agenda: desconectar para de criar eventos sem apagar historico",
         "POST /api/google/calendar/disconnect revoga o token (melhor esforco) e limpa credenciais; consultas da plataforma e eventos ja criados permanecem."),
]
nodes_ids = {n["id"] for n in new_nodes}
new_nodes += [n for n in canais_nodes if n["id"] not in nodes_ids]
new_edges += [edge("concept_regras_de_negocio", n["id"]) for n in canais_nodes]
new_edges += [edge("rule_canais_por_usuario", "rule_whatsapp_opt_out", "references")]
impl.update({
    "src_server_services_canais_notificacao": ["rule_canais_por_usuario", "rule_google_agenda_conexao_e_canal"],
    "src_app_api_me_notificacoes_route": ["rule_whatsapp_opt_out", "rule_canais_por_usuario"],
    "src_components_preferenciasnotificacao_preferenciasnotificacao": [
        "rule_canais_por_usuario", "rule_google_agenda_conexao_e_canal", "rule_google_agenda_desconectar",
    ],
    "src_server_services_google_calendar": ["rule_google_agenda_sincroniza_evento", "rule_google_agenda_desconectar"],
    "src_app_api_google_calendar_disconnect_route": ["rule_google_agenda_desconectar"],
    "src_app_api_agendamentos_route": [
        "rule_bloqueio_trava_backend", "rule_whatsapp_eventos_destinatarios", "rule_whatsapp_nao_bloqueia",
        "rule_canais_por_usuario", "rule_canais_email_codigo_no_painel", "rule_google_agenda_sincroniza_evento",
    ],
    "src_app_api_agendamentos_id_cancelar_route": [
        "rule_whatsapp_eventos_destinatarios", "rule_whatsapp_nao_bloqueia", "rule_canais_por_usuario",
        "rule_google_agenda_sincroniza_evento",
    ],
    "src_app_api_agendamentos_id_reagendar_route": [
        "rule_bloqueio_trava_backend", "rule_whatsapp_eventos_destinatarios", "rule_canais_por_usuario",
        "rule_google_agenda_sincroniza_evento",
    ],
    "src_app_dashboard_tutor_appointmentitem": ["rule_canais_email_codigo_no_painel"],
    "tests_server_google_agenda_test": [n["id"] for n in canais_nodes],
})
new_edges += [edge("src_server_services_bloqueios", "rule_google_agenda_sincroniza_evento", "implements")]

prestador_nodes = [
    rule("rule_prestador_conta_generica", "Prestador: conta generica com tipo do catalogo",
         "Tosador, passeador, adestrador, pet sitter e proximos usam user_type prestador; tipo vem de tipos_servico (slug, nome, modalidade); tipo novo = linha no catalogo. Cadastro, onboarding, painel e perfil publico proprios."),
    rule("rule_prestador_um_tipo", "Prestador: um tipo por conta, varios servicos",
         "Cada prestador tem um tipo de servico; dentro dele cadastra servicos_oferecidos com preco e duracao (modalidade duracao)."),
    rule("rule_prestador_sem_dados_vet", "Prestador: sem CRMV, consulta, prontuario ou anotacao",
         "Telas e rotas proprias (prestadores.ts, pedidos-prestador.ts); nao reutiliza a tela de veterinario; pedido sem veterinario_id."),
    rule("rule_prestador_busca_por_tipo", "Prestador: busca por tipo de servico",
         "Aba Profissionais em /explorar e GET /api/prestadores/search?tipo=; so quem concluiu onboarding e esta ativo."),
    rule("rule_prestador_pedido_inicio_fim", "Pedido de servico: inicio e fim (duracao ou periodo)",
         "Pedido = Agendamento com prestador_id e inicio_em/fim_em. Duracao: fim = inicio + duracao, dentro da grade. Periodo (hospedagem): ate 30 dias, preco = diaria x dias."),
    rule("rule_prestador_sem_sobreposicao", "Pedido de servico: sem sobreposicao na agenda",
         "Pedidos pendente/confirmado/em andamento ocupam a agenda; sobreposicao retorna 409, checada de novo na transacao."),
    rule("rule_prestador_aceite_obrigatorio", "Pedido de servico: aceite obrigatorio",
         "Nasce pendente; prestador aceita (confirmado) ou recusa (cancelado, motivo opcional); remarcacao pelo tutor volta para pendente."),
    rule("rule_prestador_codigo_apos_aceite", "Pedido de servico: codigo de inicio so apos aceite",
         "Tutor ve o codigo quando confirmado; prestador digita para iniciar (ate 5 tentativas) e depois conclui; tutor avalia o servico concluido."),
    rule("rule_prestador_bloqueio_conflito_409", "Bloqueio do prestador com pedido ativo e recusado (409)",
         "Diferente do vet, nao cancela pedidos: devolve 409 com a lista de conflitos para o prestador recusar ou remarcar antes."),
    rule("rule_prestador_limite_plano", "Prestador: plano free com limite mensal e upgrade Asaas",
         "Comeca no free (10 pedidos/mes); pro pelo mesmo fluxo /api/assinaturas (referencia prestador:<id>); recusa/cancelamento devolve a cota; cancelar ou atrasar volta para free."),
    rule("rule_prestador_avisos_reaproveitados", "Pedido de servico: mesmos avisos com texto de servico",
         "In-app, e-mail, WhatsApp e Google Agenda reaproveitados via profissionalDe; textos sem Dr(a). nem consulta; WhatsApp depende do plano do prestador."),
]
nodes_ids = {n["id"] for n in new_nodes}
new_nodes += [n for n in prestador_nodes if n["id"] not in nodes_ids]
prestador_rules = [n["id"] for n in prestador_nodes]
new_edges += [edge("concept_regras_de_negocio", r) for r in prestador_rules]
new_edges += [edge("rule_prestador_conta_generica", r) for r in prestador_rules[1:]]
new_edges += [edge("rule_prestador_bloqueio_conflito_409", "rule_bloqueio_cancela_consultas", "references")]
new_edges += [edge("rule_prestador_avisos_reaproveitados", "rule_canais_por_usuario", "references")]
prestador_impl = {
    "src_server_services_prestadores": [
        "rule_prestador_conta_generica", "rule_prestador_um_tipo", "rule_prestador_busca_por_tipo", "rule_prestador_sem_dados_vet",
    ],
    "src_server_services_pedidos_prestador": [
        "rule_prestador_pedido_inicio_fim", "rule_prestador_sem_sobreposicao", "rule_prestador_aceite_obrigatorio",
        "rule_prestador_codigo_apos_aceite", "rule_prestador_bloqueio_conflito_409", "rule_prestador_limite_plano",
        "rule_prestador_avisos_reaproveitados", "rule_prestador_sem_dados_vet",
    ],
    "src_server_services_profissional": ["rule_prestador_avisos_reaproveitados"],
    "src_server_services_assinante": ["rule_prestador_limite_plano"],
    "src_server_services_asaas_webhook": ["rule_prestador_limite_plano"],
    "src_server_services_whatsapp_notificacoes": ["rule_prestador_avisos_reaproveitados"],
    "src_server_services_google_calendar": ["rule_prestador_avisos_reaproveitados"],
    "src_app_api_prestadores_search_route": ["rule_prestador_busca_por_tipo"],
    "src_app_api_prestadores_register_route": ["rule_prestador_conta_generica", "rule_prestador_um_tipo"],
    "src_app_api_prestadores_bloqueios_route": ["rule_prestador_bloqueio_conflito_409"],
    "src_app_api_agendamentos_id_cancelar_route": ["rule_prestador_limite_plano"],
    "src_app_api_agendamentos_id_reagendar_route": ["rule_prestador_aceite_obrigatorio"],
    "src_app_api_agendamentos_route": ["rule_prestador_codigo_apos_aceite"],
    "src_app_dashboard_prestador_page": ["rule_prestador_aceite_obrigatorio", "rule_prestador_codigo_apos_aceite"],
    "src_components_prestador_painelbloqueios": ["rule_prestador_bloqueio_conflito_409"],
    "src_components_prestador_pedidoservicoform": ["rule_prestador_pedido_inicio_fim"],
    "src_components_prestador_listaprofissionais": ["rule_prestador_busca_por_tipo"],
    "src_app_dashboard_tutor_appointmentitem": ["rule_prestador_codigo_apos_aceite"],
    "tests_server_prestadores_test": prestador_rules,
}
for code_id, rs in prestador_impl.items():
    impl[code_id] = impl.get(code_id, []) + [r for r in rs if r not in impl.get(code_id, [])]

plano_saude_nodes = [
    rule("rule_plano_saude_mesma_lista", "Busca por plano de saude usa o catalogo do cadastro",
         "O filtro Plano de Saude em /explorar lista os nomes da tabela planos (GET /api/planos), os mesmos que vet e clinica marcam no onboarding e no perfil. Sem lista fixa a parte."),
    rule("rule_plano_saude_so_quem_aceita", "Busca por plano de saude so devolve quem aceita",
         "GET /api/veterinarios/search?plano= e GET /api/clinicas?plano= filtram veterinario_planos e clinica_planos pelo nome, sem diferenciar maiusculas."),
    rule("rule_plano_saude_sem_exemplo", "Busca sem resultado nao mostra profissional ficticio",
         "Se ninguem aceita o plano, /explorar fica vazio."),
    rule("rule_plano_saude_perfil", "Perfil e card da busca mostram so os planos ligados ao cadastro",
         "/veterinario/[id] e /clinicas/[id] exibem os planos ligados ao cadastro. O card do veterinario em /explorar mostra os mesmos nomes de veterinario_planos."),
]
nodes_ids = {n["id"] for n in new_nodes}
new_nodes += [n for n in plano_saude_nodes if n["id"] not in nodes_ids]
plano_saude_rules = [n["id"] for n in plano_saude_nodes]
new_edges += [edge("concept_regras_de_negocio", r) for r in plano_saude_rules]
new_edges += [edge("rule_plano_saude_mesma_lista", r) for r in plano_saude_rules[1:]]
impl.update({
    "src_components_home_searchbar_searchbar": ["rule_plano_saude_mesma_lista"],
    "src_app_api_planos_route": ["rule_plano_saude_mesma_lista"],
    "src_services_veterinarios_veterinarios": ["rule_plano_saude_mesma_lista", "rule_plano_saude_so_quem_aceita"],
    "src_app_api_veterinarios_search_route": ["rule_plano_saude_so_quem_aceita"],
    "src_server_services_veterinarios": ["rule_plano_saude_so_quem_aceita"],
    "src_app_api_clinicas_route": ["rule_plano_saude_so_quem_aceita"],
    "src_app_explorar_page": ["rule_plano_saude_sem_exemplo", "rule_plano_saude_so_quem_aceita", "rule_plano_saude_perfil"],
    "src_app_veterinario_id_page": ["rule_plano_saude_perfil"],
    "src_app_clinicas_id_page": ["rule_plano_saude_perfil"],
    "tests_server_busca_plano_saude_test": ["rule_plano_saude_so_quem_aceita"],
})

ordenacao_nodes = [
    rule("rule_explorar_ordenacao", "Explorar ordena a lista por nome ou nota",
         "O icone de filtro em /explorar ordena a aba atual (veterinarios, clinicas, profissionais) por nome ou nota, crescente ou decrescente. Parametros ordem e direcao na URL; sem eles a ordem e a da API. Empate de nota desempata pelo nome; nota ausente vale zero. Nao dispara nova busca."),
]
new_nodes += [n for n in ordenacao_nodes if n["id"] not in {x["id"] for x in new_nodes}]
new_edges += [edge("concept_regras_de_negocio", "rule_explorar_ordenacao")]
impl.update({
    "src_lib_ordenacao": ["rule_explorar_ordenacao"],
    "src_components_home_searchbar_ordenacaolista": ["rule_explorar_ordenacao"],
    "src_app_explorar_page": impl.get("src_app_explorar_page", []) + ["rule_explorar_ordenacao"],
    "src_components_prestador_listaprofissionais": impl.get("src_components_prestador_listaprofissionais", []) + ["rule_explorar_ordenacao"],
})

for code_id, rs in impl.items():
    new_edges += [edge(code_id, r, "implements") for r in rs]

new_ids = {n["id"] for n in new_nodes}
nodes = [n for n in doc_nodes if n["id"] not in new_ids] + new_nodes
edge_keys = {(e["source"], e["target"], e["relation"]) for e in doc_edges}
edges = doc_edges + [e for e in new_edges if (e["source"], e["target"], e["relation"]) not in edge_keys]
hyperedges = [h for h in g.get("hyperedges", []) if h.get("source_file") == DOC]

saved = save_semantic_cache(nodes, edges, hyperedges, root=Path("."), allowed_source_files=[DOC])
print("cached files:", saved)

G = build_merge([{"nodes": nodes, "edges": edges, "hyperedges": hyperedges}], graph_path=graph_path, root=".")
G.graph["hyperedges"] = hyperedges
to_json(G, {}, str(graph_path), force=True)
print("nodes:", G.number_of_nodes(), "edges:", G.number_of_edges())

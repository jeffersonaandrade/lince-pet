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
         "GET /pets/:id/prontuario: tutor dono ou vet/clinica com consulta nao cancelada (inclusive futura) veem o prontuario inteiro, com registros de outros profissionais; demais 404."),
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

for code_id, rs in impl.items():
    new_edges += [edge(code_id, r, "implements") for r in rs]

nodes = doc_nodes + [n for n in new_nodes if n["id"] not in doc_ids]
edge_keys = {(e["source"], e["target"], e["relation"]) for e in doc_edges}
edges = doc_edges + [e for e in new_edges if (e["source"], e["target"], e["relation"]) not in edge_keys]
hyperedges = [h for h in g.get("hyperedges", []) if h.get("source_file") == DOC]

saved = save_semantic_cache(nodes, edges, hyperedges, root=Path("."), allowed_source_files=[DOC])
print("cached files:", saved)

G = build_merge([{"nodes": nodes, "edges": edges, "hyperedges": hyperedges}], graph_path=graph_path, root=".")
G.graph["hyperedges"] = hyperedges
to_json(G, {}, str(graph_path), force=True)
print("nodes:", G.number_of_nodes(), "edges:", G.number_of_edges())

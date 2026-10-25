"use client";

import { useCallback, useEffect, useState } from "react";
import { PetsService, type PetRecord } from "@/services/pets/pets";
import { dadosDoFormularioPet, formularioDoPet, FORMULARIO_PET_VAZIO, type FormularioPet } from "@/lib/pets";
import { mensagemDeErro } from "@/lib/erros";

const liberarUrl = (url: string | null) => {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
};

/** Pets do tutor: lista, modal de cadastro/edição, recorte da foto e exclusão. */
export function usePetsTutor(ativo: boolean) {
  const [pets, setPets] = useState<PetRecord[]>([]);
  const [arquivados, setArquivados] = useState<PetRecord[]>([]);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormularioPet>(FORMULARIO_PET_VAZIO);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  /** Arquivo que vai para o upload: sempre o recorte salvo no editor, nunca o original. */
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [imagemParaEditar, setImagemParaEditar] = useState<string | null>(null);

  useEffect(() => {
    if (!ativo) return;
    PetsService.listarPets(true)
      .then((lista) => {
        setPets(lista.filter(p => !p.arquivado_em));
        setArquivados(lista.filter(p => p.arquivado_em));
        setErroLista(null);
      })
      .catch((error: unknown) => setErroLista(mensagemDeErro(error, "Não foi possível carregar seus pets.")));
  }, [ativo]);

  const trocarPrevia = useCallback((url: string | null) => {
    setPrevia((anterior) => {
      if (anterior !== url) liberarUrl(anterior);
      return url;
    });
  }, []);

  const limparFormulario = () => {
    setForm(FORMULARIO_PET_VAZIO);
    setFoto(null);
    trocarPrevia(null);
    setEditandoId(null);
    setErroForm(null);
  };

  const abrirNovo = () => {
    limparFormulario();
    setModalAberto(true);
  };

  const abrirEdicao = (pet: PetRecord) => {
    setEditandoId(pet.id);
    setForm(formularioDoPet(pet));
    setFoto(null);
    trocarPrevia(pet.foto_url ?? null);
    setErroForm(null);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setErroForm(null);
  };

  const escolherArquivo = (arquivo: File | null) => {
    if (arquivo) setImagemParaEditar(URL.createObjectURL(arquivo));
  };

  const cancelarRecorte = () => {
    liberarUrl(imagemParaEditar);
    setImagemParaEditar(null);
  };

  const salvarRecorte = (canvas: HTMLCanvasElement) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setFoto(new File([blob], "pet.png", { type: "image/png" }));
        trocarPrevia(URL.createObjectURL(blob));
      },
      "image/png",
      0.95
    );
    cancelarRecorte();
  };

  const salvar = async () => {
    const resultado = dadosDoFormularioPet(form);
    if ("erro" in resultado) {
      setErroForm(resultado.erro);
      return;
    }
    setErroForm(null);
    setSalvando(true);
    try {
      let pet = editandoId
        ? await PetsService.editarPet(editandoId, resultado.dados)
        : await PetsService.criarPet(resultado.dados);
      if (foto) {
        try {
          pet = { ...pet, foto_url: await PetsService.uploadFoto(pet.id, foto) };
        } catch (error) {
          alert(mensagemDeErro(error, "Os dados do pet foram salvos, mas a foto não foi enviada."));
        }
      }
      setPets((lista) => (editandoId ? lista.map((p) => (p.id === pet.id ? pet : p)) : [pet, ...lista]));
      limparFormulario();
      setModalAberto(false);
    } catch (error) {
      setErroForm(mensagemDeErro(error, "Não foi possível salvar o pet."));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!editandoId || !confirm("Arquivar este pet? O histórico será preservado e continuará disponível para consulta.")) return;
    setSalvando(true);
    try {
      await PetsService.excluirPet(editandoId);
      const pet = pets.find(p => p.id === editandoId);
      if (pet) setArquivados(lista => [...lista, { ...pet, arquivado_em: new Date().toISOString() }]);
      setPets((lista) => lista.filter((p) => p.id !== editandoId));
      limparFormulario();
      setModalAberto(false);
    } catch (error) {
      alert(mensagemDeErro(error, "Erro ao arquivar pet"));
    } finally {
      setSalvando(false);
    }
  };

  return {
    pets,
    arquivados,
    erroLista,
    modalAberto,
    editando: editandoId !== null,
    form,
    setForm,
    erroForm,
    salvando,
    previa,
    imagemParaEditar,
    abrirNovo,
    abrirEdicao,
    fecharModal,
    escolherArquivo,
    cancelarRecorte,
    salvarRecorte,
    salvar,
    excluir,
  };
}

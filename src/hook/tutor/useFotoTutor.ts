"use client";

import { useState } from "react";
import { TutorService } from "@/services/tutor/tutor";
import { mensagemDeErro } from "@/lib/erros";

/** Envia a foto de perfil do tutor e atualiza o usuário logado. */
export function useFotoTutor(aoAtualizar: (fotoUrl: string) => void) {
  const [enviando, setEnviando] = useState(false);

  const enviar = async (arquivo: File) => {
    setEnviando(true);
    try {
      const bitmap = await createImageBitmap(arquivo);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
      bitmap.close();
      const { url } = await TutorService.uploadProfilePhotoFromCanvas(canvas);
      aoAtualizar(url);
    } catch (error) {
      alert(mensagemDeErro(error, "Não foi possível salvar a foto. Tente novamente."));
    } finally {
      setEnviando(false);
    }
  };

  return { enviando, enviar };
}

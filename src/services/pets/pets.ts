import { api } from "@/hook/api";



export interface PetRecord {
  id: string;
  tutor_id: string;
  nome: string;
  especie: string;
  raca?: string | null;
  idade?: number | null;
  foto_url?: string | null;
  porte?: 'pequeno' | 'medio' | 'grande' | null;
  created_at?: string;
}

export class PetsService {
  static async listarPets(): Promise<PetRecord[]> {
    const res = await api.get("/pets");
    return res.data.pets?.map((p: any) => ({
      id: p.id,
      tutor_id: p.tutor_id,
      nome: p.nome,
      especie: p.especie,
      raca: p.raca ?? null,
      idade: p.idade ?? null,
      porte: p.porte ?? null,
      foto_url: p.foto_url ?? p.fotoUrl ?? null,
      created_at: p.created_at,
    })) as PetRecord[];
  }

  static async criarPet(data: {
    nome: string;
    especie: string;
    raca?: string;
    idade?: number;
    porte?: 'pequeno' | 'medio' | 'grande';
    foto_url?: string;
  }): Promise<PetRecord> {
    const res = await api.post("/pets", data);
    const p = res.data.pet;
    return {
      id: p.id,
      tutor_id: p.tutor_id,
      nome: p.nome,
      especie: p.especie,
      raca: p.raca ?? null,
      idade: p.idade ?? null,
      porte: p.porte ?? null,
      foto_url: p.foto_url ?? p.fotoUrl ?? null,
      created_at: p.created_at,
    } as PetRecord;
  }

  static async uploadFoto(petId: string, file: File): Promise<string> {
    const form = new FormData();
    form.append("photo", file);
    const res = await api.post(`/pets/${petId}/photo`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.url as string;
  }

  static async uploadFotoFromCanvas(
    petId: string,
    canvas: HTMLCanvasElement
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error("Falha ao processar a imagem"));
            return;
          }
          const file = new File([blob], "pet-photo.png", {
            type: "image/png",
          });
          try {
            const url = await this.uploadFoto(petId, file);
            resolve(url);
          } catch (error) {
            reject(error);
          }
        },
        "image/png",
        0.95
      );
    });
  }
  static async editarPet(
    id: string,
    data: Partial<{
      nome: string;
      especie: string;
      raca?: string;
      idade?: number;
      porte?: 'pequeno' | 'medio' | 'grande';
      foto_url?: string;
    }>
  ): Promise<PetRecord> {
    const res = await api.patch(`/pets/${id}`, data);
    const p = res.data.pet;
    return {
      id: p.id,
      tutor_id: p.tutor_id,
      nome: p.nome,
      especie: p.especie,
      raca: p.raca ?? null,
      idade: p.idade ?? null,
      porte: p.porte ?? null,
      foto_url: p.foto_url ?? p.fotoUrl ?? null,
      created_at: p.created_at,
    } as PetRecord;
  }

  static async excluirPet(id: string): Promise<void> {
    await api.delete(`/pets/${id}`);
  }
}

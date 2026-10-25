import { api } from "@/hook/api";
import { petDaApi } from "@/lib/pets";

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
  arquivado_em?: string | null;
}

export type PortePet = NonNullable<PetRecord["porte"]>;

type DadosPet = {
  nome: string;
  especie: string;
  raca?: string;
  idade?: number;
  porte?: PortePet;
  foto_url?: string;
};

export class PetsService {
  static async listarPets(incluirArquivados = false): Promise<PetRecord[]> {
    const res = await api.get(incluirArquivados ? "/pets?arquivados=1" : "/pets");
    const pets: unknown = res.data.pets;
    return Array.isArray(pets) ? pets.map(petDaApi) : [];
  }

  static async criarPet(data: DadosPet): Promise<PetRecord> {
    const res = await api.post("/pets", data);
    return petDaApi(res.data.pet);
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

  static async editarPet(id: string, data: Partial<DadosPet>): Promise<PetRecord> {
    const res = await api.patch(`/pets/${id}`, data);
    return petDaApi(res.data.pet);
  }

  static async excluirPet(id: string): Promise<void> {
    await api.delete(`/pets/${id}`);
  }
}

import { api } from "@/hook/api";



export const TutorService = {
  async updateProfile(data: { nome?: string }): Promise<void> {
    await api.put("/tutor/profile", data);
  },

  async uploadProfilePhoto(file: File): Promise<{ url: string }> {
    const form = new FormData();
    // Backend aceita várias chaves, usamos a preferida
    form.append("profile_pic", file);
    const res = await api.post("/tutor/profile/photo", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return { url: res.data.url as string };
  },

  async uploadProfilePhotoFromCanvas(
    canvas: HTMLCanvasElement
  ): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error("Falha ao processar a imagem"));
            return;
          }
          const file = new File([blob], "profile-photo.png", {
            type: "image/png",
          });
          try {
            const result = await this.uploadProfilePhoto(file);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        },
        "image/png",
        0.95
      );
    });
  },
};

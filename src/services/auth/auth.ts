import { api } from "@/hook/api";

export interface TutorSignupData {
  email: string;
  nome: string;
  sobrenome: string;
  dataNascimento: string;
  sexo: string;
  password: string;
}



export const tutorSignup = async (data: TutorSignupData) => {
  const response = await api.post("/tutor/register", data);
  return response.data;
};

export const login = async (data: { email: string; password: string }) => {
  const response = await api.post("/auth/login", data);
  return response.data;
};

export const logout = async () => {
  const response = await api.post("/auth/logout");
  return response.data;
};

export const forgotPassword = async (email: string) => {
  const response = await api.post("/auth/forgot-password", { email });
  return response.data;
};

export const resetPassword = async (data: { token: string; password: string; password_confirmation: string }) => {
  const response = await api.post("/auth/reset-password", data);
  return response.data;
};

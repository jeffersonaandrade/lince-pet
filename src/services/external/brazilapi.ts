import { api } from "@/hook/api";

// Create a function to get API instance


export const fetchCep = async (cep: string) => {
  try {
    const response = await api.get(`/external/cep/${cep}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching CEP data:", error);
    throw error;
  }
};

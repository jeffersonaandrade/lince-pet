"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { CustomCheckbox } from "@/components/ui/CustomCheckbox/CustomCheckbox";
import Dropdown from "@/components/ui/Dropdown";
import { Check, Plus, MapPin, X, Clock, OctagonAlert } from "lucide-react";
import {
  getOnboardingProgress,
  submitOnboardingStep1,
  submitOnboardingStep2,
  submitOnboardingStep3,
  submitOnboardingStep4,
  submitOnboardingStep5,
  submitOnboardingStep6,
  submitOnboardingStep7,
  completeVeterinarioOnboarding,
  getEspecialidades,
  getPlanos,
  uploadOnboardingGeneric,
  type Experience,
} from "@/services/veterinarios/veterinarios";
import { fetchCep } from "@/services/external/brazilapi";
import { handleApiError, type ErrorState } from "@/utils/errorHandler";
import { removeMask } from "@/utils/formatters";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import styles from "./onboarding.module.css";
import { uploadOnboardingPhoto } from "@/services/veterinarios/veterinarios";
import ProfileImageUploader from "@/components/ProfileImageUploader/ProfileImageUploader";

interface OnboardingStep {
  title: string;
  description: string;
}

interface Especialidade {
  id: string;
  nome: string;
}

interface LocationData {
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  precoConsulta: number;
  fotoUrl?: string;
  nomeClinica?: string;
  horariosDisponibilidade: {
    [key: string]: string[];
  };
}

interface LocationModalData {
  cep: string;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  precoConsulta: string;
  nomeClinica: string;
  isDomicilio: boolean;
  fotoUrl?: string;
  horariosDisponibilidade: {
    [key: string]: string[];
    segunda: string[];
    terca: string[];
    quarta: string[];
    quinta: string[];
    sexta: string[];
    sabado: string[];
    domingo: string[];
  };
}

const onboardingSteps: OnboardingStep[] = [
  {
    title: "Bem-vindo ao Lince Pet!",
    description:
      "Vamos configurar seu perfil profissional para que você possa começar a receber agendamentos.",
  },
  {
    title: "Informações Profissionais",
    description: "Informe seu CRMV para validação profissional",
  },
  {
    title: "Perfil Pessoal",
    description: "Selecione seu gênero",
  },
  {
    title: "Especialidades",
    description: "Selecione suas especialidades veterinárias",
  },
  {
    title: "Tipos de Atendimento",
    description:
      "Escolha como deseja atender seus pacientes e configure localizações",
  },
  {
    title: "Experiência Profissional",
    description: "Adicione suas experiências profissionais anteriores",
  },
  {
    title: "Planos de Saúde",
    description: "Selecione os planos de saúde que você atende",
  },
  {
    title: "Sobre Você",
    description: "Escreva uma breve apresentação",
  },
];

export default function OnboardingPage() {
  const { user, loading, updateUser } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBack, setIsLoadingBack] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true); // Loading state for initial form load
  const [isLoadingEspecialidades, setIsLoadingEspecialidades] = useState(true);
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocationIndex, setEditingLocationIndex] = useState<
    number | null
  >(null);
  const [locationModalData, setLocationModalData] = useState<LocationModalData>(
    {
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
      precoConsulta: "",
      nomeClinica: "",
      isDomicilio: false,
      horariosDisponibilidade: {
        segunda: [],
        terca: [],
        quarta: [],
        quinta: [],
        sexta: [],
        sabado: [],
        domingo: [],
      },
    }
  );
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [formData, setFormData] = useState({
    crmv: "",
    genero: "",
    especialidades: [] as string[],
    visitTypes: {
      presencial: false,
      online: false,
    },
    locations: [] as LocationData[],
    precoConsultaOnline: "",
    about: "",
    experiencias: [] as Experience[],
    planos: [] as string[],
  });

  const [availablePlans, setAvailablePlans] = useState<{ id: string; name: string }[]>([]);
  const [experienceForm, setExperienceForm] = useState<Experience>({
    local: "",
    cargo: "",
    dataInicio: "",
    dataFim: "",
    descricao: "",
    ativo: false
  });

  // Máscara/normalizador de CRMV: DIGITOS-UF (UF em maiúsculas, hífen automático)
  const formatCrmvInput = (raw: string) => {
    const only = raw.replace(/[^a-zA-Z0-9]/g, "");
    const digits = only.match(/\d+/)?.[0] || "";
    const letters = (only.replace(/\d+/g, "") || "").toUpperCase().slice(0, 2);
    if (letters.length > 0) return `${digits}-${letters}`;
    return digits;
  };

  // Helper functions
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 23; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      if (hour < 23) {
        slots.push(`${hour.toString().padStart(2, "0")}:30`);
      }
    }
    // Add final 23:30 slot
    slots.push("23:30");
    return slots;
  };

  const handleCepChange = async (cep: string) => {
    const formattedCep = cep
      .replace(/\D/g, "")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .substr(0, 9);

    setLocationModalData((prev) => ({ ...prev, cep: formattedCep }));

    const unformattedCep = cep.replace(/\D/g, "");
    if (unformattedCep.length === 8) {
      setIsCepLoading(true);
      setError(null);
      try {
        console.log("Buscando CEP:", unformattedCep);
        const cepData = await fetchCep(unformattedCep);
        console.log("CEP encontrado:", cepData);
        setLocationModalData((prev) => ({
          ...prev,
          rua: cepData.rua || "",
          bairro: cepData.bairro || "",
          cidade: cepData.cidade || "",
          estado: cepData.estado || "",
        }));
      } catch (err: any) {
        console.error("Erro ao buscar CEP:", err);
        const errorState = handleApiError(err, {
          404: "O CEP informado é inválido.",
          500: "Aconteceu um erro ao buscar o CEP.",
        });
        setError(errorState);

        setLocationModalData((prev) => ({
          ...prev,
          rua: "",
          bairro: "",
          cidade: "",
          estado: "",
        }));
      } finally {
        setIsCepLoading(false);
      }
    } else {
      // Se apagar o CEP, limpa os campos
      if (unformattedCep.length < 8) {
        setLocationModalData((prev) => ({
          ...prev,
          rua: "",
          bairro: "",
          cidade: "",
          estado: "",
        }));
      }
      setError(null);
    }
  };

  const handleTimeToggle = (day: string, time: string) => {
    setLocationModalData((prev) => ({
      ...prev,
      horariosDisponibilidade: {
        ...prev.horariosDisponibilidade,
        [day]: prev.horariosDisponibilidade[day].includes(time)
          ? prev.horariosDisponibilidade[day].filter((t) => t !== time)
          : [...prev.horariosDisponibilidade[day], time].sort(),
      },
    }));
  };

  const hasAvailabilityHours = (location: LocationData) => {
    const days = [
      "segunda",
      "terca",
      "quarta",
      "quinta",
      "sexta",
      "sabado",
      "domingo",
    ];
    return days.some(
      (day) => location.horariosDisponibilidade[day]?.length > 0
    );
  };

  const handleEditLocation = (index: number) => {
    const location = formData.locations[index];
    setEditingLocationIndex(index);
    setError(null); // Clear any existing errors
    setLocationModalData({
      cep: location.cep,
      rua: location.rua,
      numero: location.numero,
      complemento: location.complemento || "",
      bairro: location.bairro,
      cidade: location.cidade,
      estado: location.estado,
      precoConsulta: String(location.precoConsulta ?? ""),
      nomeClinica: location.nomeClinica || "",
      isDomicilio: location.nomeClinica === "Domicílio",
      fotoUrl: location.fotoUrl || "",
      horariosDisponibilidade: {
        segunda: location.horariosDisponibilidade?.segunda || [],
        terca: location.horariosDisponibilidade?.terca || [],
        quarta: location.horariosDisponibilidade?.quarta || [],
        quinta: location.horariosDisponibilidade?.quinta || [],
        sexta: location.horariosDisponibilidade?.sexta || [],
        sabado: location.horariosDisponibilidade?.sabado || [],
        domingo: location.horariosDisponibilidade?.domingo || [],
      },
    });
    setShowLocationModal(true);
  };

  const handleOpenNewLocationModal = () => {
    setEditingLocationIndex(null);
    setError(null); // Clear any existing errors
    setLocationModalData({
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
      precoConsulta: "",
      nomeClinica: "",
      isDomicilio: false,
      fotoUrl: "",
      horariosDisponibilidade: {
        segunda: [],
        terca: [],
        quarta: [],
        quinta: [],
        sexta: [],
        sabado: [],
        domingo: [],
      },
    });
    setShowLocationModal(true);
  };

  const handleAddLocation = () => {
    if (
      !locationModalData.cep ||
      !locationModalData.rua ||
      !locationModalData.numero
    ) {
      setError({
        message: "Por favor, preencha todos os campos obrigatórios.",
      });
      return;
    }

    // valida preço
    const preco = Math.round(Number(
      String(locationModalData.precoConsulta)
        .replace(/[^0-9,\.]/g, "")
        .replace(",", ".")
    ) * 100) / 100;
    if (!preco || preco <= 0) {
      setError({ message: "Informe um valor válido para este local." });
      return;
    }

    // valida horários
    const possuiHorarios = hasAvailabilityHours({
      rua: locationModalData.rua,
      numero: locationModalData.numero,
      complemento: locationModalData.complemento,
      bairro: locationModalData.bairro,
      cidade: locationModalData.cidade,
      estado: locationModalData.estado,
      cep: locationModalData.cep,
      precoConsulta: preco,
      fotoUrl: locationModalData.fotoUrl,
      horariosDisponibilidade: locationModalData.horariosDisponibilidade,
    });
    if (!possuiHorarios) {
      setError({ message: "Defina pelo menos um horário para este local." });
      return;
    }

    const nomeFinal = locationModalData.isDomicilio
      ? "Domicílio"
      : locationModalData.nomeClinica.trim() || `${locationModalData.rua}, ${locationModalData.numero}`;

    setError(null);
    const locationData: LocationData = {
      rua: locationModalData.rua,
      numero: locationModalData.numero,
      complemento: locationModalData.complemento,
      bairro: locationModalData.bairro,
      cidade: locationModalData.cidade,
      estado: locationModalData.estado,
      cep: locationModalData.cep,
      precoConsulta: preco,
      fotoUrl: locationModalData.fotoUrl,
      nomeClinica: nomeFinal,
      horariosDisponibilidade: locationModalData.horariosDisponibilidade,
    };

    setFormData((prev) => {
      if (editingLocationIndex !== null) {
        // Update existing location
        const newLocations = [...prev.locations];
        newLocations[editingLocationIndex] = locationData;
        return {
          ...prev,
          locations: newLocations,
        };
      } else {
        // Add new location
        return {
          ...prev,
          locations: [...prev.locations, locationData],
        };
      }
    });

    // Reset modal
    setLocationModalData({
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
      precoConsulta: "",
      nomeClinica: "",
      isDomicilio: false,
      fotoUrl: "",
      horariosDisponibilidade: {
        segunda: [],
        terca: [],
        quarta: [],
        quinta: [],
        sexta: [],
        sabado: [],
        domingo: [],
      },
    });
    setEditingLocationIndex(null);
    setError(null);
    setShowLocationModal(false);
  };

  const handleRemoveLocation = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      locations: prev.locations.filter((_, i) => i !== index),
    }));
  };

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (user.userType !== "veterinario") {
      router.push("/");
      return;
    }

    const loadProgress = async () => {
      try {
        setIsLoadingInitial(true);

        // Load especialidades from API
        setIsLoadingEspecialidades(true);
        const [especialidadesResponse, planosResponse] = await Promise.all([
          getEspecialidades(),
          getPlanos()
        ]);

        if (especialidadesResponse.success) {
          setEspecialidades(especialidadesResponse.data);
        }
        if (planosResponse) {
          setAvailablePlans(planosResponse);
        }
        setIsLoadingEspecialidades(false);

        // Load onboarding progress and populate data
        await loadVeterinarioData();

        setIsLoadingInitial(false);
      } catch (error) {
        console.error("Error loading onboarding progress:", error);
        setIsLoadingEspecialidades(false);
        setIsLoadingInitial(false);
      }
    };

    const loadVeterinarioData = async () => {
      try {
        const response = await getOnboardingProgress();

        // If user has already started, skip welcome screen and populate data
        if (response.data.currentStep > 1) {
          // Ensure currentStep is within valid bounds (0-8)
          const validCurrentStep = Math.min(
            Math.max(response.data.currentStep, 0),
            8
          );
          setCurrentStep(validCurrentStep);
        }

        // Populate form data from backend if it exists
        const veterinarioData = response.data.veterinario;
        if (veterinarioData) {
          // Helper function to capitalize first letter to match dropdown options
          const capitalizeFirstLetter = (str: string) =>
            str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

          interface EnderecoData {
            id?: string;
            rua: string;
            numero: string;
            bairro: string;
            cidade: string;
            estado: string;
            cep: string;
            complemento?: string;
            precoConsulta?: number;
            fotoUrl?: string;
            horariosDisponibilidade?: Record<string, unknown>;
          }

          // Process locations from enderecos (addresses) in the user data
          let processedLocations = (veterinarioData.enderecos || []).map(
            (endereco: EnderecoData) => {
              // Convert availability format from {day: [{inicio: "09:00", fim: "17:00"}]} to {day: ["09:00", "09:30", ...]}
              const horariosDisponibilidade: { [key: string]: string[] } = {
                segunda: [],
                terca: [],
                quarta: [],
                quinta: [],
                sexta: [],
                sabado: [],
                domingo: [],
              };

              if (endereco.horariosDisponibilidade) {
                Object.entries(endereco.horariosDisponibilidade).forEach(
                  ([day, slots]) => {
                    if (Array.isArray(slots)) {
                      const timeSlots: string[] = [];
                      slots.forEach((slot) => {
                        if (slot.inicio && slot.fim) {
                          const startHour = parseInt(slot.inicio.split(":")[0]);
                          const startMinute = parseInt(
                            slot.inicio.split(":")[1]
                          );
                          const endHour = parseInt(slot.fim.split(":")[0]);
                          const endMinute = parseInt(slot.fim.split(":")[1]);

                          // Generate 30-minute time slots between inicio and fim
                          let currentHour = startHour;
                          let currentMinute = startMinute;

                          while (
                            currentHour < endHour ||
                            (currentHour === endHour &&
                              currentMinute < endMinute)
                          ) {
                            const timeString = `${currentHour
                              .toString()
                              .padStart(2, "0")}:${currentMinute
                                .toString()
                                .padStart(2, "0")}`;
                            timeSlots.push(timeString);

                            currentMinute += 30;
                            if (currentMinute >= 60) {
                              currentMinute = 0;
                              currentHour++;
                            }
                          }
                        }
                      });
                      horariosDisponibilidade[day] = timeSlots;
                    }
                  }
                );
              }

              return {
                rua: endereco.rua,
                numero: endereco.numero,
                bairro: endereco.bairro,
                complemento: endereco.complemento,
                cidade: endereco.cidade,
                estado: endereco.estado,
                cep: endereco.cep,
                precoConsulta: endereco.precoConsulta,
                fotoUrl: endereco.fotoUrl,
                horariosDisponibilidade,
              };
            }
          );

          // If no enderecos exist but user has address information, create a default location
          if (processedLocations.length === 0 && veterinarioData.user) {
            const userData = veterinarioData.user;
            if (
              userData.cep &&
              userData.rua &&
              userData.numero &&
              userData.cidade &&
              userData.estado &&
              userData.bairro
            ) {
              processedLocations = [
                {
                  rua: userData.rua,
                  numero: userData.numero,
                  bairro: userData.bairro,
                  cidade: userData.cidade,
                  estado: userData.estado,
                  cep: userData.cep,
                  horariosDisponibilidade: {
                    segunda: [],
                    terca: [],
                    quarta: [],
                    quinta: [],
                    sexta: [],
                    sabado: [],
                    domingo: [],
                  },
                },
              ];
            }
          }

          setFormData((prevData) => ({
            ...prevData,
            crmv: veterinarioData.crmv || prevData.crmv,
            genero: veterinarioData.genero
              ? capitalizeFirstLetter(veterinarioData.genero)
              : prevData.genero,
            especialidades:
              veterinarioData.especialidades?.map(
                (esp: { id: string }) => esp.id
              ) || prevData.especialidades,
            visitTypes: {
              presencial: veterinarioData.atendePresencial === 1 || veterinarioData.atendePresencial === true,
              online: veterinarioData.atendeOnline === 1 || veterinarioData.atendeOnline === true,
            },
            locations: processedLocations,
            precoConsultaOnline: veterinarioData.precoConsultaOnline ? String(veterinarioData.precoConsultaOnline) : prevData.precoConsultaOnline,
            about: veterinarioData.bio || prevData.about,
            experiencias: veterinarioData.experiencias || [],
            planos: veterinarioData.planos?.map((p: any) => p.id) || [],
          }));

          // Se já existir foto no perfil, usar como preview inicial
          if (veterinarioData.user?.fotoUrl || veterinarioData.fotoUrl) {
            setPhotoPreview(
              veterinarioData.user?.fotoUrl || veterinarioData.fotoUrl
            );
          } else if (user?.fotoUrl) {
            setPhotoPreview(user.fotoUrl);
          }
        }

        if (response.data.currentStep >= 8) {
          router.push("/dashboard/veterinario");
        }
      } catch (error) {
        console.error("Error loading veterinario data:", error);
      }
    };
    loadProgress();
  }, [user, loading, router]);

  const handleNext = async () => {
    if (currentStep === 0) {
      setCurrentStep(1);
      return;
    }

    setIsLoading(true);

    try {
      const veterinarioId = user!.id.toString();

      switch (currentStep) {
        case 1:
          await submitOnboardingStep1(veterinarioId, { crmv: formData.crmv });
          break;
        case 2:
          // Upload de foto (opcional) antes de salvar o passo 2
          if (selectedPhoto) {
            try {
              setIsUploadingPhoto(true);
              const result = await uploadOnboardingPhoto(selectedPhoto);
              if (result?.url) {
                setPhotoPreview(result.url);
                updateUser({ fotoUrl: result.url });
              }
            } catch (upErr) {
              // Não bloquear o fluxo se falhar. Exibir erro e seguir salvando gênero.
              setError(
                handleApiError(upErr, {
                  400: "Formato de imagem inválido.",
                  413: "Arquivo muito grande (máx. 5MB).",
                  500: "Falha ao enviar a foto. Tente novamente.",
                })
              );
            } finally {
              setIsUploadingPhoto(false);
            }
          }
          await submitOnboardingStep2(veterinarioId, {
            genero: formData.genero,
          });
          break;
        case 3:
          // IDs are already stored as numbers, no conversion needed
          await submitOnboardingStep3(veterinarioId, {
            especialidades: formData.especialidades,
          });
          break;
        case 4:
          const visitData = {
            visitTypes: formData.visitTypes,
            ...(formData.visitTypes.presencial && {
              locations: formData.locations.map((location) => ({
                rua: location.rua,
                numero: location.numero,
                bairro: location.bairro,
                complemento: location.complemento,
                cidade: location.cidade,
                estado: location.estado,
                cep: removeMask(location.cep),
                isPrimary: false,
                aceitaEmergencia: false,
                observacoes: "",
                precoConsulta: Math.round(Number(location.precoConsulta) * 100) / 100,
                horariosDisponibilidade: location.horariosDisponibilidade,
                fotoUrl: location.fotoUrl,
                nomeClinica: location.nomeClinica,
              })),
            }),
            ...(formData.visitTypes.online && {
              precoConsultaOnline: Math.round(Number(
                String(formData.precoConsultaOnline)
                  .replace(/[^0-9,\.]/g, "")
                  .replace(",", ".")
              ) * 100) / 100,
            }),
          };

          await submitOnboardingStep4(veterinarioId, visitData);
          break;
        case 5:
          await submitOnboardingStep5(veterinarioId, { experiencias: formData.experiencias });
          break;
        case 6:
          await submitOnboardingStep6(veterinarioId, { planos: formData.planos });
          break;
        case 7:
          await submitOnboardingStep7(veterinarioId, { about: formData.about });
          await completeVeterinarioOnboarding();
          updateUser({ onboardingComplete: 1 });
          router.push("/dashboard/veterinario");
          return;
      }

      // Ensure currentStep doesn't exceed bounds
      const nextStep = Math.min(currentStep + 1, 7);
      setCurrentStep(nextStep);
    } catch (err) {
      let errorMessages = {};

      switch (currentStep) {
        case 1:
          errorMessages = {
            400: "CRMV já está sendo usado por outro veterinário.",
            422: "Dados inválidos. Verifique se todos os campos estão preenchidos corretamente.",
          };
          break;
        case 2:
          errorMessages = {
            422: "Dados pessoais inválidos. Verifique se o gênero foi selecionado.",
          };
          break;
        case 3:
          errorMessages = {
            422: "Especialidades inválidas. Selecione pelo menos uma especialidade válida.",
          };
          break;
        case 4:
          errorMessages = {
            422: "Dados de atendimento inválidos. Verifique os tipos de atendimento e localizações.",
          };
          break;
        case 5:
          errorMessages = {
            422: "Dados do perfil inválidos. Verifique se a descrição foi preenchida.",
          };
          break;
        default:
          errorMessages = {};
      }

      const errorState = handleApiError(err, errorMessages);
      setError(errorState);
      console.error("Error submitting onboarding step:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers de foto
  const handlePhotoUpdate = async (file: File) => {
    setSelectedPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const onSelectPhoto = (file?: File | null) => {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setError({ message: "Formato inválido. Use JPG, PNG, WEBP ou GIF." });
      return;
    }
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError({ message: "Arquivo muito grande. Máximo de 5MB." });
      return;
    }

    setError(null);
    setSelectedPhoto(file);

    const url = URL.createObjectURL(file);
    // Liberar URL antiga para evitar leaks
    if (photoPreview && photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(url);
  };

  const clearSelectedPhoto = () => {
    if (photoPreview && photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    setSelectedPhoto(null);
    // Mantém preview existente se for URL remota (já salva). Caso seja blob, limpa.
    if (photoPreview?.startsWith("blob:")) {
      setPhotoPreview(null);
    }
  };

  const handleBack = async () => {
    if (currentStep > 0) {
      setIsLoadingBack(true);
      // Ensure newStep doesn't go below 0
      const newStep = Math.max(currentStep - 1, 0);
      setCurrentStep(newStep);

      // If going back to a step that might have data, reload from backend
      if (newStep > 0) {
        try {
          const response = await getOnboardingProgress();

          // Populate form data from backend if it exists
          const veterinarioData = response.data.veterinario;
          if (veterinarioData) {
            // Helper function to capitalize first letter to match dropdown options
            const capitalizeFirstLetter = (str: string) =>
              str
                ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
                : "";

            // Process locations from enderecos (addresses) in the user data
            let processedLocations = (veterinarioData.enderecos || []).map(
              (endereco: {
                rua: string;
                numero: string;
                bairro: string;
                cidade: string;
                estado: string;
                cep: string;
                horariosDisponibilidade?: Record<
                  string,
                  Array<{ inicio?: string; fim?: string }>
                >;
              }) => {
                // Convert availability format from {day: [{inicio: "09:00", fim: "17:00"}]} to {day: ["09:00", "09:30", ...]}
                const horariosDisponibilidade: { [key: string]: string[] } = {
                  segunda: [],
                  terca: [],
                  quarta: [],
                  quinta: [],
                  sexta: [],
                  sabado: [],
                  domingo: [],
                };

                if (endereco.horariosDisponibilidade) {
                  Object.entries(endereco.horariosDisponibilidade).forEach(
                    ([day, slots]) => {
                      if (Array.isArray(slots)) {
                        const timeSlots: string[] = [];
                        slots.forEach(
                          (slot: { inicio?: string; fim?: string }) => {
                            if (slot.inicio && slot.fim) {
                              const startHour = parseInt(
                                slot.inicio.split(":")[0]
                              );
                              const startMinute = parseInt(
                                slot.inicio.split(":")[1]
                              );
                              const endHour = parseInt(slot.fim.split(":")[0]);
                              const endMinute = parseInt(
                                slot.fim.split(":")[1]
                              );

                              // Generate 30-minute time slots between inicio and fim
                              let currentHour = startHour;
                              let currentMinute = startMinute;

                              while (
                                currentHour < endHour ||
                                (currentHour === endHour &&
                                  currentMinute < endMinute)
                              ) {
                                const timeString = `${currentHour
                                  .toString()
                                  .padStart(2, "0")}:${currentMinute
                                    .toString()
                                    .padStart(2, "0")}`;
                                timeSlots.push(timeString);

                                currentMinute += 30;
                                if (currentMinute >= 60) {
                                  currentMinute = 0;
                                  currentHour++;
                                }
                              }
                            }
                          }
                        );
                        horariosDisponibilidade[day] = timeSlots;
                      }
                    }
                  );
                }

                return {
                  rua: endereco.rua,
                  numero: endereco.numero,
                  bairro: endereco.bairro,
                  cidade: endereco.cidade,
                  estado: endereco.estado,
                  cep: endereco.cep,
                  horariosDisponibilidade,
                };
              }
            );

            // If no enderecos exist but user has address information, create a default location
            if (processedLocations.length === 0 && veterinarioData.user) {
              const userData = veterinarioData.user;
              if (
                userData.cep &&
                userData.rua &&
                userData.numero &&
                userData.cidade &&
                userData.estado &&
                userData.bairro
              ) {
                processedLocations = [
                  {
                    rua: userData.rua,
                    numero: userData.numero,
                    bairro: userData.bairro,
                    cidade: userData.cidade,
                    estado: userData.estado,
                    cep: userData.cep,
                    horariosDisponibilidade: {
                      segunda: [],
                      terca: [],
                      quarta: [],
                      quinta: [],
                      sexta: [],
                      sabado: [],
                      domingo: [],
                    },
                  },
                ];
              }
            }

            setFormData((prevData) => ({
              ...prevData,
              crmv: veterinarioData.crmv || prevData.crmv,
              genero: veterinarioData.genero
                ? capitalizeFirstLetter(veterinarioData.genero)
                : prevData.genero,
              especialidades:
                veterinarioData.especialidades?.map(
                  (esp: { id: string }) => esp.id
                ) || prevData.especialidades,
              visitTypes: {
                presencial: veterinarioData.atendePresencial === 1,
                online: veterinarioData.atendeOnline === 1,
              },
              locations: processedLocations,
              about: veterinarioData.bio || prevData.about,
            }));
          }
        } catch (error) {
          console.error("Error loading data when going back:", error);
        }
      }
      setIsLoadingBack(false);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 0:
        return true; // Welcome screen is always valid
      case 1:
        return formData.crmv.trim() !== "";
      case 2:
        return formData.genero !== "";
      case 3:
        return formData.especialidades.length > 0;
      case 4:
        const hasValidVisitType =
          formData.visitTypes.presencial || formData.visitTypes.online;
        // If presencial is selected, at least one location is required
        const hasRequiredLocations =
          !formData.visitTypes.presencial || formData.locations.length > 0;
        // validar preço e horários por local quando presencial
        const locaisValidos = !formData.visitTypes.presencial
          ? true
          : formData.locations.every(
            (l) =>
              Number(l.precoConsulta) > 0 &&
              [
                "segunda",
                "terca",
                "quarta",
                "quinta",
                "sexta",
                "sabado",
                "domingo",
              ].some((d) => (l.horariosDisponibilidade?.[d] || []).length > 0)
          );
        // validar preço online quando online
        const onlineValido = !formData.visitTypes.online
          ? true
          : Number(
            String(formData.precoConsultaOnline)
              .replace(/[^0-9,\.]/g, "")
              .replace(",", ".")
          ) > 0;
        // // se ambos selecionados, online < min presencial
        // let regraOnlineMenor = true;
        // if (
        //   formData.visitTypes.presencial &&
        //   formData.visitTypes.online &&
        //   formData.locations.length > 0
        // ) {
        //   const minPresencial = Math.min(
        //     ...formData.locations.map((l) => Number(l.precoConsulta))
        //   );
        //   const online = Number(
        //     String(formData.precoConsultaOnline)
        //       .replace(/[^0-9,\.]/g, "")
        //       .replace(",", ".")
        //   );
        //   // Preço online válido (removida regra de ser menor que presencial)
        //   regraOnlineMenor = true;
        // }
        return (
          hasValidVisitType &&
          hasRequiredLocations &&
          locaisValidos &&
          onlineValido
        );
      case 5:
        // Experiência é opcional? Se for obrigatória:
        // return formData.experiencias.length > 0;
        return true;
      case 6:
        // Planos opcionais 
        return true;
      case 7:
        return formData.about.trim() !== "";
      default:
        return false;
    }
  };

  if (loading || isLoadingInitial) {
    return (
      <div className="main-content">
        <div className={styles.loadingScreen}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>
            {loading ? "Carregando..." : "Carregando informações do perfil..."}
          </p>
        </div>
      </div>
    );
  }

  if (!user || user.userType !== "veterinario") {
    return null;
  }

  const stepInfo = onboardingSteps[currentStep] || onboardingSteps[0];

  return (
    <div className={styles.container}>
      {/* Sidebar - Integrated with Steps and Images */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarImageContainer}>
          <Image
            src={
              currentStep === 0
                ? "/img/checklist.png"
                : currentStep === 1
                  ? "/img/id2.png"
                  : currentStep === 2
                    ? "/img/hifive.png"
                    : currentStep === 3
                      ? "/img/blocks.png"
                      : currentStep === 4
                        ? "/img/location.png"
                        : "/img/meditating.png"
            }
            alt="Onboarding"
            width={200}
            height={160}
            className={styles.heroImage}
            priority
          />
        </div>

        <div className={styles.stepsContainer}>
          {onboardingSteps.map((step, index) => (
            <div
              key={index}
              className={`${styles.stepItem} ${index === currentStep ? styles.activeStep : ""
                } ${index < currentStep ? styles.completedStep : ""}`}
            >
              <div className={styles.stepIndicator}>
                {index < currentStep ? <Check size={16} /> : index + 1}
              </div>
              <div className={styles.stepContent}>
                <span className={styles.stepTitle}>{step.title}</span>
                <span className={styles.stepDescription}>{step.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        <div className={styles.formWrapper}>
          {error && currentStep > 0 && (
            <div className={styles.errorContainer}>
              <p className={styles.errorMessage}>{error.message}</p>
            </div>
          )}

          {currentStep === 0 && (
            <div className={styles.welcomeScreen}>
              <h1 className={styles.welcomeTitle}>Bem-vindo ao Lince Pet!</h1>
              <p className={styles.welcomeDescription}>
                Estamos muito felizes em ter você conosco. Vamos configurar seu perfil profissional em poucos passos.
              </p>
              <div className={styles.requirementsList}>
                <h3 className={styles.requirementsTitle}>
                  O que vamos precisar:
                </h3>

                <div className={styles.requirementItem}>
                  <Check
                    size={12}
                    strokeWidth={3}
                    className={styles.checkIcon}
                  />
                  Número do seu CRMV válido
                </div>

                <div className={styles.requirementItem}>
                  <Check
                    size={12}
                    strokeWidth={3}
                    className={styles.checkIcon}
                  />
                  Lista das suas especialidades veterinárias
                </div>

                <div className={styles.requirementItem}>
                  <Check
                    size={12}
                    strokeWidth={3}
                    className={styles.checkIcon}
                  />
                  Decidir se oferecerá consultas presenciais ou online
                </div>

                <div className={styles.requirementItem}>
                  <Check
                    size={12}
                    strokeWidth={3}
                    className={styles.checkIcon}
                  />
                  Uma breve apresentação sobre sua experiência
                </div>
              </div>
            </div>
          )}

          {currentStep > 0 && (
            <>
              <h2 className={styles.formTitle}>{stepInfo.title}</h2>
              <p className={styles.formSubtitle}>{stepInfo.description}</p>
            </>
          )}

          {currentStep === 1 && (
            <div className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>CRMV</label>
                <input
                  type="text"
                  value={formData.crmv}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      crmv: formatCrmvInput(e.target.value),
                    })
                  }
                  className={styles.input}
                  inputMode="text"
                  autoCapitalize="characters"
                  maxLength={15}
                  placeholder="Ex.: 12345-MG"
                />
                <div
                  className={styles.hintText}
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 6,
                  }}
                >
                  Modelo: 12345-MG (o hífen é inserido automaticamente)
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>
                  Foto de perfil (opcional)
                </label>
                <div className={styles.photoUpload}>
                  <div style={{ width: 180, height: 180, margin: "0 auto" }}>
                    <ProfileImageUploader
                      userName={user?.nome || "Veterinário"}
                      currentImageUrl={photoPreview}
                      onUpload={handlePhotoUpdate}
                      isUploading={isUploadingPhoto}
                    />
                  </div>
                  <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                    Clique na imagem para alterar
                  </div>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Gênero</label>
                <Dropdown
                  searchable={false}
                  options={[
                    { value: "Masculino", label: "Masculino" },
                    { value: "Feminino", label: "Feminino" },
                    { value: "Outro", label: "Outro" },
                    {
                      value: "Prefiro não informar",
                      label: "Prefiro não informar",
                    },
                  ]}
                  value={formData.genero}
                  onChange={(value) =>
                    setFormData({ ...formData, genero: value })
                  }
                  placeholder="Selecione seu gênero"
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Especialidades</label>
                <div className={styles.especialidadesContainer}>
                  {isLoadingEspecialidades ? (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: "40px",
                        color: "var(--text-muted)",
                        fontSize: "14px",
                      }}
                    >
                      Carregando especialidades...
                    </div>
                  ) : (
                    <div className={styles.especialidadesList}>
                      {especialidades.map((especialidade) => (
                        <CustomCheckbox
                          key={especialidade.id}
                          checked={formData.especialidades.includes(
                            especialidade.id
                          )}
                          onChange={(checked) => {
                            if (checked) {
                              setFormData({
                                ...formData,
                                especialidades: [
                                  ...formData.especialidades,
                                  especialidade.id,
                                ],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                especialidades: formData.especialidades.filter(
                                  (id) => id !== especialidade.id
                                ),
                              });
                            }
                          }}
                          label={especialidade.nome}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className={styles.form}>
              <div className={styles.visitTypesContainer}>
                <div
                  className={`${styles.visitTypeOption} ${formData.visitTypes.presencial ? styles.selected : ""
                    }`}
                >
                  <CustomCheckbox
                    checked={formData.visitTypes.presencial}
                    onChange={(checked) =>
                      setFormData({
                        ...formData,
                        visitTypes: {
                          ...formData.visitTypes,
                          presencial: checked,
                        },
                      })
                    }
                    label=""
                  />
                  <div
                    className={styles.visitTypeInfo}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        visitTypes: {
                          ...formData.visitTypes,
                          presencial: !formData.visitTypes.presencial,
                        },
                      })
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <div className={styles.visitTypeTitle}>
                      Atendimento Presencial
                    </div>
                    <div className={styles.visitTypeDescription}>
                      Consultas na sua clínica ou em domicílio
                    </div>
                  </div>
                </div>

                <div
                  className={`${styles.visitTypeOption} ${formData.visitTypes.online ? styles.selected : ""
                    }`}
                >
                  <CustomCheckbox
                    checked={formData.visitTypes.online}
                    onChange={(checked) =>
                      setFormData({
                        ...formData,
                        visitTypes: {
                          ...formData.visitTypes,
                          online: checked,
                        },
                      })
                    }
                    label=""
                  />
                  <div
                    className={styles.visitTypeInfo}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        visitTypes: {
                          ...formData.visitTypes,
                          online: !formData.visitTypes.online,
                        },
                      })
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <div className={styles.visitTypeTitle}>Telemedicina</div>
                    <div className={styles.visitTypeDescription}>
                      Consultas online por videochamada
                    </div>
                  </div>
                </div>

                {formData.visitTypes.online && (
                  <div className={styles.inputGroup} style={{ marginTop: 12 }}>
                    <label className={styles.label}>
                      Preço da consulta online
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={formData.precoConsultaOnline}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          precoConsultaOnline: e.target.value,
                        })
                      }
                      className={styles.input}
                      placeholder="Ex: 80,00"
                      onWheel={(e) => e.currentTarget.blur()}
                    />

                  </div>
                )}
              </div>

              {/* Locations section - only show when presencial is selected */}
              {formData.visitTypes.presencial && (
                <div className={styles.locationsSection}>
                  <div className={styles.locationsSectionHeader}>
                    <h4 className={styles.locationsTitle}>Seus locais</h4>
                    <button
                      type="button"
                      onClick={handleOpenNewLocationModal}
                      className={styles.addLocationButton}
                    >
                      <Plus size={16} />
                      Adicionar local
                    </button>
                  </div>

                  {formData.locations.length === 0 ? (
                    <div className={styles.noLocationsMessage}>
                      <MapPin size={24} className={styles.noLocationsIcon} />
                      <p>Você ainda não tem nenhuma localização definida.</p>
                      <p className={styles.noLocationsSubtext}>
                        Adicione pelo menos um local para oferecer atendimento
                        presencial.
                      </p>
                    </div>
                  ) : (
                    <div className={styles.locationsList}>
                      {formData.locations.map((location, index) => (
                        <div key={index} className={styles.locationCard}>
                          <div
                            className={styles.locationInfo}
                            onClick={() => handleEditLocation(index)}
                            style={{ cursor: "pointer" }}
                          >
                            <div className={styles.locationAddress} style={{ display: 'flex', flexDirection: 'column' }}>
                              {location.nomeClinica && (
                                <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--primary-color)' }}>
                                  {location.nomeClinica}
                                </span>
                              )}
                              <span>
                                {location.rua}, {location.numero}
                              </span>
                              {!hasAvailabilityHours(location) && (
                                <div className={styles.noAvailabilityWarning}>
                                  <Tooltip
                                    text="Nenhum horário de disponibilidade definido - Clique para configurar"
                                    icon={<OctagonAlert size={16} />}
                                    iconColor="#ef4444"
                                  />
                                </div>
                              )}
                            </div>
                            <div className={styles.locationDetails}>
                              {location.bairro}, {location.cidade} -{" "}
                              {location.estado}
                              {" • R$ "}
                              {Number(location.precoConsulta).toFixed(2)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveLocation(index)}
                            className={styles.removeLocationButton}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {currentStep === 5 && (
            <div className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Experiências Profissionais</label>

                {/* Form to add experience */}
                <div className={styles.experienceForm} style={{ marginBottom: 20, padding: 20, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  <div className={styles.inputRow}>
                    <div className={styles.inputGroup} style={{ flex: 1 }}>
                      <input
                        type="text"
                        placeholder="Cargo"
                        className={styles.input}
                        value={experienceForm.cargo}
                        onChange={e => setExperienceForm({ ...experienceForm, cargo: e.target.value })}
                      />
                    </div>
                    <div className={styles.inputGroup} style={{ flex: 1 }}>
                      <input
                        type="text"
                        placeholder="Local / Empresa"
                        className={styles.input}
                        value={experienceForm.local}
                        onChange={e => setExperienceForm({ ...experienceForm, local: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className={styles.inputRow}>
                    <div className={styles.inputGroup} style={{ flex: 1 }}>
                      <label style={{ fontSize: 12 }}>Data Início</label>
                      <input
                        type="date"
                        className={styles.input}
                        value={experienceForm.dataInicio}
                        onChange={e => setExperienceForm({ ...experienceForm, dataInicio: e.target.value })}
                      />
                    </div>
                    <div className={styles.inputGroup} style={{ flex: 1 }}>
                      <label style={{ fontSize: 12 }}>Data Fim (deixe vazio se atual)</label>
                      <input
                        type="date"
                        className={styles.input}
                        value={experienceForm.dataFim || ''}
                        onChange={e => setExperienceForm({ ...experienceForm, dataFim: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className={styles.inputGroup}>
                    <textarea
                      placeholder="Descrição das atividades..."
                      className={styles.textarea}
                      style={{ height: 80 }}
                      value={experienceForm.descricao || ''}
                      onChange={e => setExperienceForm({ ...experienceForm, descricao: e.target.value })}
                    />
                  </div>
                  <button
                    className={styles.addLocationButton}
                    onClick={() => {
                      if (!experienceForm.cargo || !experienceForm.local || !experienceForm.dataInicio) {
                        alert("Preencha cargo, local e data de início");
                        return;
                      }
                      setFormData({
                        ...formData,
                        experiencias: [...formData.experiencias, { ...experienceForm, ativo: !experienceForm.dataFim }]
                      });
                      setExperienceForm({
                        local: "", cargo: "", dataInicio: "", dataFim: "", descricao: "", ativo: false
                      });
                    }}
                  >
                    <Plus size={16} /> Adicionar Experiência
                  </button>
                </div>

                {/* List of experiences */}
                <div className={styles.locationsList}>
                  {formData.experiencias.map((exp, idx) => (
                    <div key={idx} className={styles.locationCard}>
                      <div className={styles.locationInfo}>
                        <div className={styles.locationAddress} style={{ fontWeight: 'bold' }}>{exp.cargo}</div>
                        <div className={styles.locationDetails}>
                          {exp.local} • {exp.dataInicio} - {exp.dataFim || 'Atualmente'}
                        </div>
                        {exp.descricao && <div className={styles.experienceDescription}>{exp.descricao}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            experiencias: formData.experiencias.filter((_, i) => i !== idx)
                          });
                        }}
                        className={styles.removeLocationButton}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Planos de Saúde Aceitos</label>
                <div className={styles.especialidadesList}>
                  {availablePlans.map(plan => (
                    <CustomCheckbox
                      key={plan.id}
                      label={plan.name}
                      checked={formData.planos.includes(plan.id)}
                      onChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, planos: [...formData.planos, plan.id] });
                        } else {
                          setFormData({ ...formData, planos: formData.planos.filter(id => id !== plan.id) });
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 7 && (
            <div className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>
                  Conte um pouco sobre você
                </label>
                <textarea
                  value={formData.about}
                  onChange={(e) => {
                    const text = e.target.value;
                    if (text.length <= 500) {
                      setFormData({ ...formData, about: text });
                    }
                  }}
                  maxLength={500}
                  className={styles.textarea}
                  placeholder="Descreva sua experiência, formação, especialização e o que considera mais importante em seu trabalho veterinário..."
                />
                <div className={styles.characterCount}>
                  {formData.about.length}/500 caracteres
                </div>
              </div>
            </div>
          )}

          <div className={styles.buttonContainer}>
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                disabled={isLoading || isLoadingBack}
                className={styles.backButton}
              >
                {isLoadingBack ? "Carregando..." : "Voltar"}
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!isStepValid() || isLoading}
              className={styles.continueButton}
            >
              {isLoading
                ? "Salvando..."
                : currentStep === 0
                  ? "Começar"
                  : currentStep === 7
                    ? "Finalizar"
                    : "Continuar"}
            </button>
          </div>

          {isLoading && (
            <p className={styles.loadingText}>
              Processando suas informações...
            </p>
          )}
        </div>

        {/* Location Modal */}
        {showLocationModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h3>
                  {editingLocationIndex !== null
                    ? "Editar Local"
                    : "Adicionar Local"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationModal(false);
                    setEditingLocationIndex(null);
                    setError(null);
                  }}
                  className={styles.modalCloseButton}
                >
                  <X size={20} />
                </button>
              </div>

              <div className={styles.modalContent}>
                {error && (
                  <div className={styles.errorContainer}>
                    <p className={styles.errorMessage}>{error.message}</p>
                  </div>
                )}

                <div className={styles.modalForm}>

                  {/* Nome do Local e Domicílio */}
                  <div className={styles.inputGroup} style={{ marginBottom: 20 }}>
                    <label className={styles.label} style={{ fontSize: '1.1rem', fontWeight: 600 }}>Nome do Local</label>
                    <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 8, marginTop: -4 }}>Como seus clientes identificarão este endereço?</p>

                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                      <CustomCheckbox
                        checked={locationModalData.isDomicilio}
                        onChange={(checked) => setLocationModalData(prev => ({
                          ...prev,
                          isDomicilio: checked,
                          nomeClinica: checked ? "Domicílio" : ""
                        }))}
                        label="É atendimento domiciliar?"
                      />
                    </div>

                    <input
                      type="text"
                      value={locationModalData.isDomicilio ? "Domicílio" : locationModalData.nomeClinica}
                      disabled={locationModalData.isDomicilio}
                      onChange={(e) => setLocationModalData(prev => ({ ...prev, nomeClinica: e.target.value }))}
                      className={styles.input}
                      placeholder={locationModalData.isDomicilio ? "Domicílio" : "Ex: Clínica Veterinária Central, Consultório Pet..."}
                      style={{
                        backgroundColor: locationModalData.isDomicilio ? '#f3f4f6' : 'white',
                        fontWeight: 500
                      }}
                    />
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '20px 0' }} />

                  <div className={styles.inputGroup} style={{
                    backgroundColor: '#fffaf0ff',
                    padding: '15px',
                    borderRadius: '8px',
                    border: '1px solid #d35400'
                  }}>
                    <label className={styles.label} style={{ color: '#e67e22', fontWeight: 700, fontSize: '1rem' }}>
                      Valor da Consulta (R$)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={locationModalData.precoConsulta}
                      onChange={(e) =>
                        setLocationModalData((prev) => ({
                          ...prev,
                          precoConsulta: e.target.value,
                        }))
                      }
                      className={styles.input}
                      placeholder="0,00"
                      style={{
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        padding: '12px',
                        borderColor: '#d35400',
                        boxShadow: '0 0 0 1px rgba(14, 165, 233, 0.2)'
                      }}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                    <p style={{ fontSize: '0.8rem', color: '#e67e22', marginTop: 5 }}>
                      Este valor aparecerá em destaque para os tutores no agendamento.
                    </p>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '20px 0' }} />

                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Foto do Local</label>
                    <div style={{ height: 150, marginBottom: 20 }}>
                      <ProfileImageUploader
                        currentImageUrl={locationModalData.fotoUrl}
                        userName={locationModalData.rua || "Local"}
                        onUpload={async (file) => {
                          try {
                            const res = await uploadOnboardingGeneric(file);
                            setLocationModalData((prev) => ({
                              ...prev,
                              fotoUrl: res.url,
                            }));
                          } catch (err) {
                            console.error("Erro ao enviar foto do local:", err);
                          }
                        }}
                        borderRadius="12px"
                        cropShape="square"
                      />
                    </div>
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.label}>CEP</label>
                    <input
                      type="text"
                      value={locationModalData.cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      className={styles.input}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    {isCepLoading && (
                      <div className={styles.cepLoading}>Buscando CEP...</div>
                    )}
                  </div>

                  <div className={styles.inputRow}>
                    <div className={styles.inputGroup} style={{ flex: 3 }}>
                      <label className={styles.label}>Rua</label>
                      <input
                        type="text"
                        value={locationModalData.rua}
                        onChange={(e) =>
                          setLocationModalData((prev) => ({
                            ...prev,
                            rua: e.target.value,
                          }))
                        }
                        className={styles.input}
                        placeholder="Nome da rua"
                      />
                    </div>
                    <div className={styles.inputGroup} style={{ flex: 1 }}>
                      <label className={styles.label}>Número</label>
                      <input
                        type="text"
                        value={locationModalData.numero}
                        onChange={(e) =>
                          setLocationModalData((prev) => ({
                            ...prev,
                            numero: e.target.value,
                          }))
                        }
                        className={styles.input}
                        placeholder="123"
                      />
                    </div>
                  </div>

                  <div className={styles.inputRow}>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Complemento</label>
                      <input
                        type="text"
                        value={locationModalData.complemento}
                        onChange={(e) =>
                          setLocationModalData((prev) => ({
                            ...prev,
                            complemento: e.target.value,
                          }))
                        }
                        className={styles.input}
                        placeholder="Apto 101, Bloco A, etc. (opcional)"
                      />
                    </div>
                  </div>

                  <div className={styles.inputRow}>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Bairro</label>
                      <input
                        type="text"
                        value={locationModalData.bairro}
                        onChange={(e) =>
                          setLocationModalData((prev) => ({
                            ...prev,
                            bairro: e.target.value,
                          }))
                        }
                        className={styles.input}
                        placeholder="Nome do bairro"
                      />
                    </div>
                  </div>

                  <div className={styles.inputRow}>
                  </div>

                  <div className={styles.inputRow}>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Cidade</label>
                      <input
                        type="text"
                        value={locationModalData.cidade}
                        onChange={(e) =>
                          setLocationModalData((prev) => ({
                            ...prev,
                            cidade: e.target.value,
                          }))
                        }
                        className={styles.input}
                        placeholder="Nome da cidade"
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Estado</label>
                      <input
                        type="text"
                        value={locationModalData.estado}
                        onChange={(e) =>
                          setLocationModalData((prev) => ({
                            ...prev,
                            estado: e.target.value,
                          }))
                        }
                        className={styles.input}
                        placeholder="SP"
                        maxLength={2}
                      />
                    </div>
                  </div>

                  <div className={styles.horariosSection}>
                    <h4 className={styles.horariosTitle}>
                      <Clock size={16} />
                      Horários de Disponibilidade
                    </h4>
                    <p className={styles.horariosSubtext}>
                      Selecione os horários em que você estará disponível neste
                      local:
                    </p>

                    {[
                      "segunda",
                      "terca",
                      "quarta",
                      "quinta",
                      "sexta",
                      "sabado",
                      "domingo",
                    ].map((day) => {
                      const dayNames: { [key: string]: string } = {
                        segunda: "Segunda-feira",
                        terca: "Terça-feira",
                        quarta: "Quarta-feira",
                        quinta: "Quinta-feira",
                        sexta: "Sexta-feira",
                        sabado: "Sábado",
                        domingo: "Domingo",
                      };

                      return (
                        <div key={day} className={styles.daySchedule}>
                          <div className={styles.dayLabel}>{dayNames[day]}</div>
                          <div className={styles.timeSlots}>
                            {generateTimeSlots().map((time) => (
                              <button
                                key={time}
                                type="button"
                                onClick={() => handleTimeToggle(day, time)}
                                className={`${styles.timeSlot} ${locationModalData.horariosDisponibilidade[
                                  day
                                ]?.includes(time)
                                  ? styles.selected
                                  : ""
                                  }`}
                              >
                                {time}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLocationModal(false);
                      setEditingLocationIndex(null);
                      setError(null);
                    }}
                    className={styles.modalCancelButton}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddLocation}
                    className={styles.modalSaveButton}
                  >
                    {editingLocationIndex !== null
                      ? "Salvar Alterações"
                      : "Adicionar Local"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

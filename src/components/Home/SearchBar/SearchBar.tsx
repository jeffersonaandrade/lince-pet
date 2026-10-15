"use client";
import { Search, Stethoscope, MapPin, Shield } from "lucide-react";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import styles from "./searchbar.module.css";
import SearchSection from "../../ui/SearchSection";
import CitySearchSection from "../../ui/CitySearchSection";
import { especialidadesVeterinarias } from "../../../data/especialidades";
import { getPlanos } from "../../../services/veterinarios/veterinarios";

interface UserLocation {
  city: string;
  state: string;
}

interface SearchBarProps {
  showCatImage?: boolean;
  extra?: ReactNode;
}

export default function SearchBar({ showCatImage = false, extra = null }: SearchBarProps) {
  const router = useRouter();

  const [searchValue, setSearchValue] = useState("");
  const [specialtyValue, setSpecialtyValue] = useState("");
  const [locationValue, setLocationValue] = useState("");
  const [plansValue, setPlansValue] = useState("");
  const [planos, setPlanos] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  const lastSectionRef = useRef<HTMLDivElement>(null);

  const allSearchOptions = [...especialidadesVeterinarias];

  const getUserLocation = async () => {
    try {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`
            );
            const data = await response.json();
            if (data.city && data.principalSubdivision) {
              const uf = data.principalSubdivisionCode?.split("-")[1] || data.principalSubdivisionCode || data.principalSubdivision;
              setLocationValue(`${data.city}, ${uf}`);
              setUserLocation({
                city: data.city,
                state:
                  data.principalSubdivisionCode || data.principalSubdivision,
              });
            }
          } catch (error) {
            console.log("Erro ao buscar localização:", error);
          }
        },
        (error) => {
          console.log("Geolocation error:", error);
        },
        { timeout: 10000 }
      );
    } catch (error) {
      console.log("Erro ao obter localização:", error);
    }
  };

  const searchParams = useSearchParams();

  // Sync state with URL changes
  useEffect(() => {
    setSearchValue(searchParams.get("search") || "");
    setSpecialtyValue(searchParams.get("specialty") || "");
    setLocationValue(searchParams.get("location") || "");
    setPlansValue(searchParams.get("plans") || "");
  }, [searchParams]);

  // Só no mount: a localização do GPS não deve sobrescrever a que o usuário escolher depois.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).get("location")) {
      getUserLocation();
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    getPlanos()
      .then((lista: { name?: string }[]) => {
        if (!ativo || !Array.isArray(lista)) return;
        setPlanos(lista.flatMap((plano) => (plano?.name ? [plano.name] : [])));
      })
      .catch(() => {
        if (ativo) setPlanos([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const novos = new URLSearchParams();
    // Mantém a aba e o tipo de serviço escolhidos no /explorar (ex.: profissionais pet > passeador).
    for (const chave of ["tab", "tipo", "ordem", "direcao"]) {
      const valor = searchParams.get(chave);
      if (valor) novos.set(chave, valor);
    }

    if (searchValue.trim())
      novos.set("search", searchValue.trim());
    if (specialtyValue.trim())
      novos.set("specialty", specialtyValue.trim());
    if (locationValue.trim())
      novos.set("location", locationValue.trim());
    if (plansValue.trim()) novos.set("plans", plansValue.trim());

    const queryString = novos.toString();
    if (queryString) {
      router.push(`/explorar?${queryString}`);
    } else {
      router.push("/explorar");
    }
  };

  return (
    <div className={styles.searchContainer}>
      {showCatImage && (
        <Image src="/img/cat.svg" alt="" width={400} height={400} className={`w-auto ${styles.catDecoration}`} />
      )}
      <form onSubmit={handleSearch} className={styles.searchBar}>
        <div
          className={`${styles.multiSectionContainer} ${searchDropdownOpen ? styles.searchDropdownOpen : ""
            }`}
        >
          <SearchSection
            options={[]}
            value={searchValue}
            onChange={setSearchValue}
            placeholder="Nome do profissional ou clínica"
            label="Busca"
            icon={Search}
            searchable={true}
            showRightBorder={true}
            onDropdownStateChange={setSearchDropdownOpen}
            isPlainInput={true}
          />

          <SearchSection
            options={allSearchOptions}
            value={specialtyValue}
            onChange={setSpecialtyValue}
            placeholder="Selecione a especialidade"
            label="Especialidade"
            icon={Stethoscope}
            searchable={true}
            showRightBorder={true}
            onDropdownStateChange={setSearchDropdownOpen}
          />

          <CitySearchSection
            value={locationValue}
            onChange={setLocationValue}
            placeholder={userLocation ? userLocation.city : "Sua cidade"}
            label="Localização"
            icon={MapPin}
            showRightBorder={true}
          />

          <div className={styles.lastSection} ref={lastSectionRef}>
            <SearchSection
              options={planos}
              value={plansValue}
              onChange={setPlansValue}
              placeholder="Planos de saúde"
              label="Plano de Saúde"
              icon={Shield}
              searchable={true}
              onDropdownStateChange={() => { }}
              parentRef={lastSectionRef}
            />
          </div>

          <div className={styles.barActions}>
            {extra}
            <button type="submit" className={styles.searchButton}>
              <Search size={20} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

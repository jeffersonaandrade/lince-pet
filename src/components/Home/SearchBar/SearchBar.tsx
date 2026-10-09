"use client";
import { Search, Stethoscope, MapPin, Shield } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./searchbar.module.css";
import SearchSection from "../../ui/SearchSection";
import CitySearchSection from "../../ui/CitySearchSection";
import { especialidadesVeterinarias } from "../../../data/especialidades";
import { planosSaudeAnimal } from "../../../data/planos-saude";

interface UserLocation {
  city: string;
  state: string;
}

interface SearchBarProps {
  showCatImage?: boolean;
}

export default function SearchBar({ showCatImage = false }: SearchBarProps) {
  const router = useRouter();

  const [searchValue, setSearchValue] = useState("");
  const [specialtyValue, setSpecialtyValue] = useState("");
  const [locationValue, setLocationValue] = useState("");
  const [plansValue, setPlansValue] = useState("");
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
            console.log("location data:", data);
            if (data.city && data.principalSubdivision) {
              setLocationValue(`${data.city}, ${data.principalSubdivisionCode.split('-')[1] || data.principalSubdivisionCode}`);
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

  // Only get user location on initial mount if no location is in URL
  useEffect(() => {
    if (!searchParams.get("location")) {
      getUserLocation();
    }
  }, []); // Run only once on mount

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const searchParams = new URLSearchParams();

    if (searchValue.trim())
      searchParams.set("search", searchValue.trim());
    if (specialtyValue.trim())
      searchParams.set("specialty", specialtyValue.trim());
    if (locationValue.trim())
      searchParams.set("location", locationValue.trim());
    if (plansValue.trim()) searchParams.set("plans", plansValue.trim());

    const queryString = searchParams.toString();
    if (queryString) {
      router.push(`/explorar?${queryString}`);
    } else {
      router.push("/explorar");
    }
  };

  return (
    <div className={styles.searchContainer}>
      {showCatImage && (
        <img src="/img/cat.svg" alt="" className={styles.catDecoration} />
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
            showCategoryFilters={true}
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
              options={planosSaudeAnimal}
              value={plansValue}
              onChange={setPlansValue}
              placeholder="Planos de saúde"
              label="Plano de Saúde"
              icon={Shield}
              searchable={true}
              onDropdownStateChange={() => { }}
              parentRef={lastSectionRef}
            />

            <button type="submit" className={styles.searchButton}>
              <Search size={20} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

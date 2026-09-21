import { OFFER_CITY_VALUES, adminOffersTexts } from "@/lib/adminOffersTranslations";
import type { AppLanguage } from "@/lib/language";

export type StationCityOption = { value: string; label: string };

const CITY_KEYS = OFFER_CITY_VALUES.filter((city) => city !== "All");

// The station address is stored as the Arabic city name, shown in the user's language.
export const getStationCityOptions = (language: AppLanguage, currentAddress?: string | null): StationCityOption[] => {
  const options = CITY_KEYS.map((key) => ({
    value: adminOffersTexts.ar.cities[key],
    label: adminOffersTexts[language].cities[key],
  }));

  // Keep addresses saved before this dropdown existed (e.g. "عينكاوا، أربيل") selectable so editing doesn't wipe them.
  const current = currentAddress?.trim();
  if (current && !options.some((option) => option.value === current)) {
    options.unshift({ value: current, label: current });
  }

  return options;
};

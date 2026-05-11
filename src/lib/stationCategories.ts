export const STATION_CATEGORY_OPTIONS = [
  { value: "car_wash", label: "\u063a\u0633\u0644 \u0633\u064a\u0627\u0631\u0627\u062a", alwaysVisible: true },
  { value: "delivery_wash", label: "\u063a\u0633\u0644 \u062f\u0644\u0641\u0631\u064a", settingKey: "STATION_CATEGORY_DELIVERY_WASH_ENABLED" },
  { value: "car_care_center", label: "\u0645\u0631\u0643\u0632 \u0639\u0646\u0627\u064a\u0629 \u0633\u064a\u0627\u0631\u0627\u062a", settingKey: "STATION_CATEGORY_CAR_CARE_ENABLED" },
  { value: "maintenance_center", label: "\u0645\u0631\u0643\u0632 \u0635\u064a\u0627\u0646\u0629", settingKey: "STATION_CATEGORY_MAINTENANCE_ENABLED" },
] as const;

export type StationCategory = (typeof STATION_CATEGORY_OPTIONS)[number]["value"];

export const DEFAULT_STATION_CATEGORY: StationCategory = "car_wash";

export const STATION_CATEGORY_SETTING_KEYS = STATION_CATEGORY_OPTIONS
  .map((option) => option.settingKey)
  .filter((key): key is string => Boolean(key));

export function getStationCategoryLabel(value?: string | null) {
  return STATION_CATEGORY_OPTIONS.find((option) => option.value === value)?.label || "\u063a\u0633\u0644 \u0633\u064a\u0627\u0631\u0627\u062a";
}

export function getVisibleStationCategories(settings: Record<string, string>) {
  return STATION_CATEGORY_OPTIONS.filter((option) => option.alwaysVisible || settings[option.settingKey || ""] === "true");
}

export function sanitizeStationCategory(value?: string | null): StationCategory {
  return STATION_CATEGORY_OPTIONS.some((option) => option.value === value)
    ? (value as StationCategory)
    : DEFAULT_STATION_CATEGORY;
}

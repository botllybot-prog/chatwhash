import { Globe2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APP_LANGUAGE_OPTIONS, useAppLanguage } from "@/lib/language";

const triggerLabels = {
  ar: "اللغة",
  en: "Language",
  ku: "زمان",
  tr: "Dil",
} as const;

export default function LanguageSwitcher() {
  const { language, setLanguage } = useAppLanguage();

  return (
    <div className="fixed left-4 top-4 z-[2100] w-44 sm:w-48">
      <Select value={language} onValueChange={(value) => setLanguage(value as typeof language)}>
        <SelectTrigger className="gap-2 bg-background/95 shadow-lg backdrop-blur">
          <Globe2 className="h-4 w-4" />
          <SelectValue placeholder={triggerLabels[language]} />
        </SelectTrigger>
        <SelectContent className="z-[2200]">
          {APP_LANGUAGE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

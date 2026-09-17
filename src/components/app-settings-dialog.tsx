"use client";

import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/theme-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { THEMES } from "@/lib/themes";

interface AppSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppSettingsDialog({ isOpen, onClose }: AppSettingsDialogProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  const handleLanguageChange = (code: string) => {
    void i18n.changeLanguage(code);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("rail.settings", "Settings")}</DialogTitle>
          <DialogDescription>
            {t(
              "settings.description",
              "Customize appearance and application preferences.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-3">
          {/* Theme setting */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <Label className="text-sm font-medium">
                {t("settings.appearance", "Theme")}
              </Label>
              <span className="text-xs text-muted-foreground">
                {t("settings.themeHint", "Choose application color scheme")}
              </span>
            </div>
            <Select value={theme} onValueChange={(val) => setTheme(val)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                {THEMES.map((th) => (
                  <SelectItem key={th.id} value={th.id}>
                    {th.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Language setting */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <Label className="text-sm font-medium">
                {t("settings.language", "Language")}
              </Label>
              <span className="text-xs text-muted-foreground">
                {t("settings.languageHint", "Select interface language")}
              </span>
            </div>
            <Select
              value={i18n.language?.split("-")[0] || "en"}
              onValueChange={handleLanguageChange}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.nativeName} ({lang.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

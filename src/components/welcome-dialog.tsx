"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuArrowRight,
  LuCamera,
  LuFolders,
  LuGlobe,
  LuLoaderCircle,
  LuMic,
  LuNetwork,
  LuShieldCheck,
  LuUsers,
} from "react-icons/lu";
import { Logo } from "@/components/icons/logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/use-permissions";

type WelcomeStep = "intro" | "permissions";

const panelSpring = {
  type: "spring",
  stiffness: 260,
  damping: 28,
} as const;

const panelVariants = {
  enter: { opacity: 0, y: 12 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

// Concrete feature list shown on the intro step, rendered as an icon grid.
const FEATURES = [
  { key: "welcome.features.items.setDefault", Icon: LuGlobe },
  { key: "welcome.features.items.proxy", Icon: LuNetwork },
  { key: "welcome.features.items.vpn", Icon: LuShieldCheck },
  { key: "welcome.features.items.profiles", Icon: LuUsers },
  { key: "welcome.features.items.groups", Icon: LuFolders },
] as const;

export function WelcomeDialog({
  isOpen,
  onComplete,
}: {
  isOpen: boolean;
  needsSetup?: boolean;
  onComplete: () => void;
}) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const {
    requestPermission,
    isMicrophoneAccessGranted,
    isCameraAccessGranted,
    isInitialized,
    requiresSystemPermissions,
  } = usePermissions(isOpen);
  const [step, setStep] = useState<WelcomeStep>("intro");
  const permissionsGranted = isMicrophoneAccessGranted && isCameraAccessGranted;
  const showPermissionsStep =
    requiresSystemPermissions &&
    (step === "permissions" || !isInitialized || !permissionsGranted);
  const visibleSteps: WelcomeStep[] = [
    "intro",
    ...(showPermissionsStep ? (["permissions"] as const) : []),
  ];
  const currentStepIndex = Math.max(0, visibleSteps.indexOf(step));
  const panelTransition = reduceMotion
    ? ({ duration: 0.15 } as const)
    : panelSpring;

  const [requesting, setRequesting] = useState(false);

  const requestPermissions = useCallback(async () => {
    setRequesting(true);
    try {
      if (!isMicrophoneAccessGranted) {
        await requestPermission("microphone");
      }
      if (!isCameraAccessGranted) {
        await requestPermission("camera");
      }
    } catch (err) {
      console.error("Permission request failed:", err);
    } finally {
      setRequesting(false);
      onComplete();
    }
  }, [isCameraAccessGranted, isMicrophoneAccessGranted, onComplete, requestPermission]);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        dismissible={false}
        className="overflow-x-hidden p-4 sm:max-w-xl sm:p-6"
      >
        <DialogTitle className="sr-only">{t("welcome.title")}</DialogTitle>

        <div
          role="progressbar"
          aria-label={t("welcome.title")}
          aria-valuemin={1}
          aria-valuemax={visibleSteps.length}
          aria-valuenow={currentStepIndex + 1}
          className="mx-auto h-1 w-24 overflow-hidden rounded-full bg-muted"
        >
          <motion.div
            className="h-full origin-left rounded-full bg-primary"
            initial={false}
            animate={{
              scaleX: (currentStepIndex + 1) / visibleSteps.length,
            }}
            transition={panelTransition}
          />
        </div>

        <AnimatePresence mode="wait">
          {step === "intro" && (
            <motion.div
              key="intro"
              variants={panelVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={panelTransition}
              className="flex flex-col gap-7"
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    ...panelTransition,
                    delay: reduceMotion ? 0 : 0.05,
                  }}
                  className="text-foreground"
                >
                  <Logo className="size-12" />
                </motion.div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-balance">
                    {t("welcome.title")}
                  </h2>
                  <p className="mx-auto max-w-[55ch] text-base/7 text-pretty text-muted-foreground sm:text-sm/6">
                    {t("welcome.tagline")}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-base/7 font-medium text-muted-foreground sm:text-sm/6">
                  {t("welcome.features.title")}
                </p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {FEATURES.map(({ key, Icon }, i) => (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        ...panelTransition,
                        delay: reduceMotion ? 0 : 0.12 + i * 0.04,
                      }}
                      className="flex min-w-0 items-center gap-2.5"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <dt className="text-base/7 font-medium text-foreground sm:text-sm/6">
                        {t(key)}
                      </dt>
                    </motion.div>
                  ))}
                </dl>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={onComplete}
                >
                  {t("welcome.skip")}
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    if (showPermissionsStep) setStep("permissions");
                    else onComplete();
                  }}
                >
                  {t("welcome.next")}
                  <LuArrowRight className="size-4 shrink-0" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === "permissions" && (
            <motion.div
              key="permissions"
              variants={panelVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={panelTransition}
              className="flex flex-col gap-7"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, rotate: -8 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={panelTransition}
                  className="flex size-12 items-center justify-center gap-1.5 rounded-full bg-primary/10 text-primary-text"
                  aria-hidden="true"
                >
                  <LuMic className="size-4 shrink-0" />
                  <LuCamera className="size-4 shrink-0" />
                </motion.div>
                <h2 className="text-2xl font-semibold tracking-tight text-balance">
                  {t("welcome.permissions.title")}
                </h2>
                <p className="mx-auto max-w-[55ch] text-base/7 text-pretty text-muted-foreground sm:text-sm/6">
                  {t("welcome.permissions.desc")}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  disabled={requesting}
                  onClick={onComplete}
                >
                  {t("welcome.permissions.skip")}
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={requesting}
                  onClick={() => {
                    void requestPermissions();
                  }}
                >
                  {requesting && (
                    <LuLoaderCircle className="size-4 shrink-0 animate-spin" />
                  )}
                  {requesting
                    ? t("welcome.permissions.requesting")
                    : t("welcome.permissions.grant")}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

"use client";
// Language switcher for next-intl with i18n routing. Keeps the current page and params.
// Expects src/i18n/navigation.ts to export usePathname and useRouter (createNavigation(routing)).
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Each language is shown in its own name, so people can find theirs.
const NAMES: Record<string, string> = { en: "English", ar: "العربية" };

export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const t = useTranslations("a11y");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    startTransition(() => {
      router.replace(pathname, { locale: next });
      // With next-intl's `pathnames` option, forward the route params instead:
      // router.replace({ pathname, params }, { locale: next });  (needs a ts-expect-error per the docs)
    });
  }

  return (
    <select
      aria-label={t("switchLanguage")}
      className={className}
      value={locale}
      disabled={pending}
      onChange={(e) => change(e.target.value)}
    >
      {routing.locales.map((l) => (
        <option key={l} value={l} lang={l}>
          {NAMES[l] ?? l}
        </option>
      ))}
    </select>
  );
}

# next-intl on the Next.js App Router

Checked against next-intl's "App Router with i18n routing" and configuration docs on 2026-10-24. Re-check before relying on file names for a newer Next.js.

## Install and wire up

```bash
npm install next-intl
```

`next.config.ts` (the plugin finds `src/i18n/request.ts` by default):

```ts
import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin();
export default withNextIntl({/* your config */});
```

A custom request file: `createNextIntlPlugin("./path/to/request.ts")`.

## Files

```
src/i18n/routing.ts      locales, default locale, URL strategy
src/i18n/request.ts      loads messages for the request's locale
src/i18n/navigation.ts   locale-aware Link, redirect, useRouter, usePathname
src/proxy.ts             locale negotiation and redirects (see below)
src/app/[locale]/layout.tsx
messages/en.json, messages/ar.json
```

`routing.ts` (values come from `i18n.config.json`):

```ts
import { defineRouting } from "next-intl/routing";
export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
  // localePrefix: "always" (default) | "as-needed" | "never"
});
```

`navigation.ts`:

```ts
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

`request.ts`:

```ts
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
```

TODO(verify): the docs now show an alternative that reads the locale from `next/root-params` (default from Next.js 16.3; earlier versions need `experimental.rootParams`). The `requestLocale` form above is the long-standing one. Follow whichever the installed next-intl version documents.

## The proxy/middleware file

Locale negotiation runs in a request-interception file. The docs say: "`proxy.ts` was called `middleware.ts` up until Next.js 16." Check the installed Next.js major version and use `src/proxy.ts` on 16+, `src/middleware.ts` before.

```ts
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
export default createMiddleware(routing);
export const config = { matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)" };
```

Paths containing a dot (for example `/users/jane.doe`) need an extra matcher entry.

## Root layout: lang and dir

Move layouts and pages under `app/[locale]/`. The root layout owns `<html>`:

```tsx
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

const RTL = new Set(["ar", "he", "fa", "ur"]);

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale} dir={RTL.has(locale) ? "rtl" : "ltr"}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

`NextIntlClientProvider` rendered from a Server Component inherits locale, messages, formats and time zone. Pass `messages={null}` to keep messages off the client, or a subset to ship fewer bytes.

## Static generation

Call `setRequestLocale(locale)` in every layout and page you want rendered statically, before any next-intl hook, and export `generateStaticParams` from the layout. Without `setRequestLocale`, pages opt into dynamic rendering.

## Using messages

Server and shared components: `useTranslations("cart")` (sync) or `await getTranslations({ locale, namespace: "cart" })` from `next-intl/server`. Client components: `useTranslations`. Use `Link` from `navigation.ts`, never `next/link`, so the prefix is kept.

## Detection, cookie, domains

- `localePrefix: "always"` (default) gives `/en/...` and `/ar/...`; `"as-needed"` drops the prefix for the default locale; `"never"` suits one domain per locale.
- `localeDetection: false` makes the URL the only source of truth (no `Accept-Language`, no cookie).
- A `NEXT_LOCALE` cookie remembers a user's choice; configure with `localeCookie` (name, `maxAge`) or set it `false`.
- `domains: [{ domain, defaultLocale, locales }]` for domain routing; falls back to prefixes on hosts such as `localhost`.

## hreflang

The middleware adds `alternateLinks` (a `Link` header) by default. If you set `alternateLinks: false`, or want them in the HTML, add them through `generateMetadata`:

```ts
export async function generateMetadata({ params }) {
  const { locale } = await params;
  const base = "https://example.com";
  return {
    alternates: {
      canonical: `${base}/${locale}`,
      languages: { en: `${base}/en`, ar: `${base}/ar`, "x-default": `${base}/en` },
    },
  };
}
```

## Pitfalls

- A second `<html>` (an old root `app/layout.tsx` left behind) breaks `dir`.
- Hardcoded `/ar/...` strings: use `Link` and `getPathname`.
- Metadata (title, description) must be translated too: `getTranslations` inside `generateMetadata`.

import type { ReactNode } from "react";

interface Props {
  /** A path on this site, or a full URL, of a self-contained page. */
  url: string;
  title: string;
  /** What the example project is. */
  caption?: ReactNode;
  steps?: Array<{ title: string; text: string }>;
}

/**
 * An interactive example shown in the page. The frame is sandboxed with scripts only: no same-origin
 * access, forms, popups or navigation, so the demo cannot touch the rest of the site.
 */
export function DemoEmbed({ url, title, caption, steps }: Props) {
  return (
    <section aria-labelledby="demo" className="space-y-5">
      <h2 id="demo" className="text-xl">
        See it on a real project
      </h2>
      {caption ? <p className="max-w-3xl text-sm text-muted">{caption}</p> : null}
      <p className="hud-label text-muted">
        This is the live page the skill wrote. Click a component, pick a flow and press Play, or
        open the Risks tab.
      </p>
      <div className="border border-line-strong bg-bg-raised">
        <iframe
          src={url}
          title={title}
          loading="lazy"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          className="block h-[640px] w-full border-0 sm:h-[760px]"
        />
      </div>
      <p className="text-sm">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="hud-label text-accent-ink underline underline-offset-4"
        >
          Open full screen
        </a>
      </p>
      {steps && steps.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-lg">How /arch-visualize mapped it</h3>
          <ol className="max-w-3xl space-y-3 text-sm">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4 border border-line bg-bg-raised p-4">
                <span className="hud-label text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <strong className="block">{s.title}</strong>
                  <span className="text-muted">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

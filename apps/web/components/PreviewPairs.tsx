import type { PreviewPair } from "../lib/links";
import { previewCaption, previewSrc } from "../lib/links";

/** English and Arabic screenshots of the same page, side by side. */
export function PreviewPairs({
  skill,
  pairs,
  className,
  imageClass,
}: {
  skill: string;
  pairs: PreviewPair[];
  className: string;
  imageClass: string;
}) {
  return (
    <ul className={className}>
      {pairs.map((p) => (
        <li key={p.base} className="border border-line-strong bg-bg-raised">
          <p className="hud-label border-b border-line px-3 py-2 text-muted">
            {previewCaption(`${p.base}.jpg`)}
          </p>
          <div className="grid grid-cols-2 gap-px bg-line-strong">
            {(
              [
                ["English", p.en, "en"],
                ["Arabic", p.ar, "ar"],
              ] as const
            ).map(([label, file, lang]) => (
              <figure key={file} className="bg-bg-raised">
                <img
                  src={previewSrc(skill, file)}
                  alt={`${previewCaption(`${p.base}.jpg`)}, ${label}`}
                  lang={lang}
                  loading="lazy"
                  className={`block w-full object-cover ${imageClass}`}
                />
                <figcaption className="hud-label px-3 py-2 text-muted">{label}</figcaption>
              </figure>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

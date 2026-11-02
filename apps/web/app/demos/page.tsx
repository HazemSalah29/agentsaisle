import type { Metadata } from "next";
import { qaLabel } from "../../lib/demos";
import { getDemos } from "../../lib/demos-data";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Demos",
  description:
    "Videos made by the Agent Aisle video skills on an ordinary laptop with no paid service, each with its sources and automatic quality check.",
};

const FILE_LABEL: Record<string, string> = {
  "README.md": "README",
  "video.json": "video.json",
  "script.md": "script",
  "facts.md": "facts",
  "credits.json": "credits",
  "captions.srt": "captions",
};

export default function DemosPage() {
  const { demos, coming } = getDemos();
  return (
    <>
      <div className="px-4 py-12 sm:px-8">
        <p className="hud-label text-accent-ink">Demos</p>
        <h1 className="mt-3 text-3xl">Videos the skills made</h1>
        <p className="mt-3 max-w-prose text-muted">
          Each video below was made by the library itself on an ordinary laptop: a synthetic voice,
          local rendering, no paid service. Next to each one are the files it was built from, so you
          can see it is real and re-run it. The automatic check looks at the file (size, loudness,
          margins, pacing); it does not judge whether a video is any good.
        </p>
      </div>
      <ul
        aria-label="Demo videos"
        className="grid border-t border-line-strong pl-px pt-px grid-cols-[minmax(0,1fr)] md:grid-cols-2 lg:grid-cols-3"
      >
        {demos.map((d) => (
          <li
            key={d.id}
            data-demo={d.id}
            className="-ml-px -mt-px flex min-w-0 flex-col gap-3 border border-line-strong bg-bg-raised p-6"
          >
            <p className="hud-label text-accent-ink">{d.type}</p>
            <h2 className="text-xl">{d.title}</h2>
            <video
              controls
              preload="none"
              playsInline
              poster={d.poster ? `/video-demos/${d.id}/${d.poster}` : undefined}
              className="mx-auto aspect-[9/16] max-h-[28rem] w-full bg-bg-sunken object-contain"
              aria-label={`${d.title}: ${d.summary}`}
            >
              <source src={`/video-demos/${d.id}/${d.video}`} type="video/mp4" />
            </video>
            <p className="text-sm text-muted">{d.summary}</p>
            {d.note ? <p className="text-sm">{d.note}</p> : null}
            <p className="hud-label text-ink">
              {qaLabel(d.qa)}
              {d.qa?.seconds ? ` · ${Math.round(d.qa.seconds)} s` : ""}
              {d.qa?.size ? ` · ${d.qa.size}` : ""}
            </p>
            {d.route ? (
              <p className="hud-label text-muted">
                Made with <span className="text-ink">{d.route}</span>
              </p>
            ) : null}
            {d.files.length ? (
              <p className="hud-label text-muted">
                Sources:{" "}
                {d.files.map((f, i) => (
                  <span key={f}>
                    {i ? " · " : ""}
                    <a
                      className="text-ink underline decoration-line-strong underline-offset-2 hover:text-accent-ink"
                      href={`/video-demos/${d.id}/${f}`}
                    >
                      {FILE_LABEL[f] ?? f}
                    </a>
                  </span>
                ))}
              </p>
            ) : null}
          </li>
        ))}
        {coming.map((c) => (
          <li
            key={c.id}
            data-coming={c.id}
            className="-ml-px -mt-px flex min-w-0 flex-col gap-3 border border-line-strong bg-bg-sunken p-6"
          >
            <p className="hud-label text-muted">Not shown here</p>
            <h2 className="text-xl">{c.title}</h2>
            <p className="text-sm text-muted">{c.why}</p>
          </li>
        ))}
      </ul>
      {demos.length === 0 ? (
        <p className="px-4 py-10 text-muted sm:px-8">
          The demo videos are not available in this build.
        </p>
      ) : null}
      <p className="border-t border-line-strong px-4 py-8 text-sm text-muted sm:px-8">
        Voices are computer-generated. Every video is labelled as such in its credits file.
      </p>
    </>
  );
}

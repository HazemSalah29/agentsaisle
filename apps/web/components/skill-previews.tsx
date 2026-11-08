import type { RegistrySkill } from "@agentsaisle/registry-schema";
import { DemoEmbed } from "./DemoEmbed";
import { PreviewPairs } from "./PreviewPairs";
import { pairPreviews, previewCaption, previewSrc } from "../lib/links";

/** The live demo or the screenshots of a skill, when it has them. */
export function SkillPreviews({ skill }: { skill: RegistrySkill }) {
  const shots = skill.demo?.screenshots ?? [];
  const phoneShots = shots.filter((f) => /phone/i.test(f));
  const desktopShots = shots.filter((f) => !/phone/i.test(f));
  // English/Arabic pairs ("01-home-en.jpg" and "01-home-ar.jpg") are shown side by side.
  const desktopPairs = pairPreviews(desktopShots);
  const phonePairs = pairPreviews(phoneShots);
  const paired = Boolean(desktopPairs) && (phoneShots.length === 0 || Boolean(phonePairs));

  return (
    <>
      {skill.demo?.embed && skill.demo.url && (
        <DemoEmbed
          url={skill.demo.url}
          title={`${skill.name} example: the page it generated for a real project`}
          caption={skill.demo.caption}
          steps={skill.demo.steps}
        />
      )}

      {skill.demo && !skill.demo.embed && skill.demo.screenshots.length > 0 && (
        <section aria-labelledby="preview" className="space-y-4">
          <h2 id="preview" className="text-xl">
            Preview
          </h2>
          <p className="text-sm text-muted">
            {skill.demo.caption
              ? skill.demo.caption
              : paired
                ? "The same demo site before and after this skill: English on the left, Arabic on the right. The Arabic text is a machine-written draft that no native speaker has reviewed yet. These screenshots show a result, not a measured number."
                : "Screenshots of a demo site built only from this skill's kit. They show the style, not a measured result."}
            {skill.demo.url && (
              <>
                {" "}
                <a
                  href={skill.demo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-ink underline underline-offset-4"
                >
                  Open the live demo
                </a>
                .
              </>
            )}
          </p>
          {paired && desktopPairs && (
            <PreviewPairs
              skill={skill.name}
              pairs={desktopPairs}
              className="grid gap-4"
              imageClass="aspect-[3/4] object-top"
            />
          )}
          {paired && phonePairs && phonePairs.length > 0 && (
            <PreviewPairs
              skill={skill.name}
              pairs={phonePairs}
              className="grid gap-4 sm:grid-cols-2"
              imageClass="aspect-[9/16] object-top"
            />
          )}
          {(paired
            ? []
            : [
                {
                  shots: desktopShots,
                  list: "grid gap-4 sm:grid-cols-2",
                  img: "aspect-[8/5] object-top",
                },
                {
                  shots: phoneShots,
                  list: "grid max-w-xl grid-cols-3 gap-4",
                  img: "aspect-[9/19] object-top",
                },
              ]
          ).map(({ shots, list, img }) =>
            shots.length === 0 ? null : (
              <ul key={list} className={list}>
                {shots.map((file) => (
                  <li key={file} className="border border-line-strong bg-bg-raised">
                    <img
                      src={previewSrc(skill.name, file)}
                      alt={previewCaption(file)}
                      loading="lazy"
                      className={`block w-full object-cover ${img}`}
                    />
                    <p className="hud-label px-3 py-2 text-muted">{previewCaption(file)}</p>
                  </li>
                ))}
              </ul>
            ),
          )}
        </section>
      )}
    </>
  );
}

/** True when SkillPreviews would show something. */
export const hasPreviews = (skill: RegistrySkill) =>
  Boolean(skill.demo && (skill.demo.embed ? skill.demo.url : skill.demo.screenshots.length > 0));

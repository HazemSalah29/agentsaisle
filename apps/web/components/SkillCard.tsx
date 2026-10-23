import type { RegistrySkill } from "@agentsaisle/registry-schema";
import { Badge } from "./Badge";

const clientNames: Record<string, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
};

/** A shelf label: name, contents line, price sticker, and a nutrition-style panel of details. */
export function SkillCard({ skill, href }: { skill: RegistrySkill; href?: string }) {
  const rows: Array<[string, string]> = [
    ["Author", skill.author],
    ["Works with", skill.clients.map((c) => clientNames[c] ?? c).join(", ")],
    ["Aisle", skill.category.join(", ")],
    ["Source", skill.source === "official" ? "Agent Aisle" : skill.repo],
  ];
  return (
    <article className="relative flex h-full flex-col rounded-label border-[1.5px] border-label-rule bg-label p-5 text-label-ink shadow-label">
      <span className="absolute -top-3 right-4 rotate-3 rounded-sticker border-[1.5px] border-label-rule bg-sticker px-3 py-0.5 font-display text-md font-extrabold text-on-sticker">
        {skill.latest}
      </span>
      <h3 className="pr-16 text-xl font-black">
        {href ? (
          <a href={href} className="after:absolute after:inset-0 hover:underline">
            {skill.name}
          </a>
        ) : (
          skill.name
        )}
      </h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge
          kind={
            skill.source === "official" ? "official" : skill.verified ? "verified" : "unverified"
          }
        />
        {skill.source === "official" && skill.verified ? <Badge kind="verified" /> : null}
        {skill.runsScripts ? <Badge kind="scripts" /> : null}
      </div>
      <p className="mt-3 line-clamp-3 text-sm">{skill.description}</p>
      <dl className="mt-auto border-t-[6px] border-label-rule pt-0.5 text-xs">
        <div className="border-b border-label-rule py-1 font-bold">Details</div>
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-label-rule/40 py-1">
            <dt className="font-bold">{k}</dt>
            <dd className="text-right text-label-ink-soft">{v}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

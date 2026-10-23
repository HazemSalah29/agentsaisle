import type { RegistrySkill } from "@agentsaisle/registry-schema";
import { PLATE_COLS, PLATE_ROWS, aisleColor, plateCells } from "../lib/plate";
import { Badge } from "./Badge";

const clientNames: Record<string, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
};

/** Generated preview: a mirrored dot grid tinted with the skill's aisle color. */
function Plate({ skill }: { skill: RegistrySkill }) {
  const color = aisleColor(skill.category);
  const cells = plateCells(skill.name);
  const size = 10;
  return (
    <svg
      viewBox={`0 0 ${PLATE_COLS * size * 2} ${PLATE_ROWS * size * 2}`}
      className="block aspect-[16/8] w-full bg-bg-sunken"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {cells.flatMap((row, y) =>
        row.map((v, x) =>
          v === 0 ? null : (
            <rect
              key={`${x}-${y}`}
              x={x * size * 2 + 4}
              y={y * size * 2 + 4}
              width={size * 2 - 8}
              height={size * 2 - 8}
              fill={color}
              opacity={0.18 + v * 0.27}
            />
          ),
        ),
      )}
    </svg>
  );
}

/** A lineup card: generated plate, glyph, name, description, trust badges, client tags, link. */
export function SkillCard({
  skill,
  index,
  href,
}: {
  skill: RegistrySkill;
  index?: number;
  href?: string;
}) {
  const color = aisleColor(skill.category);
  return (
    <article className="group relative flex h-full flex-col bg-bg-raised">
      <div className="relative border-b border-line">
        <Plate skill={skill} />
        {index !== undefined && (
          <span className="hud-label absolute left-3 top-3 bg-bg-raised px-1.5 py-0.5 text-muted">
            {String(index).padStart(2, "0")}
          </span>
        )}
        <span className="hud-label absolute right-3 top-3 bg-bg-raised px-1.5 py-0.5 text-ink">
          v{skill.latest}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center border border-line-strong font-mono text-base font-medium"
            style={{ color }}
          >
            {skill.name[0]}
          </span>
          <h3 className="text-lg">
            {href ? (
              <a href={href} className="after:absolute after:inset-0">
                {skill.name}
              </a>
            ) : (
              skill.name
            )}
          </h3>
        </div>
        <p className="line-clamp-3 text-sm text-muted">{skill.description}</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            kind={
              skill.source === "official" ? "official" : skill.verified ? "verified" : "unverified"
            }
          />
          {skill.runsScripts ? <Badge kind="scripts" /> : null}
        </div>
        <ul className="mt-auto flex flex-wrap gap-1.5" aria-label="Works with">
          {skill.clients.map((c) => (
            <li key={c} className="hud-label border border-line px-2 py-1 text-muted">
              {clientNames[c] ?? c}
            </li>
          ))}
        </ul>
        <p className="hud-label flex items-center justify-between border-t border-line pt-3 text-ink group-hover:text-accent-ink">
          <span>View skill</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        </p>
      </div>
    </article>
  );
}

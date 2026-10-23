import { ImageResponse } from "next/og";
import { installCommand } from "../../../lib/install-command";
import { getRegistry, getSkill } from "../../../lib/registry";

export const alt = "Agent Aisle skill";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return getRegistry().skills.map((s) => ({ name: s.name }));
}

export default async function Image({ params }: { params: Promise<{ name: string }> }) {
  const skill = getSkill((await params).name);
  const name = skill?.name ?? "Agent Aisle";
  const description = skill?.description ?? "A store for Agent Skills.";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#14130f",
        color: "#f2f1ee",
        padding: 64,
        border: "2px solid #34332d",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, color: "#a3a199" }}
      >
        <div style={{ width: 28, height: 28, background: "#ff5a1f" }} />
        Agent Aisle
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>
          {name}
        </div>
        <div
          style={{
            fontSize: 34,
            color: "#a3a199",
            lineHeight: 1.3,
            maxHeight: 130,
            overflow: "hidden",
          }}
        >
          {description.length > 150 ? `${description.slice(0, 147)}...` : description}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          background: "#080806",
          border: "1px solid #6a6860",
          padding: "20px 28px",
          fontSize: 30,
          fontFamily: "monospace",
        }}
      >
        <span style={{ color: "#ff8a5c", marginRight: 16 }}>$</span>
        {installCommand(name)}
      </div>
    </div>,
    size,
  );
}

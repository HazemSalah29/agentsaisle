import type { RegistrySkill } from "@agentsaisle/registry-schema";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { resolveHref } from "../lib/links";

/**
 * Renders community-written SKILL.md safely: raw HTML is never rendered (react-markdown ignores
 * it by default) and the tree is sanitized as well. Images are not loaded; their alt text shows.
 */
export function SkillMarkdown({
  source,
  skill,
  sha,
}: {
  source: string;
  skill: Pick<RegistrySkill, "repo" | "path">;
  sha: string;
}) {
  return (
    <div className="skill-prose">
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        components={{
          // The page's own h1 is the skill name, so content headings start at h2.
          h1: ({ children }) => <h2>{children}</h2>,
          h2: ({ children }) => <h3>{children}</h3>,
          h3: ({ children }) => <h4>{children}</h4>,
          h4: ({ children }) => <h5>{children}</h5>,
          a: ({ href, children }) => {
            const safe = resolveHref(href, skill, sha);
            return safe ? (
              <a href={safe} rel="noopener noreferrer nofollow">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            );
          },
          img: ({ alt }) => (
            <span className="text-muted">{alt ? `[image: ${alt}]` : "[image]"}</span>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

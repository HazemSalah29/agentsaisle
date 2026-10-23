import { Grid } from "./Grid";

export interface Post {
  title: string;
  excerpt: string;
  /** Display text such as "12 March 2026". */
  date: string;
  category: string;
  href: string;
  image: { src: string; alt: string; width: number; height: number };
}

export interface BlogGridProps {
  posts: readonly Post[];
  cols?: 2 | 3;
}

/** Article cards. The image zooms slowly on hover; it stays still for reduced motion. */
export function BlogGrid({ posts, cols = 3 }: BlogGridProps) {
  return (
    <Grid cols={cols} className="gap-x-8 gap-y-12">
      {posts.map((post) => (
        <article key={post.href} className="group">
          <a href={post.href} className="block">
            <div className="overflow-hidden bg-raised">
              <div
                data-kit-motion
                className="transition-transform duration-(--duration-slow) ease-out-expo group-hover:scale-105"
              >
                <img
                  src={post.image.src}
                  alt={post.image.alt}
                  width={post.image.width}
                  height={post.image.height}
                  loading="lazy"
                  className="block h-auto w-full"
                />
              </div>
            </div>
            <p className="mt-4 text-sm text-muted">
              {post.category} / {post.date}
            </p>
            <h3 className="mt-2 font-display text-lead text-ink uppercase transition-colors group-hover:text-accent">
              {post.title}
            </h3>
            <p className="mt-2 max-w-[44ch] text-muted">{post.excerpt}</p>
          </a>
        </article>
      ))}
    </Grid>
  );
}

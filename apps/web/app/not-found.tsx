export default function NotFound() {
  return (
    <div className="px-4 py-20 sm:px-8">
      <p className="hud-label text-accent-ink">Error 404</p>
      <h1 className="mt-3 text-3xl">This shelf is empty</h1>
      <p className="mt-4 text-md text-muted">
        That page or skill doesn&apos;t exist. It may have been renamed or removed.
      </p>
      <a
        href="/skills"
        className="hud-label mt-6 inline-flex h-11 items-center bg-invert-bg px-6 font-bold text-invert-fg hover:opacity-80"
      >
        Browse skills
      </a>
    </div>
  );
}

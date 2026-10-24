export interface ContactCTAProps {
  /** The giant link text. */
  label: string;
  href: string;
  /** A line under the link, such as an email address or reply time. */
  note?: string;
}

/** One enormous link with an underline that sweeps in on hover and focus. */
export function ContactCTA({ label, href, note }: ContactCTAProps) {
  return (
    <div>
      <a
        href={href}
        data-cursor
        className="group relative inline-block font-display text-display text-ink uppercase"
      >
        {label}
        <span
          data-kit-motion
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-accent transition-transform duration-(--duration-slow) ease-out-expo group-hover:scale-x-100 group-focus-visible:scale-x-100"
        />
      </a>
      {note ? <p className="text-lead mt-6 text-muted">{note}</p> : null}
    </div>
  );
}

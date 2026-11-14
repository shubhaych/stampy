/** Source label for a figure. href stays null until verified (hard rule 7): never guess a URL. */
export function SourceChip({ label, href }: { label: string; href: string | null }) {
  if (href) {
    return (
      <a className="source-chip" href={href} target="_blank" rel="noreferrer">
        {label} ↗
      </a>
    );
  }
  return (
    <span className="source-chip" data-unlinked title="Source link not yet verified">
      {label}
    </span>
  );
}

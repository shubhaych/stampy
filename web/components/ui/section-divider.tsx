/** A12 Section Pulse: amber-to-blue band with a sweep every 4.5 s. */
export function SectionDivider() {
  return (
    <div className="section-divider" aria-hidden>
      <div className="section-divider__track">
        <div className="section-divider__pulse" />
      </div>
    </div>
  );
}

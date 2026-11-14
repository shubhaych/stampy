/** "Day 3 of 30". Amber at 80% of the window, conflict color when breached. */
export function ClockChip({ day, of, label = 'Day' }: { day: number; of: number; label?: string }) {
  const tone = day > of ? 'clock-chip--breach' : day >= of * 0.8 ? 'clock-chip--warn' : '';
  return (
    <span className={`clock-chip ${tone}`}>
      {label} {day} of {of}
    </span>
  );
}

export function ExpeditedChip({ daysLeft }: { daysLeft: number | null }) {
  if (daysLeft === null) return <span className="clock-chip">Expedited: screened</span>;
  const tone = daysLeft < 0 ? 'clock-chip--breach' : daysLeft <= 1 ? 'clock-chip--warn' : '';
  return <span className={`clock-chip ${tone}`}>Expedited: {daysLeft} d left</span>;
}

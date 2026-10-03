const LABELS = ['Overview', 'Key accomplishments', 'Blockers and risks', 'Time', 'Suggested follow-ups for the manager'];

// Splits the plain-text summary into labelled sections. Rendered as text only (no HTML).
function parse(text) {
  const sections = [];
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const label = LABELS.find((l) => line.toLowerCase().startsWith(`${l.toLowerCase()}:`));
    if (label) {
      current = { title: label, lines: [] };
      sections.push(current);
      const rest = line.slice(label.length + 1).trim();
      if (rest) current.lines.push(rest);
    } else if (line) {
      if (!current) {
        current = { title: null, lines: [] };
        sections.push(current);
      }
      current.lines.push(line);
    }
  }
  return sections;
}

export default function SummaryText({ text }) {
  return (
    <div className="summary-sections">
      {parse(text).map((section, i) => {
        const bullets = section.lines.filter((l) => l.startsWith('- '));
        const prose = section.lines.filter((l) => !l.startsWith('- '));
        return (
          <section key={i} className="summary-section">
            {section.title && <h4>{section.title}</h4>}
            {prose.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
            {bullets.length > 0 && (
              <ul>
                {bullets.map((b, j) => (
                  <li key={j}>{b.slice(2)}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

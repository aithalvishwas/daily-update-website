import { hueFor, initials } from '../format.js';

export default function Avatar({ name, size = 40 }) {
  const hue = hueFor(name);
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${hue} 80% 62%), hsl(${(hue + 50) % 360} 80% 52%))`,
      }}
    >
      {initials(name)}
    </span>
  );
}

// The mark: a lens (the gradient ring) reading a pulse line. favicon.svg is the same drawing.
export function LogoMark({ size = 32 }) {
  return <img src="/favicon.svg" alt="" width={size} height={size} />;
}

export default function Logo({ size = 32 }) {
  return (
    <div className="logo">
      <LogoMark size={size} />
      <span className="logo-word">
        WorkPulse<b>Lens</b>
      </span>
    </div>
  );
}

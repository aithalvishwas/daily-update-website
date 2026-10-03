import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float, Lightformer, MeshDistortMaterial, Sparkles, useGLTF } from '@react-three/drei';

// A Blender export dropped at public/models/hero.glb replaces the built-in blob.
const HERO_MODEL_URL = '/models/hero.glb';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function useModelAvailable(url) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(url, { method: 'HEAD' })
      .then((r) => alive && setAvailable(r.ok && !(r.headers.get('content-type') || '').includes('text/html')))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [url]);
  return available;
}

function BlenderModel() {
  const { scene } = useGLTF(HERO_MODEL_URL, false);
  return <primitive object={scene} scale={1.6} />;
}

function Blob() {
  return (
    <mesh scale={1.55}>
      <icosahedronGeometry args={[1, 64]} />
      <MeshDistortMaterial color="#7c5cff" emissive="#2a1470" roughness={0.08} metalness={0.25} distort={0.38} speed={1.6} />
    </mesh>
  );
}

// Small shapes orbiting the centre, like tasks circling a day.
function Orbiters({ count = 7 }) {
  const group = useRef();
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        angle: (i / count) * Math.PI * 2,
        radius: 2.5 + (i % 3) * 0.35,
        y: ((i % 4) - 1.5) * 0.55,
        size: 0.14 + (i % 3) * 0.06,
        color: ['#22d3ee', '#a78bfa', '#f472b6', '#facc15'][i % 4],
      })),
    [count],
  );
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.25;
  });
  return (
    <group ref={group}>
      {items.map((it, i) => (
        <Float key={i} speed={2} rotationIntensity={2} floatIntensity={1.2}>
          <mesh position={[Math.cos(it.angle) * it.radius, it.y, Math.sin(it.angle) * it.radius]}>
            {i % 2 ? <octahedronGeometry args={[it.size, 0]} /> : <boxGeometry args={[it.size, it.size, it.size]} />}
            <meshStandardMaterial color={it.color} emissive={it.color} emissiveIntensity={0.35} roughness={0.25} metalness={0.4} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

function Ring() {
  const ref = useRef();
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.x += delta * 0.12;
      ref.current.rotation.z += delta * 0.08;
    }
  });
  return (
    <mesh ref={ref} rotation={[1.1, 0, 0]}>
      <torusGeometry args={[2.15, 0.035, 16, 160]} />
      <meshStandardMaterial color="#c4b5fd" emissive="#7c5cff" emissiveIntensity={0.8} metalness={0.6} roughness={0.2} />
    </mesh>
  );
}

// Tilts the whole scene a little towards the pointer.
function Parallax({ children }) {
  const ref = useRef();
  useFrame(({ pointer }) => {
    if (!ref.current) return;
    ref.current.rotation.y += (pointer.x * 0.35 - ref.current.rotation.y) * 0.05;
    ref.current.rotation.x += (-pointer.y * 0.2 - ref.current.rotation.x) * 0.05;
  });
  return <group ref={ref}>{children}</group>;
}

export default function Scene3D() {
  const reduced = usePrefersReducedMotion();
  const hasModel = useModelAvailable(HERO_MODEL_URL);

  return (
    <Canvas
      className="scene-canvas"
      dpr={[1, 2]}
      camera={{ position: [0, 0, 8.5], fov: 42 }}
      frameloop={reduced ? 'demand' : 'always'}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 5, 3]} intensity={1.4} />
      <pointLight position={[-4, -2, 2]} intensity={30} color="#22d3ee" />
      <Suspense fallback={null}>
        <Parallax>
          <group position={[0.4, 1.1, 0]} scale={0.85}>
            <Float speed={reduced ? 0 : 1.4} rotationIntensity={0.6} floatIntensity={0.9}>
              {hasModel ? <BlenderModel /> : <Blob />}
            </Float>
            <Ring />
            <Orbiters />
          </group>
          <Sparkles count={60} scale={[9, 6, 4]} size={2.2} speed={reduced ? 0 : 0.35} color="#c4b5fd" />
        </Parallax>
        {/* Studio lighting built in code, so nothing is downloaded at runtime. */}
        <Environment resolution={256}>
          <Lightformer intensity={2} position={[0, 4, -6]} scale={[10, 2, 1]} color="#a78bfa" />
          <Lightformer intensity={1.5} position={[-5, 0, -2]} scale={[2, 6, 1]} color="#22d3ee" />
          <Lightformer intensity={1} position={[5, -1, 0]} scale={[2, 4, 1]} color="#f472b6" />
        </Environment>
      </Suspense>
    </Canvas>
  );
}

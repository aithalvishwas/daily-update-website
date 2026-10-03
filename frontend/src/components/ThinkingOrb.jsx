import { Canvas } from '@react-three/fiber';
import { Float, MeshDistortMaterial } from '@react-three/drei';

/** A small animated 3D orb shown while the AI writes a summary. */
export default function ThinkingOrb({ size = 120 }) {
  return (
    <div className="thinking-orb" style={{ width: size, height: size }}>
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 3.2], fov: 45 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 3, 2]} intensity={1.6} />
        <pointLight position={[-2, -1, 1]} intensity={12} color="#22d3ee" />
        <Float speed={4} rotationIntensity={1.5} floatIntensity={0.6}>
          <mesh>
            <icosahedronGeometry args={[1, 48]} />
            <MeshDistortMaterial color="#8b5cf6" emissive="#3b1d8f" roughness={0.1} metalness={0.3} distort={0.5} speed={5} />
          </mesh>
        </Float>
      </Canvas>
    </div>
  );
}

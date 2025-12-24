'use client';

import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ParticleBackgroundProps {
  isDarkMode: boolean;
  primaryColor?: string;
}

/**
 * Convert hex color to RGB values (0-1 range)
 */
const hexToRgb = (hex: string): { b: number; g: number; r: number } => {
  const result = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  return result
    ? {
        b: Number.parseInt(result[3], 16) / 255,
        g: Number.parseInt(result[2], 16) / 255,
        r: Number.parseInt(result[1], 16) / 255,
      }
    : { b: 1, g: 0.4, r: 0.2 }; // fallback to blue
};

const ParticleBackground = memo<ParticleBackgroundProps>(({ isDarkMode, primaryColor }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Update scene based on Dark Mode
  useEffect(() => {
    if (sceneRef.current && rendererRef.current && materialRef.current) {
      const bgHex = isDarkMode ? 0x00_00_00 : 0xF9_FA_FB;
      sceneRef.current.fog = new THREE.FogExp2(bgHex, 0.002);
      materialRef.current.blending = isDarkMode ? THREE.AdditiveBlending : THREE.NormalBlending;
      materialRef.current.opacity = isDarkMode ? 0.9 : 0.6;
      materialRef.current.needsUpdate = true;
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (!mountRef.current) return;

    // Setup
    const scene = new THREE.Scene();
    const bgHex = isDarkMode ? 0x00_00_00 : 0xF9_FA_FB;
    scene.fog = new THREE.FogExp2(bgHex, 0.002);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.z = 80;
    camera.position.y = 20;
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x00_00_00, 0);
    rendererRef.current = renderer;

    renderer.domElement.style.display = 'block';

    while (mountRef.current.firstChild) {
      mountRef.current.firstChild.remove();
    }
    mountRef.current.append(renderer.domElement);

    // Particles & Geometry
    const particleCount = 30_000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const initialColorParams = new Float32Array(particleCount * 3);

    // Store different shapes
    const shapes: Float32Array[] = [];
    const SHAPE_COUNT = 8;

    // 1. Random Sphere (Initial)
    const shape0 = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 40 + Math.random() * 5;
      shape0[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      shape0[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      shape0[i * 3 + 2] = r * Math.cos(phi);

      positions[i * 3] = shape0[i * 3];
      positions[i * 3 + 1] = shape0[i * 3 + 1];
      positions[i * 3 + 2] = shape0[i * 3 + 2];

      initialColorParams[i * 3] = shape0[i * 3] / r + 0.5;
      initialColorParams[i * 3 + 1] = shape0[i * 3 + 1] / r + 0.5;
      initialColorParams[i * 3 + 2] = shape0[i * 3 + 2] / r + 0.5;

      // Use theme primary color
      const themeColor = primaryColor ? hexToRgb(primaryColor) : { b: 0.9, g: 0.5, r: 0.1 };
      colors[i * 3] = themeColor.r;
      colors[i * 3 + 1] = themeColor.g;
      colors[i * 3 + 2] = themeColor.b;
    }
    shapes.push(shape0);

    // 2. Butterfly Curve
    const shape1 = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const t = (i / particleCount) * 100 * Math.PI;
      const expr = Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) - Math.pow(Math.sin(t / 12), 5);
      const x = Math.sin(t) * expr;
      const y = Math.cos(t) * expr;
      const z = Math.sin(t / 5) * 10;
      const scale = 15;
      shape1[i * 3] = x * scale;
      shape1[i * 3 + 1] = y * scale;
      shape1[i * 3 + 2] = z * scale * 0.3;
    }
    shapes.push(shape1);

    // 3. Helix / Spring
    const shape2 = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const t = (i / particleCount) * 50 * Math.PI;
      const r = 0.5 * t;
      const x = r * Math.cos(t);
      const z = r * Math.sin(t);
      const y = (i / particleCount) * 80 - 40;
      shape2[i * 3] = x * 0.5;
      shape2[i * 3 + 1] = y;
      shape2[i * 3 + 2] = z * 0.5;
    }
    shapes.push(shape2);

    // 4. Rose Curve
    const shape3 = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const k = 4;
      const t = (i / particleCount) * 20 * Math.PI;
      const r = 30 * Math.cos(k * t);
      const x = r * Math.cos(t);
      const y = r * Math.sin(t);
      const z = 15 * Math.sin(t * 3);
      shape3[i * 3] = x;
      shape3[i * 3 + 1] = y;
      shape3[i * 3 + 2] = z;
    }
    shapes.push(shape3);

    // 5. Lemniscate
    const shape4 = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const t = (i / particleCount) * 2 * Math.PI;
      const scale = 40;
      const denom = 1 + Math.sin(t) * Math.sin(t);
      const x = (scale * Math.cos(t)) / denom;
      const y = (scale * Math.sin(t) * Math.cos(t)) / denom;
      const z = (Math.random() - 0.5) * 10;
      shape4[i * 3] = x;
      shape4[i * 3 + 1] = y;
      shape4[i * 3 + 2] = z;
    }
    shapes.push(shape4);

    // 6. Saddle
    const shape5 = new Float32Array(particleCount * 3);
    const side = Math.sqrt(particleCount);
    for (let i = 0; i < particleCount; i++) {
      const row = Math.floor(i / side);
      const col = i % side;
      const u = (row / side - 0.5) * 60;
      const v = (col / side - 0.5) * 60;
      const x = u;
      const z = v;
      const y = (u * u - v * v) / 30;
      shape5[i * 3] = x;
      shape5[i * 3 + 1] = y;
      shape5[i * 3 + 2] = z;
    }
    shapes.push(shape5);

    // 7. Maxwell EM Wave
    const shape6 = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const x = (i / particleCount) * 140 - 70;
      const freq = 0.12;
      const amp = 15;

      if (i % 2 === 0) {
        const y = amp * Math.sin(x * freq);
        const z = (Math.random() - 0.5) * 2;
        shape6[i * 3] = x;
        shape6[i * 3 + 1] = y;
        shape6[i * 3 + 2] = z;
      } else {
        const z = amp * Math.sin(x * freq);
        const y = (Math.random() - 0.5) * 2;
        shape6[i * 3] = x;
        shape6[i * 3 + 1] = y;
        shape6[i * 3 + 2] = z;
      }
    }
    shapes.push(shape6);

    // 8. Archimedean Spiral (Planar Galaxy)
    const shape7 = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const arm = i % 3;
      const pointsPerArm = particleCount / 3;
      const t = (Math.floor(i / 3) / pointsPerArm) * 12 * Math.PI;

      const r = 2 + 0.8 * t;
      const angle = t + arm * ((2 * Math.PI) / 3);

      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle);
      const y = (Math.random() - 0.5) * (r * 0.2);

      shape7[i * 3] = x;
      shape7[i * 3 + 1] = y;
      shape7[i * 3 + 2] = z;
    }
    shapes.push(shape7);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const getTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext('2d');
      if (context) {
        const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 32, 32);
      }
      const texture = new THREE.Texture(canvas);
      texture.needsUpdate = true;
      return texture;
    };

    const material = new THREE.PointsMaterial({
      blending: isDarkMode ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
      map: getTexture(),
      opacity: isDarkMode ? 0.9 : 0.6,
      size: 1,
      transparent: true,
      vertexColors: true,
    });
    materialRef.current = material;

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Animation Logic
    let currentShapeIndex = 0;
    let nextShapeIndex = 1;
    let transitionProgress = 0;
    const transitionDuration = 400;
    const stayDuration = 250;
    let timer = 0;

    // Color - Use theme primary color
    const targetColor = primaryColor ? hexToRgb(primaryColor) : { b: 1, g: 0.4, r: 0.2 };
    let currentR = targetColor.r,
      currentG = targetColor.g,
      currentB = targetColor.b;

    let animationId: number;

    const ease = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Rotate
      particles.rotation.y += 0.001;
      particles.rotation.z += 0.0005;

      // Color Transition
      currentR += (targetColor.r - currentR) * 0.02;
      currentG += (targetColor.g - currentG) * 0.02;
      currentB += (targetColor.b - currentB) * 0.02;

      const posAttr = particles.geometry.attributes.position;
      const colAttr = particles.geometry.attributes.color;
      const currentPositions = posAttr.array as Float32Array;
      const currentColors = colAttr.array as Float32Array;

      // Shape Morphing
      if (timer > stayDuration) {
        transitionProgress += 1 / transitionDuration;
        if (transitionProgress >= 1) {
          transitionProgress = 0;
          timer = 0;
          currentShapeIndex = nextShapeIndex;
          nextShapeIndex = (nextShapeIndex + 1) % SHAPE_COUNT;
        }
      } else {
        timer++;
      }

      const sourceShape = shapes[currentShapeIndex];
      const targetShape = shapes[nextShapeIndex];

      const alpha = ease(transitionProgress);

      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3;

        if (transitionProgress > 0) {
          currentPositions[idx] = sourceShape[idx] + (targetShape[idx] - sourceShape[idx]) * alpha;
          currentPositions[idx + 1] =
            sourceShape[idx + 1] + (targetShape[idx + 1] - sourceShape[idx + 1]) * alpha;
          currentPositions[idx + 2] =
            sourceShape[idx + 2] + (targetShape[idx + 2] - sourceShape[idx + 2]) * alpha;
        }

        const variation = initialColorParams[idx];

        if (isDarkMode) {
          currentColors[idx] = currentR * (0.2 + variation * 0.8);
          currentColors[idx + 1] = currentG * (0.2 + variation * 0.8);
          currentColors[idx + 2] = currentB * (0.2 + variation * 0.8);
        } else {
          currentColors[idx] = currentR * 0.8;
          currentColors[idx + 1] = currentG * 0.8;
          currentColors[idx + 2] = currentB * 0.8;
        }
      }

      if (transitionProgress > 0) posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (mountRef.current) {
        while (mountRef.current.firstChild) {
          mountRef.current.firstChild.remove();
        }
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [isDarkMode, primaryColor]);

  return (
    <div
      ref={mountRef}
      style={{
        height: '100%',
        left: 0,
        pointerEvents: 'none',
        position: 'absolute',
        top: 0,
        width: '100%',
        zIndex: 0,
      }}
    />
  );
});

ParticleBackground.displayName = 'ParticleBackground';

export default ParticleBackground;

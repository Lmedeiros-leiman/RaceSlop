import * as THREE from 'three';

export interface CharacterDef {
  id: string;
  name: string;
  body: number;
  accent: number;
  silhouette: { width: number; height: number; length: number };
}

// SPEC-M2 §6. Names/palettes are placeholders — data only, rename freely.
export const CHARACTERS: CharacterDef[] = [
  { id: 'rex', name: 'Rex', body: 0xff3355, accent: 0xffcc33, silhouette: { width: 1, height: 1, length: 1 } },
  { id: 'bruno', name: 'Bruno', body: 0x557744, accent: 0xdddd33, silhouette: { width: 1.15, height: 1.1, length: 1.1 } },
  { id: 'mika', name: 'Mika', body: 0x33ccee, accent: 0xffffff, silhouette: { width: 0.9, height: 0.95, length: 0.9 } },
  { id: 'nyx', name: 'Nyx', body: 0xaa33ee, accent: 0x22ffaa, silhouette: { width: 1, height: 1.25, length: 0.95 } },
];

// Shared GPU resources (Vision §11): one geometry per shape, one material
// per color, one Group per character — created once, reused every race.
const BODY_GEO = new THREE.BoxGeometry(1, 0.5, 2);
const NOSE_GEO = new THREE.BoxGeometry(0.6, 0.2, 0.4);
const WHEEL_GEO = new THREE.CylinderGeometry(0.22, 0.22, 0.25, 12);
const WHEEL_MAT = new THREE.MeshStandardMaterial({ color: 0x181818, flatShading: true });
const colorMatCache = new Map<number, THREE.MeshStandardMaterial>();

function colorMat(color: number): THREE.MeshStandardMaterial {
  let mat = colorMatCache.get(color);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, flatShading: true });
    colorMatCache.set(color, mat);
  }
  return mat;
}

const kartCache = new Map<string, THREE.Group>();

// M1 placeholder kart (SPEC-M1 §9) parameterized by the character def:
// body in def.body, nose in def.accent, silhouette via mesh.scale.
export function buildKartMesh(def: CharacterDef): THREE.Group {
  const cached = kartCache.get(def.id);
  if (cached) return cached;

  const { width: w, height: h, length: l } = def.silhouette;
  const kartMesh = new THREE.Group();

  const body = new THREE.Mesh(BODY_GEO, colorMat(def.body));
  body.name = 'body';
  body.scale.set(w, h, l);
  body.position.y = 0.45 * h;
  kartMesh.add(body);

  const nose = new THREE.Mesh(NOSE_GEO, colorMat(def.accent));
  nose.name = 'nose';
  nose.scale.set(w, 1, l);
  nose.position.set(0, 0.4 * h, 1.1 * l);
  kartMesh.add(nose);

  for (const [wx, wz] of [
    [-0.6, 0.7],
    [0.6, 0.7],
    [-0.6, -0.7],
    [0.6, -0.7],
  ] as const) {
    const wheel = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.22, wz);
    kartMesh.add(wheel);
  }

  kartCache.set(def.id, kartMesh);
  return kartMesh;
}

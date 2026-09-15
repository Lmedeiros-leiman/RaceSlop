import * as THREE from 'three';
import type { Track } from './track';

// Ribbon mesh over a data-driven track's center-line samples.
// Wall tracks: 5 materials (asphalt, edge lines, start stripe, ground,
// barriers). Soft tracks: + shoulder ribbon (6 materials).
export function buildTrackMesh(track: Track): THREE.Group {
  const group = new THREE.Group();
  const n = track.samples.length;
  const hw = track.halfWidth;
  const wallOffset = track.boundary === 'soft' ? track.shoulder : 0;

  // Per-sample 2D frames: tangent from central differences, normal = (-tz, tx).
  const normals: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const prev = track.samples[(i - 1 + n) % n];
    const next = track.samples[(i + 1) % n];
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    normals.push({ x: -tz / len, z: tx / len });
  }
  const left = (i: number, extra: number): [number, number] => {
    const s = track.samples[i];
    const nr = normals[i];
    return [s.x + nr.x * (hw + extra), s.z + nr.z * (hw + extra)];
  };
  const right = (i: number, extra: number): [number, number] => {
    const s = track.samples[i];
    const nr = normals[i];
    return [s.x - nr.x * (hw + extra), s.z - nr.z * (hw + extra)];
  };

  // 1. Asphalt ribbon (triangle strip over left/right offsets, closed loop).
  const roadPos = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const [lx, lz] = left(i, 0);
    const [rx, rz] = right(i, 0);
    roadPos.set([lx, 0, lz], i * 6);
    roadPos.set([rx, 0, rz], i * 6 + 3);
  }
  const roadIdx: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    roadIdx.push(i * 2, i * 2 + 1, j * 2, i * 2 + 1, j * 2 + 1, j * 2);
  }
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.BufferAttribute(roadPos, 3));
  roadGeo.setIndex(roadIdx);
  roadGeo.computeVertexNormals();
  const asphaltMat = new THREE.MeshStandardMaterial({ color: track.theme.asphalt, flatShading: true, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(roadGeo, asphaltMat));

  // 2. Contrasting edge lines at the asphalt edge.
  const edgePos = new Float32Array(n * 2 * 2 * 3);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [alx, alz] = left(i, 0);
    const [blx, blz] = left(j, 0);
    const [arx, arz] = right(i, 0);
    const [brx, brz] = right(j, 0);
    edgePos.set([alx, 0.02, alz, blx, 0.02, blz], i * 12);
    edgePos.set([arx, 0.02, arz, brx, 0.02, brz], i * 12 + 6);
  }
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
  const edgeMat = new THREE.LineBasicMaterial({ color: track.theme.edge });
  group.add(new THREE.LineSegments(edgeGeo, edgeMat));

  // 3. White start-line quad across the asphalt, built from the start
  // frame: f = tangent (sin h, cos h), p = across-track normal.
  // Corners: start.pos ± p * halfWidth ± f * 0.6.
  const h = track.start.heading;
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  const px = Math.cos(h);
  const pz = -Math.sin(h);
  const sx = track.start.pos.x;
  const sz = track.start.pos.z;
  const stripeGeo = new THREE.BufferGeometry();
  stripeGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([
        sx + px * hw + fx * 0.6, 0.02, sz + pz * hw + fz * 0.6,
        sx - px * hw + fx * 0.6, 0.02, sz - pz * hw + fz * 0.6,
        sx - px * hw - fx * 0.6, 0.02, sz - pz * hw - fz * 0.6,
        sx + px * hw - fx * 0.6, 0.02, sz + pz * hw - fz * 0.6,
      ]),
      3,
    ),
  );
  stripeGeo.setIndex([0, 1, 2, 0, 2, 3]);
  stripeGeo.computeVertexNormals();
  const startMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(stripeGeo, startMat));

  // 4. Large ground plane.
  const groundGeo = new THREE.PlaneGeometry(400, 400);
  const groundMat = new THREE.MeshStandardMaterial({ color: track.theme.ground, flatShading: true });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);

  // 5. Low barrier walls (height 0.6) at the outer edge: +/- halfWidth
  // on wall tracks, +/- (halfWidth + shoulder) on soft tracks.
  const wallH = 0.6;
  const wallPos = new Float32Array(n * 2 * 2 * 3);
  for (let i = 0; i < n; i++) {
    const [lx, lz] = left(i, wallOffset);
    const [rx, rz] = right(i, wallOffset);
    wallPos.set([lx, 0, lz], i * 12);
    wallPos.set([lx, wallH, lz], i * 12 + 3);
    wallPos.set([rx, 0, rz], i * 12 + 6);
    wallPos.set([rx, wallH, rz], i * 12 + 9);
  }
  const wallIdx: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const li = i * 4;
    const lj = j * 4;
    wallIdx.push(li, lj, li + 1, li + 1, lj, lj + 1);
    wallIdx.push(li + 2, li + 3, lj + 2, li + 3, lj + 3, lj + 2);
  }
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.BufferAttribute(wallPos, 3));
  wallGeo.setIndex(wallIdx);
  wallGeo.computeVertexNormals();
  const wallMat = new THREE.MeshStandardMaterial({ color: track.theme.barrier, flatShading: true, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(wallGeo, wallMat));

  // 6. Soft tracks: grass shoulder ribbon spanning halfWidth ..
  // halfWidth + shoulder on both sides, one geometry, one material.
  if (track.boundary === 'soft' && track.shoulder > 0) {
    const shPos = new Float32Array(n * 4 * 3);
    for (let i = 0; i < n; i++) {
      const [alx, alz] = left(i, 0);
      const [blx, blz] = left(i, track.shoulder);
      const [arx, arz] = right(i, 0);
      const [brx, brz] = right(i, track.shoulder);
      shPos.set([alx, 0.01, alz], i * 12);
      shPos.set([blx, 0.01, blz], i * 12 + 3);
      shPos.set([arx, 0.01, arz], i * 12 + 6);
      shPos.set([brx, 0.01, brz], i * 12 + 9);
    }
    const shIdx: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const li = i * 4;
      const lj = j * 4;
      shIdx.push(li, lj, li + 1, li + 1, lj, lj + 1);
      shIdx.push(li + 2, li + 3, lj + 2, li + 3, lj + 3, lj + 2);
    }
    const shGeo = new THREE.BufferGeometry();
    shGeo.setAttribute('position', new THREE.BufferAttribute(shPos, 3));
    shGeo.setIndex(shIdx);
    shGeo.computeVertexNormals();
    const shMat = new THREE.MeshStandardMaterial({
      color: track.theme.shoulder,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    group.add(new THREE.Mesh(shGeo, shMat));
  }

  return group;
}

export function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
}

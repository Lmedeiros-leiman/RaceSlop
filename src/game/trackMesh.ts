import * as THREE from 'three';
import type { Track } from './track';

// Placeholder ribbon mesh over the oval center-line samples.
// 5 materials: asphalt, edge lines, start stripe, ground, barriers.
export function buildTrackMesh(track: Track): THREE.Group {
  const group = new THREE.Group();
  const n = track.samples.length;
  const hw = track.halfWidth;

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
  const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x3a3a42, flatShading: true, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(roadGeo, asphaltMat));

  // 2. Contrasting edge lines.
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
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xff5533 });
  group.add(new THREE.LineSegments(edgeGeo, edgeMat));

  // 3. White start-line quad across the asphalt at the start position.
  // Start sits mid-straight with tangent +x, so across-track spans z.
  const startGeo = new THREE.PlaneGeometry(1.2, hw * 2);
  const startMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const startStripe = new THREE.Mesh(startGeo, startMat);
  startStripe.rotation.x = -Math.PI / 2;
  startStripe.position.set(track.start.pos.x, 0.02, track.start.pos.z);
  group.add(startStripe);

  // 4. Large ground plane.
  const groundGeo = new THREE.PlaneGeometry(400, 400);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e3324, flatShading: true });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);

  // 5. Low barrier walls (height 0.6) at +/- halfWidth, both sides in one geometry.
  const wallH = 0.6;
  const wallPos = new Float32Array(n * 2 * 2 * 3);
  for (let i = 0; i < n; i++) {
    const [lx, lz] = left(i, 0);
    const [rx, rz] = right(i, 0);
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
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcc2233, flatShading: true, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(wallGeo, wallMat));

  return group;
}

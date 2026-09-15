import * as THREE from 'three';
import type { Vec2 } from './types';

export interface ChasePose {
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
}

const CAM_BACK = 6;
const CAM_UP = 3;
const LOOK_AHEAD = 4;

export function computeChasePose(pos: Vec2, heading: number): ChasePose {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  return {
    camX: pos.x - fx * CAM_BACK,
    camY: CAM_UP,
    camZ: pos.z - fz * CAM_BACK,
    lookX: pos.x + fx * LOOK_AHEAD,
    lookY: 1,
    lookZ: pos.z + fz * LOOK_AHEAD,
  };
}

export function applyChaseCamera(camera: THREE.PerspectiveCamera, pose: ChasePose): void {
  camera.position.set(pose.camX, pose.camY, pose.camZ);
  camera.lookAt(pose.lookX, pose.lookY, pose.lookZ);
}

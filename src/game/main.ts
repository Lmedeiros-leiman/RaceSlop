import * as THREE from 'three';
import { applyChaseCamera, computeChasePose } from './camera';
import { buildKartMesh, CHARACTERS } from './characters';
import { updateHud } from './hud';
import { attachKeyboard, consumeActions } from './input';
import { cancelDrift, stepKart } from './kart';
import { buildTrack, isOffTrack, LapTracker, resolveBoundary } from './track';
import { OVAL_DEF } from './tracks';
import { buildTrackMesh } from './trackMesh';
import { createKartState, createRawInput, DEFAULT_PARAMS, toDriveInput } from './types';

// Full M1 game entry. Runs only in the browser (imported from a
// client-side module script in GameCanvas.astro, never on the server).
export function initGame(canvas: HTMLCanvasElement, hud: HTMLElement): void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || 960, canvas.clientHeight || 540, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111118);

  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);

  const light = new THREE.DirectionalLight(0xffffff, 1.5);
  light.position.set(4, 8, 4);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x8888ff, 0.5));

  const track = buildTrack(OVAL_DEF);
  scene.add(buildTrackMesh(track));

  // Selected character until the M2 select flow lands (Plan 04).
  const kartMesh = buildKartMesh(CHARACTERS[0]);
  scene.add(kartMesh);

  const kart = createKartState(track.start.pos.x, track.start.pos.z, track.start.heading);
  const tracker = new LapTracker(track.checkpoints);
  tracker.reset(0);

  const raw = createRawInput();
  attachKeyboard(raw);

  const onResize = (): void => {
    const w = canvas.clientWidth || 960;
    const h = canvas.clientHeight || 540;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  onResize();

  const respawn = (now: number): void => {
    // Nearest center-line sample + tangent from its neighbors.
    const samples = track.samples;
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < samples.length; i++) {
      const d = Math.hypot(kart.pos.x - samples[i].x, kart.pos.z - samples[i].z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const prev = samples[(best - 1 + samples.length) % samples.length];
    const next = samples[(best + 1) % samples.length];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    kart.pos.x = samples[best].x;
    kart.pos.z = samples[best].z;
    kart.heading = Math.atan2(dx / len, dz / len);
    kart.speed = 0;
    cancelDrift(kart);
    tracker.invalidate(now);
  };

  const clock = new THREE.Clock();
  let now = 0;
  const loop = (): void => {
    // 1. Clamped dt + own lap clock.
    const dt = Math.min(clock.getDelta(), 0.05);
    now += dt;

    // 2. Input.
    const drive = toDriveInput(raw);
    const actions = consumeActions(raw);

    // 3. Reset / restart.
    if (actions.restart) tracker.reset(now);
    if (actions.reset) respawn(now);

    // 4. Physics.
    stepKart(kart, drive, DEFAULT_PARAMS, dt);

    // 5. Walls (single call per frame: the 0.7x bleed compounds per call).
    resolveBoundary(kart, track);

    // 6. Off-track cap (safety net only: resolveBoundary above already
    // clamps at the asphalt edge per SPEC-M1 §5, so this fires only if a
    // position ever escapes the clamp, e.g. tunneling on a lag spike).
    if (isOffTrack(kart.pos, track) && kart.speed > DEFAULT_PARAMS.offTrackCap) {
      kart.speed = DEFAULT_PARAMS.offTrackCap;
    }

    // 7. Laps + kart mesh sync.
    tracker.update(kart.pos, now);
    kartMesh.position.set(kart.pos.x, 0, kart.pos.z);
    kartMesh.rotation.y = kart.heading + kart.driftAngle;

    // 8. Chase camera.
    applyChaseCamera(camera, computeChasePose(kart.pos, kart.heading));

    // 9. HUD.
    updateHud(hud, {
      current: tracker.current,
      last: tracker.last,
      best: tracker.best,
      drifting: kart.drifting,
      boost: kart.boostTime > 0,
    });

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  loop();
}

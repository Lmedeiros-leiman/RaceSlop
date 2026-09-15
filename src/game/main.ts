import * as THREE from 'three';
import { applyChaseCamera, computeChasePose } from './camera';
import { updateHud } from './hud';
import { attachKeyboard, consumeActions } from './input';
import { cancelDrift, stepKart } from './kart';
import { buildOval, isOffTrack, LapTracker, resolveBoundary } from './track';
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

  const track = buildOval();
  scene.add(buildTrackMesh(track));

  // Placeholder kart (SPEC-M1 §9): box body in driver red + 4 cylinder
  // wheels, created once at boot. Front nose marker makes heading
  // readable from the chase camera behind.
  const kartMesh = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.5, 2),
    new THREE.MeshStandardMaterial({ color: 0xff3355, flatShading: true }),
  );
  body.position.y = 0.45;
  kartMesh.add(body);
  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.2, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xffcc33, flatShading: true }),
  );
  nose.position.set(0, 0.4, 1.1);
  kartMesh.add(nose);
  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.25, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x181818, flatShading: true });
  for (const [wx, wz] of [[-0.6, 0.7], [0.6, 0.7], [-0.6, -0.7], [0.6, -0.7]] as const) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.22, wz);
    kartMesh.add(wheel);
  }
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

    // 6. Off-track cap.
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

import * as THREE from 'three';
import { applyChaseCamera, computeChasePose } from './camera';
import { buildKartMesh, CHARACTERS } from './characters';
import { flowKey, initialFlow, renderOverlay, type FlowState } from './flow';
import { updateHud } from './hud';
import { attachKeyboard, consumeActions } from './input';
import { cancelDrift, stepKart } from './kart';
import { drawMinimap, MINIMAP_SIZE } from './minimap';
import { createBrowserRecordStore } from './records';
import { buildTrack, isOffTrack, LapTracker, resolveBoundary, type Track } from './track';
import { buildTrackMesh, disposeGroup } from './trackMesh';
import { TRACKS } from './tracks';
import { createKartState, createRawInput, DEFAULT_PARAMS, toDriveInput, type KartState } from './types';

interface Race {
  track: Track;
  group: THREE.Group;
  kartMesh: THREE.Group;
  kart: KartState;
  tracker: LapTracker;
}

// Full M2 game entry: character select -> track select -> race (M1 loop),
// with best-lap persistence. Runs only in the browser (imported from a
// client-side module script in GameCanvas.astro, never on the server).
export function initGame(canvas: HTMLCanvasElement, hud: HTMLElement, overlay: HTMLElement, minimap: HTMLCanvasElement): void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || 960, canvas.clientHeight || 540, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(TRACKS[0].theme.sky);

  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);

  const light = new THREE.DirectionalLight(0xffffff, 1.5);
  light.position.set(4, 8, 4);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x8888ff, 0.5));

  const store = createBrowserRecordStore();
  const counts = { characters: CHARACTERS.length, tracks: TRACKS.length };
  const deps = { characters: CHARACTERS, tracks: TRACKS, getBest: (id: string) => store.getBest(id) };

  const raw = createRawInput();
  attachKeyboard(raw);

  const mctx = minimap.getContext('2d');

  let flow: FlowState = initialFlow();
  let race: Race | null = null;
  let now = 0;

  const startRace = (trackIndex: number, characterIndex: number): void => {
    if (race) {
      scene.remove(race.group);
      disposeGroup(race.group); // no GPU leak across track switches (SPEC-M2 §10)
      scene.remove(race.kartMesh); // cached group, reused — never disposed
    }
    const track = buildTrack(TRACKS[trackIndex]);
    const group = buildTrackMesh(track);
    scene.add(group);
    const kartMesh = buildKartMesh(CHARACTERS[characterIndex]);
    scene.add(kartMesh);
    // Fresh tracker per race, seeded from records — never carried across
    // tracks. Fresh KartState clears drift/boost.
    const tracker = new LapTracker(track.checkpoints);
    const storedBest = store.getBest(track.id);
    if (storedBest !== null) tracker.best = storedBest;
    tracker.reset(now);
    const kart = createKartState(track.start.pos.x, track.start.pos.z, track.start.heading);
    kartMesh.position.set(kart.pos.x, 0, kart.pos.z);
    kartMesh.rotation.y = kart.heading;
    scene.background = new THREE.Color(track.theme.sky);
    applyChaseCamera(camera, computeChasePose(kart.pos, kart.heading));
    hud.textContent = '';
    race = { track, group, kartMesh, kart, tracker };
  };

  const exitRace = (): void => {
    if (race) {
      scene.remove(race.group);
      disposeGroup(race.group);
      scene.remove(race.kartMesh);
      race = null;
    }
    hud.textContent = '';
    mctx?.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
  };

  const handlePick = (screen: 'character' | 'track', index: number): void => {
    if (flow.screen !== screen) return;
    flow = screen === 'character' ? { ...flow, character: index } : { ...flow, track: index };
    flow = flowKey(flow, 'confirm', counts);
    if (flow.screen === 'race') startRace(flow.track, flow.character);
    renderOverlay(overlay, flow, deps, handlePick);
  };

  renderOverlay(overlay, flow, deps, handlePick);

  const onResize = (): void => {
    const w = canvas.clientWidth || 960;
    const h = canvas.clientHeight || 540;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  onResize();

  const respawn = (r: Race): void => {
    // Nearest center-line sample + tangent from its neighbors.
    const samples = r.track.samples;
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < samples.length; i++) {
      const d = Math.hypot(r.kart.pos.x - samples[i].x, r.kart.pos.z - samples[i].z);
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
    r.kart.pos.x = samples[best].x;
    r.kart.pos.z = samples[best].z;
    r.kart.heading = Math.atan2(dx / len, dz / len);
    r.kart.speed = 0;
    cancelDrift(r.kart);
    r.tracker.invalidate(now);
  };

  let prevLeft = false;
  let prevRight = false;

  const clock = new THREE.Clock();
  const loop = (): void => {
    const dt = Math.min(clock.getDelta(), 0.05);

    if (flow.screen === 'race' && race) {
      // Race clock only advances in race: frozen while menus are up, and
      // the dt clamp above absorbs the resume spike (SPEC-M2 §7).
      now += dt;
      const r = race;
      const actions = consumeActions(raw);
      if (actions.escape) {
        flow = flowKey(flow, 'back', counts);
        exitRace();
        renderOverlay(overlay, flow, deps, handlePick);
      } else {
        const drive = toDriveInput(raw);
        if (actions.confirm) r.tracker.reset(now);
        if (actions.reset) respawn(r);

        stepKart(r.kart, drive, DEFAULT_PARAMS, dt);
        resolveBoundary(r.kart, r.track);
        // Off-track rules: hard cap on the slowdown surface; grass cancels
        // drift charge (no charging a boost off-track). Unreachable behind
        // the wall clamp on wall tracks.
        if (isOffTrack(r.kart.pos, r.track)) {
          if (r.kart.speed > r.track.offTrackCap) r.kart.speed = r.track.offTrackCap;
          cancelDrift(r.kart);
        }
        const lap = r.tracker.update(r.kart.pos, now);
        if (lap.lap !== null) store.recordLap(r.track.id, lap.lap);

        r.kartMesh.position.set(r.kart.pos.x, 0, r.kart.pos.z);
        r.kartMesh.rotation.y = r.kart.heading + r.kart.driftAngle;
        applyChaseCamera(camera, computeChasePose(r.kart.pos, r.kart.heading));
        if (mctx) drawMinimap(mctx, r.track, r.kart.pos);
        updateHud(hud, {
          current: r.tracker.current,
          last: r.tracker.last,
          best: r.tracker.best,
          drifting: r.kart.drifting,
          boost: r.kart.boostTime > 0,
        });
      }
    } else {
      // Menus: render, but skip physics/laps and keep `now` frozen. Cursor
      // moves are edge-detected on held keys; confirm/back are consumed
      // edge actions (the transition keypress never double-fires in race
      // because flags are cleared here and repeats are guarded in input).
      const actions = consumeActions(raw);
      let action: 'left' | 'right' | 'confirm' | 'back' | null = null;
      if (raw.left && !prevLeft) action = 'left';
      else if (raw.right && !prevRight) action = 'right';
      else if (actions.confirm) action = 'confirm';
      else if (actions.escape) action = 'back';
      if (action !== null) {
        flow = flowKey(flow, action, counts);
        if (flow.screen === 'race') startRace(flow.track, flow.character);
        renderOverlay(overlay, flow, deps, handlePick);
      }
    }
    prevLeft = raw.left;
    prevRight = raw.right;

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  loop();
}

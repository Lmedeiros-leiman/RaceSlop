import * as THREE from 'three';

// Isolated game entry. Runs only in the browser (imported from a
// client-side module script in GameCanvas.astro, never on the server).
export function initGame(canvas: HTMLCanvasElement): void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || 960, canvas.clientHeight || 540, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111118);

  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 200);
  camera.position.set(0, 3, 6);
  camera.lookAt(0, 0, 0);

  const light = new THREE.DirectionalLight(0xffffff, 1.5);
  light.position.set(4, 8, 4);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x8888ff, 0.5));

  // Placeholder "kart": M1 replaces with real kart + track + physics.
  const kart = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.5, 2),
    new THREE.MeshStandardMaterial({ color: 0xff3355, flatShading: true }),
  );
  kart.position.y = 0.5;
  scene.add(kart);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x22222c, flatShading: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const onResize = (): void => {
    const w = canvas.clientWidth || 960;
    const h = canvas.clientHeight || 540;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  onResize();

  const clock = new THREE.Clock();
  const loop = (): void => {
    const t = clock.getElapsedTime();
    kart.rotation.y = t * 0.8;
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  loop();
}

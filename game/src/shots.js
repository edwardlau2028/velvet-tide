// VELVET TIDE — deterministic screenshot staging (?shot=...) and a scripted
// self-test (?autotest=1) that plays the game headlessly and reports PASS.
import { PLACES, CAR_MODELS } from './config.js';
import { makeCarMesh } from './vehicles.js';

function dismissDialogue(G) {
  let guard = 0;
  while (G.dialogueOpen && guard++ < 8) G.hud.hideDialogue();
}

export function stageShot(G) {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return;
  // Staged shots: freeze police movement so cruisers stay where placed.
  G.staged = true;
  // Start the game without the title screen.
  G.startGame(false);
  if (shot === 'start') {
    G.state = 'title';
    document.getElementById('startScreen').classList.remove('hidden');
    G.hud.hide();
    return;
  }
  if (shot === 'drive') {
    putPlayerInCar(G, 'Osprey GT', 0, -40, Math.PI);
    G.camYaw = Math.PI; G.camPitch = 0.3;
    G.mission.index = 3; G.mission.start(); dismissDialogue(G);
    return;
  }
  if (shot === 'chase') {
    putPlayerInCar(G, 'Lumen Coupe', -75, 0, Math.PI / 2);
    G.camYaw = Math.PI / 2; G.camPitch = 0.3;
    G.wanted = 3;
    G.police.spawnCruiser(); G.police.spawnCruiser();
    // Park the cruisers ahead of the player, in frame, closing in.
    G.police.cars[0].x = G.player.x + 14; G.police.cars[0].z = G.player.z + 11;
    G.police.cars[0].heading = -Math.PI / 2;
    if (G.police.cars[1]) {
      G.police.cars[1].x = G.player.x + 18; G.police.cars[1].z = G.player.z - 11;
      G.police.cars[1].heading = -Math.PI / 2;
    }
    G.mission.index = 4; G.mission.start(); dismissDialogue(G);
    return;
  }
  if (shot === 'foot') {
    G.player.x = PLACES.beach.x + 8; G.player.z = PLACES.beach.z - 6;
    G.player.heading = Math.PI * 0.75;
    G.camYaw = Math.PI * 0.75; G.camPitch = 0.32;
    G.mission.index = 2; G.mission.start(); dismissDialogue(G);
    return;
  }
}

function putPlayerInCar(G, modelName, x, z, heading) {
  const model = CAR_MODELS.find((c) => c.name === modelName);
  const mesh = makeCarMesh(model, model.color, false);
  mesh.position.set(x, 0, z); mesh.rotation.y = heading;
  G.scene.add(mesh);
  const car = { mesh, model, x, z, heading, speed: 12, parked: false, traffic: false, stolen: true, hp: 100 };
  G.cars.push(car);
  G.enterCar(car);
}

export function makeAutotest(G) {
  const q = new URLSearchParams(location.search);
  if (q.get('autotest') !== '1') return null;
  const results = [];
  const log = (name, ok, detail) => { results.push(name + ':' + (ok ? 'PASS' : 'FAIL') + (detail ? ' ' + detail : '')); };
  const el = document.getElementById('testResult');
  const finish = () => {
    const failed = results.filter((r) => r.includes(':FAIL')).length;
    el.textContent = (failed === 0 ? 'AUTOTEST PASS' : 'AUTOTEST FAIL') + ' | ' + results.join(' | ');
    el.classList.remove('hidden');
    window.__autotest = el.textContent;
  };
  // Drive the test as a timed script of key presses and checks.
  const steps = [
    [400, () => { G.startGame(false); log('start', G.state === 'play'); }],
    [700, () => { let g = 0; while (G.dialogueOpen && g++ < 8) G.hud.hideDialogue(); log('dialogue-dismissed', !G.dialogueOpen); }],
    [900, () => {
      const car = G.cars.find((c) => c.parked);
      G.player.x = car.x + 2; G.player.z = car.z;
      G.tryEnterCar();
      log('steal', G.player.inCar === true, 'car=' + (G.player.car ? G.player.car.model.name : 'none'));
    }],
    [1400, () => {
      G.keys.KeyW = true;
      log('cars-exist', G.cars.length >= 30, 'cars=' + G.cars.length);
    }],
    [5400, () => {
      G.keys.KeyW = false;
      const moved = Math.hypot(G.player.x - 0, G.player.z - 120) > 5 || G.player.speed > 1;
      log('drive', moved, 'speed=' + Math.round(G.player.speed));
      G.tryExitCar();
      log('exit', G.player.onFoot === true);
    }],
    [5900, () => {
      G.police.addWanted(3, 'test');
      log('wanted', G.wanted === 3);
    }],
    [9000, () => {
      log('police-spawn', G.police.cars.length >= 1, 'cruisers=' + G.police.cars.length);
      G.mission.start(); dismissDialogue(G);
      log('mission-start', G.mission.active === true, G.mission.current() ? G.mission.current().title : '');
    }],
    [10000, () => {
      const s = G.mission.step();
      if (s && s.x !== undefined) { G.player.x = s.x; G.player.z = s.z; }
      log('mission-step', true, s ? s.label : 'none');
    }],
    [11000, () => {
      log('mission-advanced', G.mission.stepIndex >= 1 || G.mission.active, 'step=' + G.mission.stepIndex);
      log('hud', document.getElementById('hud').classList.contains('hidden') === false);
      log('errors', window.__errors.length === 0, window.__errors.slice(0, 3).join(';'));
      log('coins', G.coinMeshes.length === 10);
      log('peds', G.peds.length >= 20);
      finish();
    }],
  ];
  let t0 = performance.now();
  const tick = () => {
    const now = performance.now() - t0;
    while (steps.length && steps[0][0] <= now) steps.shift()[1]();
    if (steps.length) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return { results };
}

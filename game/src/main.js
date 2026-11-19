// VELVET TIDE — main loop: input, camera, on-foot and driving movement,
// and the wiring that ties city, cars, pedestrians, police, missions,
// combat, HUD, audio and saving together. All original code.
import { WORLD, PLAYER } from './config.js';
import { buildCity } from './city.js';
import { spawnWorldCars, driveCar, updateTraffic, nearestCar } from './vehicles.js';
import { spawnPedestrians, updatePedestrians, makePersonMesh, nearestShout } from './pedestrians.js';
import { Police } from './police.js';
import { MissionRunner } from './missions.js';
import { Hud } from './hud.js';
import { AudioSys } from './audio.js';
import { SaveSys } from './save.js';
import { tryPunch, tryShoot, updateThugs, damagePlayer, spawnPickups, updatePickups, updateEffects } from './combat.js';
import { stageShot, makeAutotest } from './shots.js';
import { clamp, dist2d, angleLerp, collideCircleBox } from './util.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87a8c8);
scene.fog = new THREE.Fog(0x87a8c8, 220, 620);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Lighting: warm late-afternoon sun plus sky bounce.
const sun = new THREE.DirectionalLight(0xffe0b0, 1.25);
sun.position.set(140, 190, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -320; sun.shadow.camera.right = 320;
sun.shadow.camera.top = 320; sun.shadow.camera.bottom = -320;
sun.shadow.camera.far = 700;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xffd9a0, 0x2a3a4a, 0.75));

const G = {
  scene, camera, time: 0, state: 'title', clock: 18 * 60 + 40,
  player: {
    x: WORLD.startX, z: WORLD.startZ, heading: 0, health: PLAYER.maxHealth,
    armor: 0, money: PLAYER.startMoney, respect: 0, ammo: PLAYER.startAmmo,
    onFoot: true, inCar: false, car: null, dead: false, firing: 0, speed: 0,
    lastHurt: -99, mesh: null,
  },
  wanted: 0, camYaw: Math.PI, camPitch: 0.32, camDist: 11,
  keys: {}, dialogueOpen: false, autotest: null, effects: [],
  cars: [], peds: [], thugs: [], pickups: [], coinMeshes: [], coinsFound: [],
  combatNoise: 0, combatNoiseX: 0, combatNoiseZ: 0,
  stats: { carsStolen: 0, busted: 0, wasted: 0, missionsDone: 0 },
  city: null, hud: null, audio: new AudioSys(), save: null, police: null, mission: null,
};
G.save = new SaveSys(G);
G.hud = new Hud(G);
window.__game = G;
G.police = new Police(G);
G.mission = new MissionRunner(G);
G.hurtPlayer = (dmg) => damagePlayer(G, dmg);

G.city = buildCity(scene);
G.cars = spawnWorldCars(scene, 21);
G.peds = spawnPedestrians(scene, 28, 31);
G.pickups = spawnPickups(scene, G);

// Tide coins: 10 spinning gold discs worth $200 each.
for (let i = 0; i < G.city.coinSpots.length; i++) {
  const s = G.city.coinSpots[i];
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.18, 16),
    new THREE.MeshLambertMaterial({ color: 0xffd23e, emissive: 0x8a6a00 }));
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(s.x, 1.0, s.z);
  scene.add(mesh);
  G.coinMeshes.push(mesh);
}

// Mara Voss, the player character.
const playerMesh = makePersonMesh(0x7c5cff, 0xe8b890);
playerMesh.scale.setScalar(1.05);
scene.add(playerMesh);
G.player.mesh = playerMesh;

// ---- car entry / exit ----
G.enterCar = (car) => {
  const p = G.player;
  p.inCar = true; p.onFoot = false; p.car = car;
  p.x = car.x; p.z = car.z; p.heading = car.heading;
  car.stolen = true; car.traffic = false; car.parked = false;
  p.mesh.visible = false;
  G.camYaw = car.heading;
  G.hud.flashFeed(car.model.name + ' — W/S drive, SPACE brake, E to exit.');
};
G.tryEnterCar = () => {
  const p = G.player;
  if (p.inCar) { G.tryExitCar(); return; }
  const car = nearestCar(G.cars, p.x, p.z, 4.2);
  if (!car) { G.hud.flashFeed('No car nearby — walk up to one and press E.'); return; }
  if (car.traffic) {
    G.stats.carsStolen++;
    if (nearestShout(G)) G.police.addWanted(1, 'Someone saw you steal that car!');
    else G.hud.flashFeed('Car stolen — nobody saw a thing.');
  }
  G.enterCar(car);
};
G.tryExitCar = () => {
  const p = G.player;
  if (!p.inCar || !p.car) return;
  const car = p.car;
  car.speed = 0;
  p.x = car.x + Math.cos(car.heading) * 2.4;
  p.z = car.z - Math.sin(car.heading) * 2.4;
  p.heading = car.heading;
  p.inCar = false; p.onFoot = true; p.car = null; p.speed = 0;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
};

// ---- game flow ----
G.startGame = (useSave) => {
  G.audio.ensure();
  if (useSave) {
    const data = G.save.load();
    if (data) G.save.apply(data);
  } else {
    G.player.money = PLAYER.startMoney; G.player.respect = 0;
    G.player.health = PLAYER.maxHealth; G.player.armor = 0; G.player.ammo = PLAYER.startAmmo;
    G.player.x = WORLD.startX; G.player.z = WORLD.startZ; G.player.heading = 0;
    G.clock = 18 * 60 + 40; G.wanted = 0; G.coinsFound = [];
    G.mission.index = 0; G.mission.done = false; G.mission.active = false;
    G.stats = { carsStolen: 0, busted: 0, wasted: 0, missionsDone: 0 };
    for (const m of G.coinMeshes) m.visible = true;
  }
  // Hide coins already found in a loaded save.
  for (let i = 0; i < G.coinMeshes.length; i++) {
    if (G.coinsFound.includes(i)) G.coinMeshes[i].visible = false;
  }
  G.state = 'play';
  G.player.dead = false;
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('pauseScreen').classList.add('hidden');
  document.getElementById('endScreen').classList.add('hidden');
  G.hud.show();
  G.hud.setMission('SOLMAR', 'Silas Crane has work for you — wait for his call.');
  G.hud.flashFeed('Welcome to Solmar, Mara. Find a car — press E beside one.');
  setTimeout(() => { if (G.state === 'play' && !G.mission.active && !G.mission.done) G.mission.start(); }, 1200);
};
G.endGame = (kind) => {
  const p = G.player;
  if (p.dead) return;
  p.dead = true;
  if (p.inCar) G.tryExitCar();
  G.state = 'end';
  G.police.clearWanted();
  G.audio.busted();
  const fine = 150;
  p.money = Math.max(0, p.money - fine);
  const title = document.getElementById('endTitle');
  const text = document.getElementById('endText');
  if (kind === 'busted') {
    G.stats.busted++;
    title.textContent = 'BUSTED';
    text.innerHTML = 'The Solmar police hauled you in. You paid $' + fine + ' in fines and lost the heat — but the jobs are still waiting. <b>Silas Crane</b> is not a patient man.';
  } else {
    G.stats.wasted++;
    title.textContent = 'WASTED';
    text.innerHTML = 'Mara went down in the streets of Solmar. St. Anselm patched her up for $' + fine + ' — and the city is still out there, waiting.';
  }
  p.health = PLAYER.maxHealth; p.armor = 0;
  p.x = WORLD.startX; p.z = WORLD.startZ;
  document.getElementById('endScreen').classList.remove('hidden');
};
function togglePause() {
  if (G.state === 'play') {
    G.state = 'pause';
    document.getElementById('pauseStats').textContent =
      'Cash $' + Math.round(G.player.money) + ' · Missions ' + G.stats.missionsDone + '/9 · Cars stolen ' + G.stats.carsStolen + ' · Coins ' + G.coinsFound.length + '/10';
    document.getElementById('pauseScreen').classList.remove('hidden');
  } else if (G.state === 'pause') {
    G.state = 'play';
    document.getElementById('pauseScreen').classList.add('hidden');
  }
}

// ---- input ----
window.addEventListener('keydown', (e) => {
  G.keys[e.code] = true;
  if (e.code === 'Enter' && G.dialogueOpen) G.hud.hideDialogue();
  if ((e.code === 'KeyP' || e.code === 'Escape') && (G.state === 'play' || G.state === 'pause')) togglePause();
  if (e.code === 'KeyM') { G.audio.setMuted(!G.audio.muted); G.hud.flashFeed(G.audio.muted ? 'Sound muted.' : 'Sound on.'); }
  if (e.code === 'KeyR' && G.state === 'play') G.hud.flashFeed(G.audio.cycleStation());
  if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
    G.audio.station = Number(e.code.slice(-1)) - 1;
    if (G.state === 'play') G.hud.flashFeed('Radio: ' + ['TIDE FM', 'NEON 88', 'VELVET SOUL'][G.audio.station]);
  }
  if (e.code === 'KeyS' && G.state === 'play') G.save.save();
  if (e.code === 'KeyF' && G.state === 'play' && G.player.onFoot) tryPunch(G);
  if (e.code === 'KeyE' && G.state === 'play') G.tryEnterCar();
  if (e.code === 'KeyC' && G.state === 'play') G.camDist = G.camDist > 14 ? 11 : 17;
});
window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
let dragging = false, lastX = 0, lastY = 0, shootCd = 0;
canvas.addEventListener('mousedown', (e) => {
  dragging = true; lastX = e.clientX; lastY = e.clientY;
  if (G.state === 'play' && G.player.onFoot && !G.dialogueOpen && shootCd <= 0) {
    shootCd = 0.28; tryShoot(G);
  }
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  G.camYaw -= (e.clientX - lastX) * 0.005;
  G.camPitch = clamp(G.camPitch + (e.clientY - lastY) * 0.004, 0.05, 0.9);
  lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener('mouseup', () => { dragging = false; });

document.getElementById('btnNew').addEventListener('click', () => G.startGame(false));
document.getElementById('btnContinue').addEventListener('click', () => G.startGame(true));
document.getElementById('btnHow').addEventListener('click', () => {
  document.getElementById('controlsList').classList.toggle('hidden');
});
document.getElementById('btnResume').addEventListener('click', togglePause);
document.getElementById('btnSave').addEventListener('click', () => G.save.save());
document.getElementById('btnQuit').addEventListener('click', () => {
  G.state = 'title';
  document.getElementById('pauseScreen').classList.add('hidden');
  document.getElementById('startScreen').classList.remove('hidden');
  G.hud.hide();
});
document.getElementById('btnRetry').addEventListener('click', () => {
  document.getElementById('endScreen').classList.add('hidden');
  G.state = 'play'; G.player.dead = false;
  G.hud.show();
});
document.getElementById('btnEndTitle').addEventListener('click', () => {
  G.state = 'title';
  document.getElementById('endScreen').classList.add('hidden');
  document.getElementById('startScreen').classList.remove('hidden');
  G.hud.hide();
});
if (!G.save.hasSave()) document.getElementById('btnContinue').disabled = true;

// ---- on-foot movement ----
function updatePlayerOnFoot(dt) {
  const p = G.player;
  const k = G.keys;
  const F = [Math.sin(G.camYaw), Math.cos(G.camYaw)];
  const R = [-Math.cos(G.camYaw), Math.sin(G.camYaw)];
  let mx = 0, mz = 0;
  if (k.KeyW || k.ArrowUp) { mx += F[0]; mz += F[1]; }
  if (k.KeyS || k.ArrowDown) { mx -= F[0]; mz -= F[1]; }
  if (k.KeyD || k.ArrowRight) { mx += R[0]; mz += R[1]; }
  if (k.KeyA || k.ArrowLeft) { mx -= R[0]; mz -= R[1]; }
  const len = Math.hypot(mx, mz);
  const sprint = k.ShiftLeft || k.ShiftRight;
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  if (len > 0.01) {
    mx /= len; mz /= len;
    p.heading = Math.atan2(mx, mz);
    const nx = p.x + mx * speed * dt;
    const nz = p.z + mz * speed * dt;
    const pos = { x: nx, z: nz };
    for (const b of G.city.colliders) collideCircleBox(pos, PLAYER.radius, b);
    p.x = clamp(pos.x, -290, 318);
    p.z = clamp(pos.z, -290, 290);
    p.speed = speed;
    p.mesh.userData.armL.rotation.x = Math.sin(G.time * 10) * 0.5;
    p.mesh.userData.armR.rotation.x = -Math.sin(G.time * 10) * 0.5;
  } else {
    p.speed = 0;
    p.mesh.userData.armL.rotation.x *= 0.9;
    p.mesh.userData.armR.rotation.x *= 0.9;
  }
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
}

// ---- camera ----
function updateCamera(dt) {
  const p = G.player;
  if (G.state === 'title') {
    const a = G.time * 0.05;
    camera.position.set(Math.sin(a) * 210, 90, Math.cos(a) * 210);
    camera.lookAt(0, 0, 0);
    return;
  }
  let fx, fz, tx, tz, dist, height;
  if (p.inCar && p.car) {
    G.camYaw = angleLerp(G.camYaw, p.car.heading, Math.min(1, dt * 2.2));
    fx = Math.sin(G.camYaw); fz = Math.cos(G.camYaw);
    tx = p.car.x; tz = p.car.z;
    dist = G.camDist * 0.68; height = 3.0;
  } else {
    fx = Math.sin(G.camYaw); fz = Math.cos(G.camYaw);
    tx = p.x; tz = p.z;
    dist = G.camDist * 0.72; height = 3.4;
  }
  const pitch = G.camPitch;
  camera.position.set(
    tx - fx * dist * (1 - pitch * 0.2),
    height + pitch * 4,
    tz - fz * dist * (1 - pitch * 0.2));
  camera.lookAt(tx + fx * 4, 1.6, tz + fz * 4);
}

// ---- main loop ----
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0.001, 0.05);
  last = now;
  G.time += dt;
  shootCd = Math.max(0, shootCd - dt);
  G.player.firing = Math.max(0, G.player.firing - dt);
  G.combatNoise = Math.max(0, G.combatNoise - dt);
  if (G.state === 'play') {
    G.clock = (G.clock + dt * 0.55) % 1440;
    const p = G.player;
    if (p.inCar && p.car) {
      driveCar(G, p.car, dt);
      p.x = p.car.x; p.z = p.car.z; p.heading = p.car.heading;
      if (p.car.hp <= 0) {
        p.car.hp = 100;
        G.hud.flashFeed('Your car is wrecked — it still runs, barely.');
      }
    } else {
      updatePlayerOnFoot(dt);
    }
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    G.police.update(dt);
    updateThugs(G, dt);
    updatePickups(G, dt);
    updateEffects(G, dt);
    G.mission.update(dt);
    G.audio.updateRadio();
    G.audio.setEngine(p.inCar ? clamp(Math.abs(p.car ? p.car.speed : 0) / 30, 0, 1) : 0, p.inCar);
    G.hud.update();
    // Dusk deepens into night as the clock passes 20:00.
    const night = clamp((G.clock - 1200) / 240, 0, 1);
    scene.background.setHex(night > 0.5 ? 0x1a2438 : 0x87a8c8);
    scene.fog.color.copy(scene.background);
    sun.intensity = 1.25 - night * 0.7;
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// Screenshot staging and the headless self-test.
stageShot(G);
G.autotest = makeAutotest(G);

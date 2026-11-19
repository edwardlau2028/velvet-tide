// VELVET TIDE — cars: factory, parked cars, traffic AI and driving physics.
// All vehicles are original designs built from boxes and cylinders.
import { CAR_MODELS, WORLD, POLICE_COLOR } from './config.js';
import { clamp, angleLerp, angleDiff, mulberry32, pick } from './util.js';

export function makeCarMesh(model, color, isPolice) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14181d });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8e8, emissive: 0x1a3a44 });
  const len = model.len;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, len), paint);
  body.position.y = 0.65; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, len * 0.48), glass);
  cabin.position.set(0, 1.3, -len * 0.05); cabin.castShadow = true; g.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 0.5), paint);
  nose.position.set(0, 0.55, len / 2); g.add(nose);
  // Headlights and taillights.
  const hl = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x776622 });
  const tl = new THREE.MeshLambertMaterial({ color: 0xff2a2a, emissive: 0x550000 });
  for (const s of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), hl);
    h.position.set(s, 0.7, len / 2 + 0.22); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tl);
    t.position.set(s, 0.7, -len / 2 - 0.22); g.add(t);
  }
  if (model.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xffe9a0, emissive: 0x554400 }));
    sign.position.set(0, 1.75, 0); g.add(sign);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x1122aa }));
    bar.position.set(0, 1.72, -len * 0.05); g.add(bar);
    bar.name = 'lightbar';
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, len * 0.9),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    stripe.position.y = 0.72; g.add(stripe);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0e10 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, len * 0.32], [0.95, len * 0.32], [-0.95, -len * 0.32], [0.95, -len * 0.32]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

export function spawnWorldCars(scene, seed) {
  const rng = mulberry32(seed || 21);
  const cars = [];
  // Parked cars along the roads, some in front of shops.
  const spots = [];
  for (const r of WORLD.roads) {
    for (let d = -240; d <= 240; d += 60) {
      spots.push({ x: r + 5.5, z: d + rng() * 20 - 10, along: 'x' });
      spots.push({ x: d + rng() * 20 - 10, z: r - 5.5, along: 'z' });
    }
  }
  for (let i = 0; i < 22; i++) {
    const s = spots[Math.floor(rng() * spots.length)];
    const model = pick(rng, CAR_MODELS);
    const mesh = makeCarMesh(model, model.color, false);
    const heading = s.along === 'x' ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    mesh.position.set(s.x, 0, s.z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    cars.push({ mesh, model, x: s.x, z: s.z, heading, speed: 0, parked: true, traffic: false, stolen: false, hp: 100, driver: null });
  }
  // Moving traffic on the grid.
  for (let i = 0; i < 14; i++) {
    const model = pick(rng, CAR_MODELS);
    const mesh = makeCarMesh(model, model.color, false);
    const horizontal = rng() < 0.5;
    const road = pick(rng, WORLD.roads);
    const d = -260 + rng() * 520;
    const dir = rng() < 0.5 ? 1 : -1;
    const x = horizontal ? d : road + (dir > 0 ? -3.5 : 3.5);
    const z = horizontal ? road + (dir > 0 ? 3.5 : -3.5) : d;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    scene.add(mesh);
    cars.push({
      mesh, model, x, z, heading: mesh.rotation.y,
      speed: (9 + rng() * 6) * dir, parked: false, traffic: true,
      horizontal, road, dir, stolen: false, hp: 100, driver: null,
    });
  }
  return cars;
}

export function nearestCar(cars, x, z, maxD) {
  let best = null, bd = maxD;
  for (const c of cars) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// Player driving: arcade physics with steering, grip and handbrake drift.
export function driveCar(G, car, dt) {
  const k = G.keys;
  const fwd = (k.KeyW || k.ArrowUp) ? 1 : 0;
  const back = (k.KeyS || k.ArrowDown) ? 1 : 0;
  const steerIn = (k.KeyA || k.ArrowLeft ? -1 : 0) + (k.KeyD || k.ArrowRight ? 1 : 0);
  const brake = k.Space ? true : false;
  const top = car.model.top;
  if (fwd) car.speed += car.model.accel * dt;
  if (back) car.speed -= car.model.accel * 0.8 * dt;
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * 6 * dt;
  if (brake) car.speed -= Math.sign(car.speed) * 22 * dt;
  car.speed = clamp(car.speed, -top * 0.45, top);
  if (Math.abs(car.speed) < 0.05 && !fwd && !back) car.speed = 0;
  const spd = Math.abs(car.speed);
  const steer = steerIn * clamp(spd / 8, 0, 1) * (brake ? 1.5 : 1) * car.model.grip;
  car.heading += steer * (car.speed >= 0 ? 1 : -1) * 1.9 * dt * (brake ? 0.6 : 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const pos = { x: nx, z: nz };
  let hit = false;
  for (const b of G.city.colliders) {
    if (Math.abs(pos.x - (b.minX + b.maxX) / 2) < (b.maxX - b.minX) / 2 + 1.4 &&
        Math.abs(pos.z - (b.minZ + b.maxZ) / 2) < (b.maxZ - b.minZ) / 2 + 1.4) {
      // Circle-vs-box test with the car's footprint.
      const cx = clamp(pos.x, b.minX, b.maxX), cz = clamp(pos.z, b.minZ, b.maxZ);
      if (Math.hypot(pos.x - cx, pos.z - cz) < 1.4) { hit = true; break; }
    }
  }
  if (hit) {
    car.speed *= -0.25;
    car.hp -= Math.abs(car.speed) * 0.4 + 2;
    G.audio.blip(70, 0.12, 'square', 0.2);
  } else {
    car.x = nx; car.z = nz;
  }
  car.x = clamp(car.x, -295, 318);
  car.z = clamp(car.z, -295, 295);
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // Wheel spin.
  const spin = car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  G.player.speed = Math.abs(car.speed) * 2.24; // mph
  return car.speed;
}

// Traffic: follow the grid, turn at intersections, stop for nothing.
export function updateTraffic(G, dt) {
  for (const c of G.cars) {
    if (!c.traffic || c.stolen) continue;
    const ahead = c.speed * dt;
    if (c.horizontal) c.x += ahead;
    else c.z += ahead;
    // At an intersection, sometimes turn.
    const nearRoad = WORLD.roads.some((r) => Math.abs((c.horizontal ? c.z : c.x) - r) < 2);
    const onCross = WORLD.roads.some((r) => Math.abs((c.horizontal ? c.x : c.z) - r) < 3);
    if (onCross && Math.random() < 0.012) {
      c.horizontal = !c.horizontal;
      c.road = c.horizontal ? c.z : c.x;
      const nd = Math.random() < 0.5 ? 1 : -1;
      c.dir = nd;
      c.speed = Math.abs(c.speed) * nd;
      c.heading = c.horizontal ? (nd > 0 ? Math.PI / 2 : -Math.PI / 2) : (nd > 0 ? 0 : Math.PI);
    }
    // Wrap around the city edge.
    if (c.x > 295) { c.x = -295; }
    if (c.x < -295) { c.x = 295; }
    if (c.z > 295) { c.z = -295; }
    if (c.z < -295) { c.z = 295; }
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt * 2.4;
  }
}

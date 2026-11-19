// VELVET TIDE — pedestrians: walk the sidewalks, chat, flee from gunfire
// and fast cars, and react when the player steals a car in front of them.
import { WORLD } from './config.js';
import { clamp, mulberry32, pick } from './util.js';

const SKINS = [0xe8b890, 0xc98a5a, 0x8a5a3a, 0xf0c8a0, 0x6a4a30];
const SHIRTS = [0xd05050, 0x3a7ad0, 0x3aa06a, 0xd0a030, 0x8a5ad0, 0x50b0b0, 0xe8e8e8, 0x30343a];

export function makePersonMesh(shirt, skin) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2a2f3a });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), skinMat);
  head.position.y = 1.62; head.castShadow = true; g.add(head);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), shirtMat);
  torso.position.y = 1.05; torso.castShadow = true; g.add(torso);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.38), pantsMat);
  legs.position.y = 0.38; g.add(legs);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), shirtMat);
  armL.position.set(-0.46, 1.05, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.46; g.add(armR);
  g.userData.armL = armL; g.userData.armR = armR;
  return g;
}

export function spawnPedestrians(scene, count, seed) {
  const rng = mulberry32(seed || 31);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = makePersonMesh(pick(rng, SHIRTS), pick(rng, SKINS));
    const road = pick(rng, WORLD.roads);
    const along = -280 + rng() * 560;
    const horizontal = rng() < 0.5;
    const x = horizontal ? along : road + (rng() < 0.5 ? 10 : -10);
    const z = horizontal ? road + (rng() < 0.5 ? 10 : -10) : along;
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh, x, z, heading: rng() * Math.PI * 2, speed: 1.2 + rng() * 1.1,
      horizontal, road, dir: rng() < 0.5 ? 1 : -1,
      flee: 0, walkPhase: rng() * 6, alive: true, isDriver: false, hp: 100,
    });
  }
  return peds;
}

export function updatePedestrians(G, dt) {
  const px = G.player.x, pz = G.player.z;
  for (const p of G.peds) {
    if (!p.alive) continue;
    const dPlayer = Math.hypot(p.x - px, p.z - pz);
    // Flee: gunfire nearby, or the player sprinting / driving at them.
    if (G.combatNoise > 0.1 && Math.hypot(p.x - G.combatNoiseX, p.z - G.combatNoiseZ) < 30) p.flee = 2.5;
    if (dPlayer < 4 && G.player.speed > 6) p.flee = 2;
    if (p.flee > 0) {
      p.flee -= dt;
      const away = Math.atan2(p.x - px, p.z - pz);
      p.heading = away;
      p.x += Math.sin(away) * 4.5 * dt;
      p.z += Math.cos(away) * 4.5 * dt;
    } else {
      // Stroll along the sidewalk, turn at intersections sometimes.
      const step = p.speed * dt;
      if (p.horizontal) p.x += step * p.dir;
      else p.z += step * p.dir;
      if (Math.random() < 0.004) {
        p.horizontal = !p.horizontal;
        p.dir = Math.random() < 0.5 ? 1 : -1;
      }
      p.heading = p.horizontal ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
      if (p.x > 292) p.x = -292; if (p.x < -292) p.x = 292;
      if (p.z > 292) p.z = -292; if (p.z < -292) p.z = 292;
    }
    p.walkPhase += dt * (p.flee > 0 ? 9 : 5);
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    const swing = Math.sin(p.walkPhase) * 0.45;
    p.mesh.userData.armL.rotation.x = swing;
    p.mesh.userData.armR.rotation.x = -swing;
  }
}

// A pedestrian near a theft shouts: witnesses raise the wanted level.
export function nearestShout(G) {
  for (const p of G.peds) {
    if (!p.alive) continue;
    if (Math.hypot(p.x - G.player.x, p.z - G.player.z) < 22) return true;
  }
  return false;
}

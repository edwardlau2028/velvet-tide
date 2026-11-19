// VELVET TIDE — combat: fists, pistol, armed thugs, health/armour/ammo
// pickups, tide coins and hit effects.
import { clamp, dist2d } from './util.js';
import { makePersonMesh } from './pedestrians.js';

export function tryPunch(G) {
  const p = G.player;
  if (p.firing > 0) return;
  p.firing = 0.35;
  G.audio.punch();
  const range = 2.6;
  const hit = (list, dmg, onKill) => {
    for (const t of list) {
      if (!t.alive) continue;
      const d = dist2d(t.x, t.z, p.x, p.z);
      if (d < range) {
        t.hp -= dmg;
        spawnBurst(G, t.x, 1.4, t.z, 0xffd23e);
        if (t.hp <= 0) { t.alive = false; t.mesh.visible = false; onKill(t); }
        return true;
      }
    }
    return false;
  };
  if (hit(G.thugs, 34, () => { G.mission.thugsDown++; G.hud.flashFeed('Thug down.'); })) return;
  if (hit(G.police.cops, 30, () => { G.police.addWanted(2, 'You dropped an officer!'); })) return;
  if (hit(G.peds, 40, () => { G.police.addWanted(1, 'Someone saw that!'); })) return;
}

export function tryShoot(G) {
  const p = G.player;
  if (p.ammo <= 0) { G.hud.flashFeed('Out of ammo — find an ammo box.'); G.audio.blip(120, 0.1, 'square', 0.1); return; }
  if (p.firing > 0) return;
  p.ammo -= 1; p.firing = 0.28;
  G.audio.shoot();
  G.combatNoise = 1; G.combatNoiseX = p.x; G.combatNoiseZ = p.z;
  const dir = p.heading;
  const shootAt = (list, dmg, onKill) => {
    let best = null, bd = 45;
    for (const t of list) {
      if (!t.alive) continue;
      const d = dist2d(t.x, t.z, p.x, p.z);
      if (d > bd) continue;
      const ang = Math.atan2(t.x - p.x, t.z - p.z);
      let diff = ang - dir;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.22) { best = t; bd = d; }
    }
    if (best) {
      best.hp -= dmg;
      spawnBurst(G, best.x, 1.4, best.z, 0xff5040);
      if (best.hp <= 0) { best.alive = false; best.mesh.visible = false; onKill(best); }
      return true;
    }
    return false;
  };
  if (shootAt(G.thugs, 34, () => { G.mission.thugsDown++; G.hud.flashFeed('Thug down.'); })) return;
  if (shootAt(G.police.cops, 30, () => { G.police.addWanted(2, 'You shot an officer!'); })) return;
  if (shootAt(G.peds, 100, () => { G.police.addWanted(1, 'A pedestrian is down!'); })) return;
  // Missed: a tracer puff in front of the player.
  spawnBurst(G, p.x + Math.sin(dir) * 6, 1.4, p.z + Math.cos(dir) * 6, 0xffe9a0);
}

export function spawnThugs(scene, x, z, count, armed) {
  const thugs = [];
  for (let i = 0; i < count; i++) {
    const mesh = makePersonMesh(0x30343a, 0xc98a5a);
    const tx = x + (Math.random() - 0.5) * 10, tz = z + (Math.random() - 0.5) * 10;
    mesh.position.set(tx, 0, tz);
    scene.add(mesh);
    thugs.push({ mesh, x: tx, z: tz, heading: 0, hp: 70, alive: true, armed: !!armed, shootCd: 1 + Math.random() });
  }
  return thugs;
}

export function updateThugs(G, dt) {
  for (const t of G.thugs) {
    if (!t.alive) continue;
    const d = dist2d(t.x, t.z, G.player.x, G.player.z);
    const target = Math.atan2(G.player.x - t.x, G.player.z - t.z);
    t.heading = target;
    if (d > 2.4) {
      const sp = t.armed ? 4.2 : 5.0;
      t.x += Math.sin(target) * sp * dt;
      t.z += Math.cos(target) * sp * dt;
    }
    t.mesh.position.set(t.x, 0, t.z);
    t.mesh.rotation.y = t.heading;
    t.shootCd -= dt;
    if (t.armed && d < 30 && t.shootCd <= 0) {
      t.shootCd = 1.6;
      G.hurtPlayer(8);
      G.audio.shoot();
    } else if (!t.armed && d < 2.4 && t.shootCd <= 0) {
      t.shootCd = 0.9;
      G.hurtPlayer(9);
      G.audio.punch();
    }
  }
}

export function damagePlayer(G, dmg) {
  const p = G.player;
  if (p.dead || G.state !== 'play') return;
  if (G.time - p.lastHurt < 0.25) return;
  p.lastHurt = G.time;
  let rest = dmg;
  if (p.armor > 0) { const absorbed = Math.min(p.armor, rest * 0.6); p.armor -= absorbed; rest -= absorbed; }
  p.health -= rest;
  document.getElementById('damage').style.opacity = clamp(1 - p.health / 60, 0.25, 1);
  setTimeout(() => { document.getElementById('damage').style.opacity = 0; }, 220);
  if (p.health <= 0) { p.health = 0; G.endGame('wasted'); }
}

export function spawnPickups(scene, G) {
  const defs = [
    { kind: 'health', x: 0, z: 225, color: 0xffffff },
    { kind: 'health', x: -112, z: -100, color: 0xffffff },
    { kind: 'armor', x: 188, z: -26, color: 0x7c5cff },
    { kind: 'armor', x: -38, z: 26, color: 0x7c5cff },
    { kind: 'ammo', x: 112, z: 100, color: 0xffd23e },
    { kind: 'ammo', x: -188, z: 176, color: 0xffd23e },
    { kind: 'health', x: 278, z: 138, color: 0xffffff },
    { kind: 'ammo', x: 38, z: -176, color: 0xffd23e },
  ];
  const out = [];
  for (const d of defs) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1),
      new THREE.MeshLambertMaterial({ color: d.color, emissive: d.color, emissiveIntensity: 0.35 }));
    mesh.position.set(d.x, 0.9, d.z);
    scene.add(mesh);
    out.push({ ...d, mesh, taken: false });
  }
  return out;
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (const u of G.pickups) {
    if (u.taken) continue;
    u.mesh.rotation.y += dt * 1.5;
    u.mesh.position.y = 0.9 + Math.sin(G.time * 2 + u.x) * 0.15;
    if (dist2d(u.x, u.z, p.x, p.z) < 2.2) {
      u.taken = true; u.mesh.visible = false;
      if (u.kind === 'health') { p.health = clamp(p.health + 50, 0, 100); G.hud.flashFeed('Health +50'); }
      if (u.kind === 'armor') { p.armor = clamp(p.armor + 50, 0, 100); G.hud.flashFeed('Armour +50'); }
      if (u.kind === 'ammo') { p.ammo += 24; G.hud.flashFeed('Ammo +24'); }
      G.audio.pickup();
    }
  }
  // Tide coins.
  for (let i = 0; i < G.coinMeshes.length; i++) {
    const m = G.coinMeshes[i];
    if (!m.visible) continue;
    m.rotation.y += dt * 2;
    if (dist2d(m.position.x, m.position.z, p.x, p.z) < 2.4) {
      m.visible = false;
      G.coinsFound.push(i);
      p.money += 200;
      G.hud.flashFeed('Tide coin found! +$200 (' + G.coinsFound.length + '/10)');
      G.audio.coin();
    }
  }
}

export function spawnBurst(G, x, y, z, color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  m.position.set(x, y, z);
  G.scene.add(m);
  G.effects.push({ mesh: m, life: 0.35, max: 0.35 });
}

export function updateEffects(G, dt) {
  for (const e of G.effects) {
    e.life -= dt;
    e.mesh.scale.setScalar(1 + (1 - e.life / e.max) * 2.5);
    e.mesh.material.opacity = Math.max(0, e.life / e.max);
    if (e.life <= 0) { G.scene.remove(e.mesh); G.effects.splice(G.effects.indexOf(e), 1); }
  }
}

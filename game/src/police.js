// VELVET TIDE — wanted level and the Solmar police response: cruisers that
// chase and ram, foot officers who close in, and roadblocks at 3+ stars.
import { POLICE_COLOR } from './config.js';
import { clamp, angleDiff, dist2d } from './util.js';
import { makeCarMesh } from './vehicles.js';
import { makePersonMesh } from './pedestrians.js';

const POLICE_MODEL = { name: 'SPD Cruiser', color: POLICE_COLOR, top: 33, accel: 22, grip: 1.1, len: 4.3 };

export class Police {
  constructor(G) {
    this.G = G;
    this.cars = []; this.cops = [];
    this.quietTimer = 0; this.bustedTimer = 0; this.spawnTimer = 0;
  }
  addWanted(n, reason) {
    const G = this.G;
    const before = G.wanted;
    G.wanted = clamp(G.wanted + n, 0, 5);
    if (G.wanted > before) {
      this.quietTimer = 0;
      G.hud.flashFeed(reason ? 'Wanted! ' + reason : 'Wanted level up!');
      if (G.wanted >= 3) G.audio.setSiren(true, G.time);
      // Instant first response: a cruiser (and a foot officer) is dispatched
      // at once; reinforcements keep trickling in through update().
      const want = this.wantedTarget();
      if (this.cars.length < want.cars) this.spawnCruiser();
      if (this.cops.length < want.cops && G.player.onFoot) this.spawnCop();
    }
  }
  clearWanted() {
    this.G.wanted = 0;
    this.G.audio.setSiren(false, this.G.time);
    this.despawnAll();
  }
  despawnAll() {
    for (const c of this.cars) { c.mesh.visible = false; }
    for (const c of this.cops) { c.mesh.visible = false; }
    this.cars = []; this.cops = [];
  }
  wantedTarget() {
    const w = this.G.wanted;
    if (w === 0) return { cars: 0, cops: 0 };
    if (w === 1) return { cars: 1, cops: 1 };
    if (w === 2) return { cars: 2, cops: 2 };
    if (w === 3) return { cars: 3, cops: 3 };
    if (w === 4) return { cars: 4, cops: 3 };
    return { cars: 5, cops: 4 };
  }
  spawnCruiser() {
    const G = this.G;
    const mesh = makeCarMesh(POLICE_MODEL, POLICE_COLOR, true);
    const a = Math.random() * Math.PI * 2;
    const x = clamp(G.player.x + Math.sin(a) * 85, -290, 290);
    const z = clamp(G.player.z + Math.cos(a) * 85, -290, 290);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    this.cars.push({ mesh, model: POLICE_MODEL, x, z, heading: 0, speed: 0, hp: 120, police: true });
  }
  spawnCop() {
    const G = this.G;
    const mesh = makePersonMesh(0x1c2a44, 0xe8b890);
    const a = Math.random() * Math.PI * 2;
    const x = clamp(G.player.x + Math.sin(a) * 30, -290, 290);
    const z = clamp(G.player.z + Math.cos(a) * 30, -290, 290);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    this.cops.push({ mesh, x, z, heading: 0, hp: 60, shootCd: 1, alive: true });
  }
  update(dt) {
    const G = this.G;
    if (G.state !== 'play') return;
    // Spawn to match the wanted level.
    this.spawnTimer -= dt;
    const want = this.wantedTarget();
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      if (this.cars.length < want.cars) this.spawnCruiser();
      if (this.cops.length < want.cops && G.player.onFoot) this.spawnCop();
    }
    // Wanted decays when no police can see the player.
    let nearest = 999;
    for (const c of this.cars) nearest = Math.min(nearest, dist2d(c.x, c.z, G.player.x, G.player.z));
    for (const c of this.cops) if (c.alive) nearest = Math.min(nearest, dist2d(c.x, c.z, G.player.x, G.player.z));
    if (G.wanted > 0 && nearest > 70) {
      this.quietTimer += dt;
      if (this.quietTimer > 14) {
        G.wanted -= 1; this.quietTimer = 0;
        G.hud.flashFeed('The heat is cooling off…');
        if (G.wanted === 0) { this.despawnAll(); G.audio.setSiren(false, G.time); }
      }
    } else this.quietTimer = 0;
    if (G.wanted > 0) G.audio.setSiren(true, G.time);
    else G.audio.setSiren(false, G.time);

    // Cruisers chase and ram (frozen while a screenshot is staged).
    const frozen = !!G.staged;
    for (const c of this.cars) {
      const dx = G.player.x - c.x, dz = G.player.z - c.z;
      const d = Math.hypot(dx, dz);
      if (!frozen) {
        const target = Math.atan2(dx, dz);
        c.heading += clamp(angleDiff(c.heading, target), -2.4 * dt, 2.4 * dt);
        const wantSpeed = G.wanted >= 4 ? 30 : G.wanted >= 2 ? 26 : 20;
        c.speed += (wantSpeed - c.speed) * dt * 0.8;
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt * 2.4;
      // Light bar flash.
      const bar = c.mesh.getObjectByName('lightbar');
      if (bar) bar.material.emissive.setHex(Math.floor(G.time * 3) % 2 === 0 ? 0xff2222 : 0x2244ff);
      if (d < 3.4) {
        // Ram: damage the player (or their car) and shove them.
        if (G.player.inCar && G.player.car) {
          G.player.car.hp -= 6 * dt * 10;
          G.player.car.speed *= 0.94;
        } else {
          G.hurtPlayer(14 * dt * 4);
        }
        c.speed *= 0.6;
      }
      if (d > 260) { c.mesh.visible = false; this.cars.splice(this.cars.indexOf(c), 1); }
    }
    // Foot officers close in, punch or shoot.
    for (const c of this.cops) {
      if (!c.alive) continue;
      const d = dist2d(c.x, c.z, G.player.x, G.player.z);
      const target = Math.atan2(G.player.x - c.x, G.player.z - c.z);
      c.heading = target;
      if (d > 2.2) {
        const sp = G.wanted >= 3 ? 6.2 : 4.6;
        c.x += Math.sin(target) * sp * dt;
        c.z += Math.cos(target) * sp * dt;
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      c.shootCd -= dt;
      if (d < 2.6) {
        // Busted: an officer grabs Mara on foot.
        if (G.player.onFoot) {
          this.bustedTimer += dt;
          if (this.bustedTimer > 1.2) { this.bustedTimer = 0; G.endGame('busted'); }
        }
      } else this.bustedTimer = Math.max(0, this.bustedTimer - dt);
      if (G.wanted >= 3 && d < 26 && c.shootCd <= 0) {
        c.shootCd = 1.4;
        G.hurtPlayer(7);
        G.hud.flashFeed('An officer is shooting at you!');
        G.audio.shoot();
      }
    }
  }
}

// VELVET TIDE — story missions: 8 jobs for fixer Silas Crane plus the
// finale harbour heist. A data-driven runner: goto, drive, steal, kill,
// collect, timed and escape steps, with dialogue, a beacon and rewards.
import { PLACES } from './config.js';
import { dist2d } from './util.js';
import { spawnThugs } from './combat.js';
import { makeCarMesh } from './vehicles.js';
import { CAR_MODELS } from './config.js';

const M = (id, title, reward, intro, steps) => ({ id, title, reward, intro, steps });

export const MISSIONS = [
  M('m1', 'First Fare', 300,
    [['Silas Crane', 'Mara. You owe the harbour, and I collect. First job is easy: come see me at the office, then run a fare to the Velvet Motel. No trouble, no heat.'],
     ['Mara Voss', 'Easy money. I am on my way.']],
    [{ type: 'goto', x: PLACES.craneOffice.x, z: PLACES.craneOffice.z, r: 6, label: 'Meet Silas Crane at his office' },
     { type: 'driveTo', x: PLACES.motel.x, z: PLACES.motel.z, r: 8, label: 'Drive the fare to the Velvet Motel' }]),
  M('m2', 'Hot Wheels', 500,
    [['Silas Crane', 'A client wants an Osprey GT, cherry red, no questions. One is parked by the Voss Garage. Take it. If anyone sees you, that is your problem.']],
    [{ type: 'goto', x: PLACES.garage.x, z: PLACES.garage.z, r: 8, label: 'Go to the Voss Garage' },
     { type: 'enterCar', label: 'Steal the red Osprey GT (press E beside it)' },
     { type: 'driveTo', x: PLACES.harbour.x, z: PLACES.harbour.z, r: 10, label: 'Deliver the Osprey to Harbour Pier 4' }]),
  M('m3', 'The Drop', 450,
    [['Silas Crane', 'A package is waiting at the Old Quarter market. Take it to Coral Beach. The Gulls have ears on the beach, so expect company.'],
     ['Mara Voss', 'Company I can handle.']],
    [{ type: 'goto', x: PLACES.market.x, z: PLACES.market.z, r: 6, label: 'Pick up the package at the market' },
     { type: 'collect', x: PLACES.beach.x, z: PLACES.beach.z, r: 6, label: 'Deliver the package at Coral Beach', spawn: { x: PLACES.beach.x, z: PLACES.beach.z, n: 2, armed: false } },
     { type: 'kill', n: 2, label: 'Deal with the Gull lookouts (2)' }]),
  M('m4', 'Harbour Run', 600,
    [['Silas Crane', 'The harbour gates close in two minutes and a crate needs to be on Pier 4. Drive the checkpoints, Mara. Fast.']],
    [{ type: 'timed', x: 150, z: 150, r: 9, secs: 45, label: 'Checkpoint 1: Glass District corner' },
     { type: 'timed', x: 225, z: -75, r: 9, secs: 45, label: 'Checkpoint 2: north harbour road' },
     { type: 'timed', x: PLACES.harbour.x, z: PLACES.harbour.z, r: 10, secs: 50, label: 'Final checkpoint: Harbour Pier 4' }]),
  M('m5', 'Silent Alarm', 800,
    [['Silas Crane', 'Solmar Mutual keeps a little cash in the back. Walk in, take it, walk out — and then lose the cops. The whole city will be looking.']],
    [{ type: 'goto', x: PLACES.bank.x, z: PLACES.bank.z, r: 6, label: 'Enter Solmar Mutual Bank', wanted: 2 },
     { type: 'escape', label: 'Lose the police (wanted level to 0)' },
     { type: 'driveTo', x: PLACES.craneOffice.x, z: PLACES.craneOffice.z, r: 8, label: 'Bring the cash to Silas Crane' }]),
  M('m6', 'Rescue Run', 750,
    [['Silas Crane', 'Our driver Kade is pinned down at the Neon Strip plaza by Gull guns. Get him out and bring him to St. Anselm. Do not be gentle with them.']],
    [{ type: 'goto', x: PLACES.arena.x, z: PLACES.arena.z, r: 8, label: 'Reach the Neon Strip plaza', spawn: { x: PLACES.arena.x, z: PLACES.arena.z, n: 3, armed: true } },
     { type: 'kill', n: 3, label: 'Clear the Gull shooters (3)' },
     { type: 'driveTo', x: PLACES.hospital.x, z: PLACES.hospital.z, r: 9, label: 'Drive Kade to St. Anselm Hospital' }]),
  M('m7', 'The Exchange', 1000,
    [['Silas Crane', 'A briefcase changes hands at the Tide Lighthouse tonight. The Gulls want it too. Take it, keep it, bring it to the garage.']],
    [{ type: 'driveTo', x: PLACES.lighthouse.x + 14, z: PLACES.lighthouse.z, r: 9, label: 'Drive to the Tide Lighthouse', spawn: { x: PLACES.lighthouse.x + 14, z: PLACES.lighthouse.z, n: 4, armed: true } },
     { type: 'kill', n: 4, label: 'Clear the lighthouse ambush (4)' },
     { type: 'collect', x: PLACES.lighthouse.x + 14, z: PLACES.lighthouse.z, r: 6, label: 'Take the briefcase' },
     { type: 'driveTo', x: PLACES.garage.x, z: PLACES.garage.z, r: 8, label: 'Deliver the briefcase to the Voss Garage' }]),
  M('m8', 'Tide Rising', 1200,
    [['Silas Crane', 'One more run before the big one. A shipment at the motel, a buyer at the harbour. The tide is coming in, Mara. So are we.']],
    [{ type: 'goto', x: PLACES.motel.x, z: PLACES.motel.z, r: 6, label: 'Pick up the shipment at the Velvet Motel' },
     { type: 'driveTo', x: PLACES.harbour.x, z: PLACES.harbour.z, r: 10, label: 'Deliver to the harbour buyer' },
     { type: 'kill', n: 3, label: 'The buyer brought friends — clear them (3)', spawn: { x: PLACES.harbour.x, z: PLACES.harbour.z, n: 3, armed: true } }]),
  M('m9', 'Velvet Tide', 2500,
    [['Silas Crane', 'Tonight, Mara. Solmar Mutual, the vault, the tide boat at Pier 4. Four stars of heat, one clean getaway. Do this and the harbour forgets your name.'],
     ['Mara Voss', 'Then let us make it a night Solmar remembers.']],
    [{ type: 'goto', x: PLACES.bank.x, z: PLACES.bank.z, r: 6, label: 'Hit Solmar Mutual Bank', wanted: 4 },
     { type: 'collect', x: PLACES.bank.x, z: PLACES.bank.z, r: 6, label: 'Grab the vault cash' },
     { type: 'driveTo', x: PLACES.harbour.x, z: PLACES.harbour.z, r: 10, label: 'Escape to the tide boat at Pier 4' },
     { type: 'escape', label: 'Lose the police — the tide is yours' }]),
];

export class MissionRunner {
  constructor(G) {
    this.G = G;
    this.index = 0; this.stepIndex = 0; this.active = false;
    this.thugsDown = 0; this.timer = 0; this.targetCar = null;
    this.introShown = false; this.done = false;
  }
  current() { return MISSIONS[this.index] || null; }
  step() { const m = this.current(); return m ? m.steps[this.stepIndex] : null; }
  start() {
    const m = this.current();
    if (!m || this.active) return;
    this.active = true; this.stepIndex = 0; this.thugsDown = 0;
    this.clearThugs();
    this.G.hud.showDialogue(m.intro, () => this.beginStep());
    this.G.hud.setMission(m.title, m.steps[0].label);
  }
  beginStep() {
    const s = this.step();
    if (!s) return;
    this.timer = s.secs || 0;
    if (s.spawn) this.armFight(s.spawn);
    if (s.type === 'enterCar') this.parkTargetCar();
    const m = this.current();
    this.G.hud.setMission(m.title, s.label);
    this.updateBeacon();
  }
  parkTargetCar() {
    const G = this.G;
    const model = CAR_MODELS.find((c) => c.name === 'Osprey GT');
    const mesh = makeCarMesh(model, 0xff4f6d, false);
    const x = PLACES.garage.x - 12, z = PLACES.garage.z + 6;
    mesh.position.set(x, 0, z); mesh.rotation.y = Math.PI / 2;
    G.scene.add(mesh);
    this.targetCar = { mesh, model, x, z, heading: Math.PI / 2, speed: 0, parked: true, traffic: false, stolen: false, hp: 100, missionCar: true };
    G.cars.push(this.targetCar);
  }
  armFight(spawn) {
    this.clearThugs();
    this.G.thugs = spawnThugs(this.G.scene, spawn.x, spawn.z, spawn.n, spawn.armed);
    this.thugsDown = 0;
  }
  clearThugs() {
    for (const t of this.G.thugs) { t.mesh.visible = false; t.alive = false; }
    this.G.thugs = [];
  }
  updateBeacon() {
    const s = this.step();
    const b = this.G.city.beacon;
    if (!s || !this.active || s.x === undefined) { b.visible = false; return; }
    b.visible = true;
    b.position.set(s.x, 0, s.z);
  }
  update(dt) {
    if (!this.active || this.G.state !== 'play' || this.G.dialogueOpen) return;
    const G = this.G;
    const s = this.step();
    if (!s) return;
    if (s.type === 'timed') {
      this.timer -= dt;
      G.hud.setTimer(Math.max(0, this.timer));
      if (this.timer <= 0) { this.fail('Too slow — the harbour gates closed.'); return; }
    } else G.hud.setTimer(0);
    const p = G.player;
    if (s.type === 'goto' || s.type === 'collect' || s.type === 'driveTo' || s.type === 'timed') {
      if (dist2d(p.x, p.z, s.x, s.z) < s.r) {
        if (s.wanted) G.police.addWanted(s.wanted, 'The alarm is tripped!');
        this.completeStep();
      }
    } else if (s.type === 'enterCar') {
      if (p.inCar && p.car === this.targetCar) {
        G.police.addWanted(1, 'Someone saw you steal that Osprey!');
        G.stats.carsStolen++;
        this.completeStep();
      }
    } else if (s.type === 'kill') {
      if (this.thugsDown >= s.n) this.completeStep();
    } else if (s.type === 'escape') {
      if (G.wanted === 0) this.completeStep();
    }
    // Beacon gem spins.
    const gem = G.city.beacon.getObjectByName('gem');
    if (gem) gem.rotation.y += dt * 2;
  }
  completeStep() {
    const G = this.G;
    G.audio.pickup();
    this.stepIndex++;
    const m = this.current();
    if (this.stepIndex >= m.steps.length) { this.finishMission(); return; }
    this.beginStep();
  }
  fail(reason) {
    const G = this.G;
    G.hud.flashFeed('Mission failed: ' + reason);
    G.audio.busted();
    this.active = false;
    this.clearThugs();
    G.city.beacon.visible = false;
    G.hud.setMission(this.current().title, 'Failed — walk to the marker to retry');
    // Retry: restart the same mission after a short pause.
    setTimeout(() => { if (G.state === 'play') this.start(); }, 2500);
  }
  finishMission() {
    const G = this.G;
    const m = this.current();
    G.player.money += m.reward;
    G.player.respect += 10;
    G.stats.missionsDone++;
    G.hud.flashFeed('Mission complete: ' + m.title + ' +$' + m.reward);
    G.audio.jingle();
    this.active = false;
    this.clearThugs();
    G.city.beacon.visible = false;
    G.save.save();
    if (this.index >= MISSIONS.length - 1) {
      this.done = true;
      G.hud.setMission('VELVET TIDE', 'Story complete — Solmar is yours. Free roam!');
      G.hud.showDialogue([['Silas Crane', 'It is done, Mara. The tide took the heat, the boat took the cash, and Solmar forgot your name. You are free.'],
        ['Mara Voss', 'Free. I think I will stay a while — this city still owes me a sunset.']], () => {});
      return;
    }
    this.index++;
    G.hud.setMission('Next job', 'Silas Crane will call soon…');
    setTimeout(() => { if (G.state === 'play') this.start(); }, 3000);
  }
}

// VELVET TIDE — HUD: wanted stars, cash, clock, health/armour, speedometer,
// mission box, live minimap, feed messages and the dialogue box.
import { WORLD } from './config.js';
import { formatClock, formatMoney, clamp } from './util.js';

export class Hud {
  constructor(G) {
    this.G = G;
    this.el = {
      hud: document.getElementById('hud'),
      stars: document.getElementById('stars'),
      money: document.getElementById('money'),
      clock: document.getElementById('clock'),
      healthBar: document.getElementById('healthBar'),
      armorBar: document.getElementById('armorBar'),
      respect: document.getElementById('respect'),
      missionTitle: document.getElementById('missionTitle'),
      missionText: document.getElementById('missionText'),
      missionTimer: document.getElementById('missionTimer'),
      minimap: document.getElementById('minimap'),
      speedo: document.getElementById('speedo'),
      speedNum: document.getElementById('speedNum'),
      carName: document.getElementById('carName'),
      feed: document.getElementById('feed'),
      crosshair: document.getElementById('crosshair'),
      dialogue: document.getElementById('dialogue'),
      dialogueName: document.getElementById('dialogueName'),
      dialogueText: document.getElementById('dialogueText'),
    };
    this.feedLines = [];
    this.dialogueLines = [];
    this.dialogueCb = null;
  }
  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }
  setMission(title, text) {
    this.el.missionTitle.textContent = title;
    this.el.missionText.textContent = text;
  }
  setTimer(secs) {
    this.el.missionTimer.textContent = secs > 0 ? '⏱ ' + secs.toFixed(0) + 's left' : '';
  }
  flashFeed(text) {
    this.feedLines.push(text);
    if (this.feedLines.length > 3) this.feedLines.shift();
    this.el.feed.innerHTML = this.feedLines.map((t) => '<div>' + t + '</div>').join('');
    clearTimeout(this._feedT);
    this._feedT = setTimeout(() => { this.feedLines = []; this.el.feed.innerHTML = ''; }, 5200);
  }
  showDialogue(lines, cb) {
    this.dialogueLines = lines.slice();
    this.dialogueCb = cb || null;
    this.G.dialogueOpen = true;
    this.advanceDialogue();
  }
  advanceDialogue() {
    if (this.dialogueLines.length === 0) {
      this.el.dialogue.classList.add('hidden');
      this.G.dialogueOpen = false;
      const cb = this.dialogueCb; this.dialogueCb = null;
      if (cb) cb();
      return;
    }
    const [name, text] = this.dialogueLines.shift();
    this.el.dialogueName.textContent = name;
    this.el.dialogueText.textContent = text;
    this.el.dialogue.classList.remove('hidden');
  }
  hideDialogue() { this.advanceDialogue(); }
  districtName(x, z) {
    let best = null, bd = 1e9;
    for (const d of this.G.city.districts) {
      const dd = Math.hypot(x - d.x, z - d.z) - d.r;
      if (dd < bd) { bd = dd; best = d; }
    }
    return best ? best.name : 'Solmar';
  }
  update() {
    const G = this.G;
    const p = G.player;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += '<span class="' + (i < G.wanted ? 'on' : 'off') + '">★</span>';
    this.el.stars.innerHTML = stars;
    this.el.money.textContent = formatMoney(p.money);
    this.el.clock.textContent = formatClock(G.clock) + ' · ' + this.districtName(p.x, p.z);
    this.el.healthBar.style.width = clamp(p.health, 0, 100) + '%';
    this.el.armorBar.style.width = clamp(p.armor, 0, 100) + '%';
    this.el.respect.textContent = 'Respect ' + p.respect + ' · Ammo ' + p.ammo + ' · Coins ' + G.coinsFound.length + '/10';
    if (p.inCar && p.car) {
      this.el.speedo.classList.remove('hidden');
      this.el.speedNum.textContent = Math.round(p.speed);
      this.el.carName.textContent = p.car.model.name + (p.car.hp < 40 ? ' — smoking!' : '');
      this.el.crosshair.classList.add('hidden');
    } else {
      this.el.speedo.classList.add('hidden');
      this.el.crosshair.classList.remove('hidden');
    }
    this.drawMinimap();
  }
  drawMinimap() {
    const G = this.G;
    const cv = this.el.minimap;
    const g = cv.getContext('2d');
    const S = 200, half = WORLD.half + 40;
    const toMap = (x, z) => [(x + half) / (half * 2) * S, (z + half) / (half * 2) * S];
    g.fillStyle = '#0e2a33'; g.fillRect(0, 0, S, S);
    // Sea and beach.
    g.fillStyle = '#1f6f92'; g.fillRect(0, 0, toMap(WORLD.seaX, 0)[0], S);
    g.fillStyle = '#d9c08a'; g.fillRect(toMap(WORLD.seaX, 0)[0], 0, toMap(WORLD.beachX, 0)[0] - toMap(WORLD.seaX, 0)[0], S);
    // Harbour apron.
    g.fillStyle = '#5a5f66'; g.fillRect(toMap(WORLD.harbourX, 0)[0], 0, S - toMap(WORLD.harbourX, 0)[0], S);
    // Roads.
    g.strokeStyle = '#3a4048'; g.lineWidth = 5;
    for (const r of WORLD.roads) {
      const [ax] = toMap(r, 0); const [, az] = toMap(0, r);
      g.beginPath(); g.moveTo(ax, 0); g.lineTo(ax, S); g.stroke();
      g.beginPath(); g.moveTo(0, az); g.lineTo(S, az); g.stroke();
    }
    // Buildings as faint blocks.
    g.fillStyle = 'rgba(255,255,255,0.16)';
    for (const b of G.city.colliders) {
      const [x1, z1] = toMap(b.minX, b.minZ);
      const [x2, z2] = toMap(b.maxX, b.maxZ);
      g.fillRect(x1, z1, x2 - x1, z2 - z1);
    }
    const dot = (x, z, color, r) => {
      const [mx, mz] = toMap(x, z);
      g.fillStyle = color; g.beginPath(); g.arc(mx, mz, r, 0, Math.PI * 2); g.fill();
    };
    // Coins, cars, police, mission marker.
    for (const m of G.coinMeshes) if (m.visible) dot(m.position.x, m.position.z, '#ffd23e', 2);
    for (const c of G.cars) if (!c.traffic) dot(c.x, c.z, '#ffffff', 2);
    for (const c of G.police.cars) dot(c.x, c.z, '#4f8cff', 3);
    for (const c of G.police.cops) if (c.alive) dot(c.x, c.z, '#ff5040', 2.5);
    for (const t of G.thugs) if (t.alive) dot(t.x, t.z, '#ff5040', 2.5);
    const s = G.mission.step();
    if (G.mission.active && s && s.x !== undefined) {
      const [mx, mz] = toMap(s.x, s.z);
      g.fillStyle = '#ffd23e';
      g.save(); g.translate(mx, mz); g.rotate(Math.PI / 4);
      g.fillRect(-5, -5, 10, 10); g.restore();
    }
    // Player arrow (map y is world z, arrow art points up).
    const [px, pz] = toMap(G.player.x, G.player.z);
    g.save(); g.translate(px, pz); g.rotate(Math.PI - G.player.heading);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.restore();
  }
}

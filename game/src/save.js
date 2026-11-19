// VELVET TIDE — save / load through localStorage (this computer only).
export class SaveSys {
  constructor(G) { this.G = G; this.key = 'velvet-tide-save-v1'; }
  hasSave() {
    try { return !!localStorage.getItem(this.key); } catch { return false; }
  }
  save() {
    const G = this.G;
    const data = {
      money: Math.round(G.player.money), respect: G.player.respect,
      missionIndex: G.mission.index, coins: G.coinsFound.slice(),
      health: Math.round(G.player.health), armor: Math.round(G.player.armor),
      ammo: G.player.ammo, x: G.player.x, z: G.player.z, heading: G.player.heading,
      clock: Math.round(G.clock), carsStolen: G.stats.carsStolen,
      missionsDone: G.stats.missionsDone, savedAt: Date.now(),
    };
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
      G.hud.flashFeed('Game saved.');
      return true;
    } catch { G.hud.flashFeed('Save failed — storage unavailable.'); return false; }
  }
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }
  apply(data) {
    const G = this.G;
    if (!data) return false;
    G.player.money = data.money ?? 300;
    G.player.respect = data.respect ?? 0;
    G.player.health = data.health ?? 100;
    G.player.armor = data.armor ?? 0;
    G.player.ammo = data.ammo ?? 60;
    G.player.x = data.x ?? 0; G.player.z = data.z ?? 120;
    G.player.heading = data.heading ?? 0;
    G.clock = data.clock ?? 1120;
    G.stats.carsStolen = data.carsStolen ?? 0;
    G.stats.missionsDone = data.missionsDone ?? 0;
    G.mission.index = data.missionIndex ?? 0;
    G.coinsFound = (data.coins ?? []).slice();
    return true;
  }
}

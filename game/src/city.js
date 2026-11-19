// VELVET TIDE — builds Solmar: road grid, districts, beach, sea, harbour,
// lighthouse, palms, lamps and the hidden tide-coin spots. All original.
import { WORLD, DISTRICTS, PLACES } from './config.js';
import { mulberry32, pick } from './util.js';

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#d8dee6'; g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 22) {
    for (let x = 10; x < 118; x += 20) {
      const lit = Math.random() < 0.42;
      g.fillStyle = lit ? '#ffe9a0' : '#5a6a7a';
      g.fillRect(x, y, 12, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene) {
  const rng = mulberry32(7);
  const colliders = [];
  const coinSpots = [];
  const group = new THREE.Group();
  scene.add(group);
  const tex = windowTexture();
  const matCache = new Map();
  function mat(color, opts) {
    const key = color + JSON.stringify(opts || {});
    if (!matCache.has(key)) {
      matCache.set(key, new THREE.MeshLambertMaterial({ color, ...(opts || {}) }));
    }
    return matCache.get(key);
  }
  function box(w, h, d, color, x, y, z, opts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
    m.position.set(x, y, z);
    group.add(m);
    return m;
  }
  function addCollider(cx, cz, hw, hd) {
    colliders.push({ minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd });
  }

  // Ground base (city floor), beach sand and sea.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(680, 680),
    mat(0x3d5a43));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0);
  group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(48, 620), mat(0xd9c08a));
  sand.rotation.x = -Math.PI / 2; sand.position.set(-276, 0.03, 0);
  group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(90, 680),
    new THREE.MeshLambertMaterial({ color: 0x1f6f92 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-335, 0.08, 0);
  group.add(sea);
  // Harbour apron (east).
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(76, 620), mat(0x5a5f66));
  apron.rotation.x = -Math.PI / 2; apron.position.set(282, 0.03, 0);
  group.add(apron);

  // Roads: sidewalk strip, asphalt with a dashed centre line baked into
  // one repeating texture (far cheaper than hundreds of dash meshes).
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 256; roadCanvas.height = 64;
  const rg = roadCanvas.getContext('2d');
  rg.fillStyle = '#34383f'; rg.fillRect(0, 0, 256, 64);
  rg.fillStyle = '#f0f0e0';
  for (let x = 0; x < 256; x += 42) rg.fillRect(x, 30, 20, 4);
  const roadTex = new THREE.CanvasTexture(roadCanvas);
  roadTex.wrapS = THREE.RepeatWrapping; roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(14, 1);
  roadTex.colorSpace = THREE.SRGBColorSpace;
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const r of WORLD.roads) {
    for (const horizontal of [true, false]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(600, 22), mat(0x7a7f82));
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(0, 0.02, 0);
      if (horizontal) { walk.position.x = 0; walk.position.z = r; }
      else { walk.rotation.z = Math.PI / 2; walk.position.x = r; walk.position.z = 0; }
      group.add(walk);
      const road = new THREE.Mesh(new THREE.PlaneGeometry(600, WORLD.roadWidth), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.04, 0);
      if (horizontal) road.position.z = r;
      else { road.rotation.z = Math.PI / 2; road.position.x = r; }
      group.add(road);
    }
  }

  // Buildings, one or two per block, height by district.
  const palette = [0xa08a6a, 0x7a9ab0, 0xb09a7a, 0x8a7aa0, 0x9a8ab0, 0x6a8a9a, 0xc09a6a, 0x5a7a8a];
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc8e8, emissive: 0x2a4a66 });
  for (let ix = 0; ix < WORLD.roads.length - 1; ix++) {
    for (let iz = 0; iz < WORLD.roads.length - 1; iz++) {
      const x0 = WORLD.roads[ix] + 11, x1 = WORLD.roads[ix + 1] - 11;
      const z0 = WORLD.roads[iz] + 11, z1 = WORLD.roads[iz + 1] - 11;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const w = x1 - x0, d = z1 - z0;
      // Park in the north-centre block, plaza on the Neon Strip.
      if (Math.abs(cx - 38) < 5 && Math.abs(cz + 188) < 5) continue;
      if (Math.abs(cx) < 5 && Math.abs(cz) < 5) continue;
      const tall = cx > 100;
      const h = tall ? 28 + rng() * 42 : (cx > -40 && cx < 40 && cz > -40 && cz < 40)
        ? 12 + rng() * 18 : 6 + rng() * 10;
      const color = pick(rng, palette);
      const useGlass = tall && rng() < 0.5;
      const bmat = useGlass ? glass : new THREE.MeshLambertMaterial({ color, map: tex });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, h, d * 0.72), bmat);
      b.position.set(cx, h / 2, cz);
      group.add(b);
      addCollider(cx, cz, (w * 0.72) / 2, (d * 0.72) / 2);
      // Rooftop box for silhouette variety.
      if (rng() < 0.5) {
        const r2 = box(w * 0.3, 2.5, d * 0.3, 0x333a42, cx + w * 0.12, h + 1.25, cz - d * 0.1);
        r2.castShadow = false;
      }
      // A second low shop on big blocks.
      if (rng() < 0.45) {
        const sx = cx + w * 0.28, sz = cz + d * 0.26;
        const sh = 4 + rng() * 3;
        box(w * 0.24, sh, d * 0.24, pick(rng, palette), sx, sh / 2, sz, { map: tex });
        addCollider(sx, sz, (w * 0.24) / 2, (d * 0.24) / 2);
      }
    }
  }

  // Neon Strip plaza (centre) with a fountain ring.
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 0.4, 24), mat(0x8a8f96));
  plaza.position.set(0, 0.2, 0); group.add(plaza);
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 1.2, 16),
    new THREE.MeshLambertMaterial({ color: 0x3a9ab8, emissive: 0x0a3a4a }));
  fountain.position.set(0, 0.8, 0); group.add(fountain);

  // Hillcrest park: trees and a pond.
  for (let i = 0; i < 14; i++) {
    const tx = 8 + rng() * 60, tz = -218 + rng() * 60;
    const trunk = box(0.7, 2.4, 0.7, 0x6a4a2a, tx, 1.2, tz);
    trunk.castShadow = false;
    const top = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6), mat(0x3a7a3a));
    top.position.set(tx, 4.2, tz); group.add(top);
  }
  const pond = new THREE.Mesh(new THREE.CircleGeometry(12, 20),
    new THREE.MeshLambertMaterial({ color: 0x2a7fa8 }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(38, 0.05, -188); group.add(pond);

  // Lighthouse at the south-west point, with a light cone.
  const lh = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.2, 26, 12),
    new THREE.MeshLambertMaterial({ color: 0xe8e0d0 }));
  lh.position.set(-282, 13, -252); group.add(lh);
  const lhTop = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 3, 12),
    new THREE.MeshLambertMaterial({ color: 0x222222, emissive: 0xffe9a0 }));
  lhTop.position.set(-282, 27, -252); group.add(lhTop);
  addCollider(-282, -252, 4.5, 4.5);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(9, 40, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.14, side: THREE.DoubleSide }));
  beam.rotation.z = Math.PI / 2; beam.position.set(-262, 27, -252); group.add(beam);

  // Harbour: containers and two cranes.
  const contColors = [0xb5502e, 0x2e7ab5, 0x3a9a5a, 0xd0a030];
  for (let i = 0; i < 16; i++) {
    const cx = 268 + (i % 4) * 14, cz = -160 + Math.floor(i / 4) * 16 + (i % 2) * 4;
    const ch = 3 + (i % 2);
    box(11, ch, 5, contColors[i % 4], cx, ch / 2, cz);
    addCollider(cx, cz, 5.5, 2.5);
  }
  for (const cz of [-40, 120]) {
    box(4, 26, 4, 0xd0a030, 272, 13, cz);
    box(26, 3, 3, 0xd0a030, 262, 25, cz);
    addCollider(272, cz, 2, 2);
  }
  // Pier planks into the sea at the harbour.
  box(40, 0.6, 8, 0x7a5a3a, 300, 0.4, 150);

  // Palms along the beach and the Neon Strip.
  const palmTrunk = mat(0x7a5a34);
  const palmTop = mat(0x2a8a4a);
  function palm(x, z) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), palmTrunk);
    t.position.set(x, 3.5, z); group.add(t);
    const c = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.4, 7), palmTop);
    c.position.set(x, 8.2, z); group.add(c);
  }
  for (let z = -260; z <= 260; z += 26) { palm(-246, z); palm(-258, z + 13); }
  for (let x = -200; x <= 200; x += 40) { palm(x, 8); palm(x + 20, -8); }

  // Street lamps on every other intersection.
  for (const rx of WORLD.roads) {
    for (const rz of WORLD.roads) {
      if ((rx + rz) % 150 !== 0) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 7, 6), mat(0x222831));
      pole.position.set(rx + 9, 3.5, rz + 9); group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
      lamp.position.set(rx + 9, 7.2, rz + 9); group.add(lamp);
    }
  }

  // Tide coins: 10 hidden spots (beach, park, plaza, harbour, rooftops' bases).
  const coinDefs = [
    [-272, 210], [-260, -180], [38, -188], [0, 0], [278, 150],
    [-112, -112], [112, 112], [188, -38], [-188, 188], [225, 225],
  ];
  for (const [x, z] of coinDefs) coinSpots.push({ x, z });

  // Mission beacon: a glowing pillar + floating diamond, moved by missions.js.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x7c5cff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  pillar.position.y = 30; beacon.add(pillar);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.4),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  gem.position.y = 9; gem.name = 'gem'; beacon.add(gem);
  beacon.visible = false;
  scene.add(beacon);

  return { group, colliders, coinSpots, beacon, districts: DISTRICTS, places: PLACES };
}

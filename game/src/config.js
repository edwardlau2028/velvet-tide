// VELVET TIDE — tuning, car models, districts and named places in Solmar.
// All names, places and vehicles are invented for this game.
export const WORLD = {
  half: 300,            // city spans -300..300 on x and z
  roadWidth: 16,
  roads: [-225, -150, -75, 0, 75, 150, 225], // grid road centrelines
  beachX: -252,         // sand starts west of here
  seaX: -292,           // water plane starts here
  harbourX: 262,        // docks start east of here
  startX: 0, startZ: 120,
};
export const PLAYER = {
  walkSpeed: 5.2, sprintSpeed: 9.5, radius: 0.9,
  maxHealth: 100, maxArmor: 100, startMoney: 300, startAmmo: 60,
};
export const CAR_MODELS = [
  { name: 'Comet Hatch',  color: 0xe8b13c, top: 26, accel: 16, grip: 1.0, len: 3.6 },
  { name: 'Vela Sedan',   color: 0x3f7fd0, top: 30, accel: 18, grip: 1.0, len: 4.2 },
  { name: 'Bison Pickup', color: 0xb5502e, top: 27, accel: 15, grip: 0.95, len: 4.6 },
  { name: 'Lumen Coupe',  color: 0x9b4fd0, top: 34, accel: 21, grip: 1.05, len: 4.0 },
  { name: 'Atlas Van',    color: 0x5a6b74, top: 24, accel: 13, grip: 0.9, len: 4.8 },
  { name: 'Strada Taxi',  color: 0xf2c230, top: 29, accel: 17, grip: 1.0, len: 4.2, taxi: true },
  { name: 'Osprey GT',    color: 0xff4f6d, top: 40, accel: 26, grip: 1.15, len: 4.1 },
];
export const POLICE_COLOR = 0x1c2a44;
export const DISTRICTS = [
  { name: 'Marina Row', x: -260, z: -40, r: 70 },
  { name: 'Old Quarter', x: -110, z: 60, r: 90 },
  { name: 'Neon Strip', x: 0, z: -10, r: 100 },
  { name: 'Glass District', x: 150, z: -80, r: 90 },
  { name: 'Harbour', x: 275, z: 120, r: 60 },
  { name: 'Hillcrest', x: 60, z: -230, r: 80 },
  { name: 'Coral Beach', x: -275, z: 180, r: 70 },
];
export const PLACES = {
  craneOffice: { x: -38, z: 38, label: "Silas Crane's office" },
  garage: { x: 188, z: -38, label: 'Voss Garage' },
  harbour: { x: 278, z: 150, label: 'Harbour Pier 4' },
  market: { x: -112, z: -112, label: 'Old Quarter market' },
  bank: { x: 112, z: 112, label: 'Solmar Mutual Bank' },
  beach: { x: -272, z: 210, label: 'Coral Beach' },
  lighthouse: { x: -282, z: -252, label: 'Tide Lighthouse' },
  arena: { x: 38, z: -188, label: 'Neon Strip plaza' },
  hospital: { x: 0, z: 225, label: 'St. Anselm Hospital' },
  motel: { x: -188, z: 188, label: 'Velvet Motel' },
};
export const RADIO_STATIONS = [
  { name: 'TIDE FM', scale: [0, 3, 5, 7, 10], bpm: 96, wave: 'sawtooth', bass: 55 },
  { name: 'NEON 88', scale: [0, 2, 5, 7, 9], bpm: 122, wave: 'square', bass: 65 },
  { name: 'VELVET SOUL', scale: [0, 3, 5, 8, 10], bpm: 76, wave: 'triangle', bass: 50 },
];

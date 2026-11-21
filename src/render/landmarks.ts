// Re-export barrel for all Beijing 1989 landmarks and iconic structures.
export const L = {
  red: 0x8e2b22,
  redDark: 0x6e2019,
  yellowTile: 0xc99a2e,
  greyTile: 0x4a4e52,
  marble: 0xd9d6cc,
  beam: 0x2f5a58,
  beamBlue: 0x2b4870,
  gold: 0xc8a040,
  door: 0x7a221a,
  stone: 0x8d8a82,
  arch: 0x1a1210,
};

export {
  imperialRoof as roof,
  tiananmen,
  monument,
  greatHall,
  huadengPole,
  huadengGlobes,
} from './imperial';

export {
  pkuWestGate,
  campusSceneArchitecture,
  democracyStatue,
  campTent,
  broadcastStation,
} from './campusArch';

export { trolleybus, trolleyWindows } from './props';

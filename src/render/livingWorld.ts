import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SharedTexPool } from './materials';
import type { AtmospherePreset, SceneId } from '../types';

export interface LivingWorldHandle {
  update(dt: number, t: number, playerX: number, playerZ: number): void;
  getWhisper(t: number): { speaker: string; text: string } | null;
  dispose(): void;
}

const SCENE_WHISPERS: Partial<Record<SceneId, ReadonlyArray<{ speaker: string; text: string }>>> = {
  campus: [
    { speaker: '宿舍樓下男生', text: '三角地剛貼了新抄報，這會兒還不少人舉手電在讀。' },
    { speaker: '抱書經過的女同學', text: '晚風有點涼，明早記得帶隻水壺再出校門。' },
  ],
  street: [
    { speaker: '副食店門邊街坊', text: '國營菜站下午那撥新蒜苔剛卸車，排隊轉兩圈就賣淨了。' },
    { speaker: '騎車路過的鄰居', text: '前面路口車流放慢了，拐進胡同走近道吧。' },
  ],
  hutong: [
    { speaker: '院口納涼大爺', text: '晚上九點半後短波九點六五兆赫清淨些，把天線拉長兩節。' },
    { speaker: '端盆回屋的大嫂', text: '蜂窩煤封好火口再睡，風往西邊颳呢。' },
  ],
  courtyard: [
    { speaker: '西屋鄰居', text: '屋簷底下水壺快開了，拿個瓷缸子出來晾著吧。' },
    { speaker: '修車角師傅', text: '二十八吋加重自行車就是結實，打足氣明天照樣跑遠道。' },
  ],
  courtyard_day: [
    { speaker: '院裡大媽', text: '趁著太陽好，把換季被套曬在槐樹旁那根鐵絲上。' },
    { speaker: '路過小報童', text: '今早報紙送到胡同口報刊欄了，還餘下幾份晚報。' },
  ],
  factory: [
    { speaker: '二車間老師傅', text: '二號車床主軸剛添過機油，聽聲兒比上禮拜順多了。' },
    { speaker: '廠門口值班員', text: '夜班交接登記簿擺在門房窗台，簽了名再騎車走。' },
  ],
  factory_dawn: [
    { speaker: '早班女工', text: '車間外頭霧還重，食堂熬好了棒子麵粥在冒熱氣呢。' },
    { speaker: '值夜班工友', text: '天亮前那陣風最涼，領口扣好別著了風寒。' },
  ],
  march: [
    { speaker: '隊伍旁市民', text: '往前別擠，兩側留條道讓老弱和騎車人過去。' },
    { speaker: '路口學生', text: '大家挽著胳膊別走散，前頭在轉彎進長街。' },
  ],
  march_day: [
    { speaker: '街邊觀看的老工友', text: '槐花都快落盡了，這幾天下過一陣薄雨倒涼快些。' },
    { speaker: '行進隊列聲響', text: '整條街都是車鈴叮當和口號聲，從西單往東一直排過去。' },
  ],
  changan: [
    { speaker: '路邊納涼市民', text: '華燈一亮，十里長街遠遠望過去全是車燈和人影。' },
    { speaker: '路口維護秩序學生', text: '電車道邊兒留出來，小心別絆到路緣石。' },
  ],
  changan_rain: [
    { speaker: '傘下行人', text: '雨點打在柏油路上反著路燈光，路滑，推車慢慢走。' },
    { speaker: '公交站台避雨街坊', text: '雨衣借你擋一會兒肩頭吧，這陣陣雨怕還要下一刻鐘。' },
  ],
  square: [
    { speaker: '廣場邊學生', text: '風從北面金水橋方向吹過來，今晚廣播聲比昨夜更響。' },
    { speaker: '路過紀錄者', text: '把今天幾個路口見到的告示原文逐字抄在筆記本裡吧。' },
  ],
  camp: [
    { speaker: '帳篷旁學生', text: '暖水瓶裡還餘半壺熱水，給夜班值守的同學分一點。' },
    { speaker: '衛生站志願者', text: '葡萄糖水擱在木箱左手邊，別忘了登記時間。' },
  ],
  statue: [
    { speaker: '夜裡圍觀市民', text: '風把旗角吹得獵獵作響，四下裡相機快門閃過幾回。' },
    { speaker: '值守學生', text: '我們只守在這邊兒看著，不和任何路過車輛起摩擦。' },
  ],
  blockade: [
    { speaker: '路口老師傅', text: '無軌電車就停在十宇路口這兒，大伙兒只圍著車身說話。' },
    { speaker: '晚間街坊', text: '手電筒照著路邊行道樹吧，往回走的時候慢點兒。' },
  ],
  newsroom: [
    { speaker: '夜班電傳員', text: '電傳機剛吐出凌晨簡訊捲，墨帶還熱著，已按鐘點歸檔。' },
    { speaker: '資料組老編輯', text: '每一則現場見聞都得標清楚時間、地點和消息來源。' },
  ],
  beijing_hotel_balcony: [
    { speaker: '十樓走廊外聲', text: '長安街上的車鈴聲與遠處喧嘩順著夜風飄上十樓陽台。' },
    { speaker: '同層駐站記者', text: '三腳架支穩一點，長曝光別碰著鑄鐵欄杆。' },
  ],
  overpass: [
    { speaker: '天橋北側居民', text: '站在立交橋階梯上能把東西兩頭整條路看得清清楚楚。' },
    { speaker: '路邊推車青年', text: '下邊輔路擁住了，大夥兒盡量靠邊站別堵著天橋口。' },
  ],
  xinhua_gate: [
    { speaker: '門前夜風中街坊', text: '紅牆外頭長明華燈照著路面，四下偶爾有自行車穿過。' },
    { speaker: '巷口學生', text: '靜坐在台階那邊兒的人一夜沒怎麼移動。' },
  ],
  hospital_gate: [
    { speaker: '門診樓值班護師', text: '請家屬在樹蔭這一側登記姓名，急診車道一定保持暢通。' },
    { speaker: '急診門口街坊', text: '誰有乾淨手帕或開水壺？那邊剛下來一輛三輪車。' },
  ],
  siheyuan_room: [
    { speaker: '收音機電流聲', text: '短波刻度表在七點三五與九點六五兆赫之間泛著微黃燈光。' },
    { speaker: '窗外國槐風聲', text: '蜂窩煤爐上鐵壺正嗡嗡響，院牆外夜色一片靜默。' },
  ],
  morning_market: [
    { speaker: '豆腐腦攤夥計', text: '熱騰騰的豆腐腦加蝦皮香菜，早上起得早的快來吃一碗。' },
    { speaker: '老住戶', text: '今早青菜倒是照常上市了，只是報攤那兒一早便被圍滿了。' },
  ],
  aftermath: [
    { speaker: '清晨校工', text: '林蔭道灑過一遍水，公告欄底下剩幾張昨晚淋濕的紙角。' },
    { speaker: '宿舍樓門口同學', text: '天亮了，先把該記下的姓名與地址好好收進筆記本裡。' },
  ],
  street_aftermath: [
    { speaker: '掃街清潔工', text: '風捲著落葉沿路邊轉了半圈，十字路口安靜得只聽見風聲。' },
    { speaker: '胡同口居民', text: '那輛倒在牆根下的二八自行車，不知是誰昨晚急著丟下的。' },
  ],
};

const PIGEON_SCENES = new Set<SceneId>([
  'campus', 'courtyard', 'courtyard_day', 'street', 'street_aftermath',
  'morning_market', 'changan', 'square', 'aftermath', 'factory', 'factory_dawn',
]);

const STEAM_ANCHORS: Partial<Record<SceneId, Array<[number, number, number]>>> = {
  courtyard: [[-2.4, 0.9, -1.8], [3.6, 0.9, -3.2]],
  courtyard_day: [[-2.4, 0.9, -1.8], [3.6, 0.9, -3.2]],
  hutong: [[12.6, 0.85, 5.2], [15.8, 0.85, 6.4]],
  morning_market: [[-6.5, 1.0, -3.4], [5.2, 1.0, -3.8], [1.4, 1.0, 2.2]],
  siheyuan_room: [[-2.8, 0.88, -1.2]],
  factory: [[-10.0, 2.5, -6.0], [11.0, 2.5, -7.0]],
  factory_dawn: [[-10.0, 2.2, -6.0], [11.0, 2.2, -7.0]],
};

function makePigeonGeo(): THREE.BufferGeometry {
  const w1 = new THREE.PlaneGeometry(0.32, 0.14);
  w1.rotateX(-Math.PI / 2);
  w1.rotateZ(0.28);
  w1.translate(-0.15, 0.02, 0);

  const w2 = new THREE.PlaneGeometry(0.32, 0.14);
  w2.rotateX(-Math.PI / 2);
  w2.rotateZ(-0.28);
  w2.translate(0.15, 0.02, 0);

  const merged = mergeGeometries([w1, w2])!;
  w1.dispose();
  w2.dispose();
  return merged;
}

function makeCrossBillboardGeo(w: number, h: number): THREE.BufferGeometry {
  const p1 = new THREE.PlaneGeometry(w, h);
  const p2 = new THREE.PlaneGeometry(w, h);
  p2.rotateY(Math.PI / 2);
  const merged = mergeGeometries([p1, p2])!;
  p1.dispose();
  p2.dispose();
  return merged;
}

/**
 * Attach <= 3 instanced living-ecology layers (circling pigeons, coal-stove steam plumes, sunlit dust motes)
 * plus period 1989 whispered street dialogue lookup for a built scene.
 */
export function attachLivingWorld(
  scene: THREE.Scene,
  sceneId: SceneId,
  preset: AtmospherePreset,
  isMobile: boolean
): LivingWorldHandle {
  const disposables: Array<{ dispose(): void }> = [];
  const objToRemove: THREE.Object3D[] = [];
  const dummy = new THREE.Object3D();

  let layerCount = 0;

  // 1. Banking pigeon flock on open daytime/dawn/dusk/aftermath scenes
  let pigeonMesh: THREE.InstancedMesh | null = null;
  const pigeonParams: Array<{
    cx: number; cy: number; cz: number; rx: number; rz: number;
    speed: number; phase: number; flapSpeed: number;
  }> = [];

  if (PIGEON_SCENES.has(sceneId) && preset !== 'rain_overcast' && layerCount < 3) {
    const count = isMobile ? 6 : 10;
    const pGeo = makePigeonGeo();
    const pMat = new THREE.MeshBasicMaterial({
      color: preset === 'night' ? 0x6a7080 : 0xd8d6ce,
      side: THREE.DoubleSide,
    });
    pigeonMesh = new THREE.InstancedMesh(pGeo, pMat, count);
    pigeonMesh.frustumCulled = false;
    pigeonMesh.name = 'livingPigeons';
    for (let i = 0; i < count; i++) {
      const cluster = i % 2 === 0 ? -1 : 1;
      pigeonParams.push({
        cx: cluster * 6 + ((i * 7) % 9) - 4,
        cy: 9.2 + (i % 5) * 1.1,
        cz: -4 + ((i * 5) % 10) - 5,
        rx: 9 + (i % 4) * 3.2,
        rz: 7 + (i % 3) * 2.8,
        speed: 0.24 + (i % 4) * 0.04,
        phase: (i / count) * Math.PI * 2,
        flapSpeed: 8.5 + (i % 5) * 1.4,
      });
    }
    scene.add(pigeonMesh);
    objToRemove.push(pigeonMesh);
    disposables.push(pGeo, pMat);
    layerCount++;
  }

  // 2. Coal-stove / breakfast / workshop steam plumes (cross-billboard using shared soft glow texture)
  let steamMesh: THREE.InstancedMesh | null = null;
  const steamAnchors = STEAM_ANCHORS[sceneId];
  const steamPuffs: Array<{ ax: number; ay: number; az: number; phase: number; speed: number }> = [];

  if (steamAnchors?.length && layerCount < 3) {
    const puffsPerAnchor = isMobile ? 3 : 5;
    const count = steamAnchors.length * puffsPerAnchor;
    const sGeo = makeCrossBillboardGeo(1.0, 1.0);
    const sMat = new THREE.MeshBasicMaterial({
      map: SharedTexPool.softGlowTex(),
      color: preset === 'night' || preset === 'curfew_amber' ? 0xc0bcb0 : 0xe8e6de,
      transparent: true,
      opacity: preset === 'dawn' || sceneId === 'morning_market' ? 0.16 : 0.11,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    steamMesh = new THREE.InstancedMesh(sGeo, sMat, count);
    steamMesh.frustumCulled = false;
    steamMesh.name = 'livingSteam';
    steamAnchors.forEach((a, ai) => {
      for (let pi = 0; pi < puffsPerAnchor; pi++) {
        steamPuffs.push({
          ax: a[0],
          ay: a[1],
          az: a[2],
          phase: pi / puffsPerAnchor + ai * 0.23,
          speed: 0.22 + (pi % 3) * 0.04,
        });
      }
    });
    scene.add(steamMesh);
    objToRemove.push(steamMesh);
    disposables.push(sGeo, sMat);
    layerCount++;
  }

  // 3. Drifting sunlit spring dust motes / subtle nocturnal sodium haze flecks (skip on rain scenes)
  let dustMesh: THREE.InstancedMesh | null = null;
  const dustParticles: Array<{ ox: number; oy: number; oz: number; vx: number; vy: number; vz: number; phase: number }> = [];

  if (preset !== 'rain_overcast' && layerCount < 3) {
    const count = isMobile ? 14 : 26;
    const dGeo = makeCrossBillboardGeo(0.11, 0.11);
    const isDark = preset === 'night' || preset === 'curfew_amber';
    const dMat = new THREE.MeshBasicMaterial({
      map: SharedTexPool.softGlowTex(),
      color: isDark ? 0xffd28c : 0xf4ecd6,
      transparent: true,
      opacity: isDark ? 0.22 : 0.30,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    dustMesh = new THREE.InstancedMesh(dGeo, dMat, count);
    dustMesh.frustumCulled = false;
    dustMesh.name = 'livingDust';
    for (let i = 0; i < count; i++) {
      dustParticles.push({
        ox: ((i * 37) % 22) - 11,
        oy: 0.5 + ((i * 19) % 42) * 0.1,
        oz: ((i * 53) % 22) - 11,
        vx: 0.18 + ((i % 5) - 2) * 0.07,
        vy: 0.06 + (i % 3) * 0.03,
        vz: ((i % 7) - 3) * 0.05,
        phase: i * 0.71,
      });
    }
    scene.add(dustMesh);
    objToRemove.push(dustMesh);
    disposables.push(dGeo, dMat);
    layerCount++;
  }

  const whispers = SCENE_WHISPERS[sceneId] ?? [];

  return {
    update(_dt: number, t: number, playerX: number, playerZ: number): void {
      if (pigeonMesh) {
        for (let i = 0; i < pigeonParams.length; i++) {
          const p = pigeonParams[i]!;
          const ang = t * p.speed + p.phase;
          const x = p.cx + Math.cos(ang) * p.rx;
          const z = p.cz + Math.sin(ang) * p.rz;
          const y = p.cy + Math.sin(ang * 2 + p.phase) * 0.85;
          const yaw = Math.atan2(-Math.cos(ang) * p.rz, -Math.sin(ang) * p.rx);
          dummy.position.set(x, y, z);
          dummy.rotation.set(0.06, yaw, -0.18);
          const flap = 0.28 + Math.abs(Math.sin(t * p.flapSpeed + p.phase)) * 0.92;
          dummy.scale.set(1.0, flap, 1.0);
          dummy.updateMatrix();
          pigeonMesh.setMatrixAt(i, dummy.matrix);
        }
        pigeonMesh.instanceMatrix.needsUpdate = true;
      }

      if (steamMesh) {
        for (let i = 0; i < steamPuffs.length; i++) {
          const s = steamPuffs[i]!;
          const life = (t * s.speed + s.phase) % 1;
          const driftX = Math.sin(t * 0.7 + s.phase * 6) * 0.26 * life;
          const driftZ = Math.cos(t * 0.55 + s.phase * 4) * 0.20 * life;
          dummy.position.set(s.ax + driftX, s.ay + life * 2.1, s.az + driftZ);
          dummy.rotation.set(0, t * 0.3 + s.phase, 0);
          const grow = 0.45 + life * 1.15;
          const fadeScale = Math.sin(life * Math.PI);
          dummy.scale.setScalar(grow * Math.max(0.05, fadeScale));
          dummy.updateMatrix();
          steamMesh.setMatrixAt(i, dummy.matrix);
        }
        steamMesh.instanceMatrix.needsUpdate = true;
      }

      if (dustMesh) {
        const span = 22;
        const half = span / 2;
        for (let i = 0; i < dustParticles.length; i++) {
          const d = dustParticles[i]!;
          const wx = (((d.ox + t * d.vx - playerX) % span) + span) % span - half + playerX;
          const wz = (((d.oz + t * d.vz - playerZ) % span) + span) % span - half + playerZ;
          const wy = 0.45 + ((d.oy + t * d.vy + Math.sin(t + d.phase) * 0.25) % 4.4);
          dummy.position.set(wx, wy, wz);
          dummy.rotation.set(0, d.phase, 0);
          const pulse = 0.7 + 0.4 * Math.sin(t * 1.6 + d.phase);
          dummy.scale.setScalar(pulse);
          dummy.updateMatrix();
          dustMesh.setMatrixAt(i, dummy.matrix);
        }
        dustMesh.instanceMatrix.needsUpdate = true;
      }
    },

    getWhisper(t: number): { speaker: string; text: string } | null {
      if (!whispers.length) return null;
      const cycleSec = 15;
      const slot = Math.floor(t / cycleSec);
      const localT = t % cycleSec;
      // Show for 6.5 seconds starting at offset 2.5s inside each 15s window
      if (localT < 2.5 || localT > 9.0) return null;
      return whispers[slot % whispers.length] ?? null;
    },

    dispose(): void {
      for (const obj of objToRemove) {
        obj.removeFromParent();
      }
      for (const res of disposables) {
        res.dispose();
      }
    },
  };
}

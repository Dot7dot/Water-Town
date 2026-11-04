// Static game data: bottles, plants, buildings, tips.
// Every text has { zh, en } so it can follow the language switch.

export const GRID = 10;               // the city is a GRID x GRID board of 1x1x1 cubes
export const ML_PER_COIN = 100;       // every 100 ml = 1 water coin
export const DRINK_FACTOR = 0.5;      // beverages (not water) count half
export const DEFAULT_GOAL = 2000;     // default daily goal in ml
export const SPROUT_EVERY_ML = 500;   // a new natural sprout every 500 ml (effective)
export const LEAF_EVERY_ML = 100;     // one more leaf every 100 ml (effective)
export const PERFECT_MIN = 0.9;       // perfect range = 90% .. 150% of the goal
export const PERFECT_MAX = 1.5;
export const DIE_AFTER_DRY_DAYS = 3;  // three full days without drinking -> plant dies
export const SEED_PRICE = 6;

// Starting terrain. G = grass, W = river, S = sand
export const TERRAIN = [
  'GGGGGGWGGG',
  'GGGGGGWGGG',
  'GGGGGWWGGG',
  'GGGGGWGGGG',
  'GGGGGWGGGG',
  'GGGGWWGGGG',
  'GGGGWGGGSS',
  'GGGGWGGSSS',
  'GGGWWGGSSS',
  'GGGWGGGSSS',
];

export const BOTTLE_ICONS = ['flask', 'sport', 'jug', 'cup', 'thermos'];

export const BOTTLE_PRESETS = [
  { key: 'small', name: { zh: '小水壺', en: 'Small Bottle' }, capacity: 500, icon: 'flask', color: '#7cc8ff' },
  { key: 'medium', name: { zh: '中水壺', en: 'Medium Bottle' }, capacity: 700, icon: 'sport', color: '#7be0b0' },
  { key: 'large', name: { zh: '大水壺', en: 'Large Bottle' }, capacity: 1000, icon: 'jug', color: '#ffb36b' },
];

export const BOTTLE_COLORS = ['#7cc8ff', '#7be0b0', '#ffb36b', '#ff8fb1', '#b59cff', '#ffd75e'];

// Hydration tiers (based on the effective intake of the last 24 hours vs. goal)
export const TIERS = {
  dry: { min: 0, emoji: '🌵', name: { zh: '乾燥', en: 'Dry' } },
  low: { min: 0.4, emoji: '🌱', name: { zh: '微濕', en: 'Damp' } },
  good: { min: 0.8, emoji: '🌿', name: { zh: '滋潤', en: 'Moist' } },
  lush: { min: 1.2, emoji: '🌊', name: { zh: '豐沛', en: 'Lush' } },
};
export const TIER_ORDER = ['dry', 'low', 'good', 'lush'];

// Habitat tokens a spot can have:
//   water  - river or pond         pond  - pond only (still water)
//   shore  - grass next to water   grass - any grass
//   dry    - sand or grass away from water
//   sand   - sand only             oasis - sand next to water
//   wall   - the wall of a building
export const HABITAT_TEXT = {
  water: { zh: '水中（河流或池塘）', en: 'In water (river or pond)' },
  pond: { zh: '靜水（只有池塘）', en: 'Still water (pond only)' },
  shore: { zh: '水邊濕潤的草地', en: 'Moist grass by the water' },
  grass: { zh: '草地', en: 'Grassland' },
  dry: { zh: '遠離水邊的乾燥土地', en: 'Dry land away from water' },
  sand: { zh: '沙地', en: 'Sand' },
  oasis: { zh: '水邊的沙地（綠洲）', en: 'Sand by the water (oasis)' },
  wall: { zh: '建築物的牆面', en: 'Building walls' },
};

// Plants. size = footprint (1 or 2). kind 'wall' = flat texture on a wall.
// tiers = hydration tiers under which it can sprout naturally.
// requires = a building that must exist in the city for it to sprout.
export const PLANTS = [
  // --- water ---
  { id: 'duckweed', habitat: ['water'], tiers: ['low', 'good'], size: 1, bloom: false, fruit: false,
    name: { zh: '浮萍', en: 'Duckweed' },
    desc: { zh: '漂浮在水面的小圓葉，是許多小魚的遮陽傘。', en: 'Tiny floating leaves that shade the little fish.' } },
  { id: 'waterlily', habitat: ['water'], tiers: ['good', 'lush'], size: 1, bloom: true, fruit: false,
    name: { zh: '睡蓮', en: 'Water Lily' },
    desc: { zh: '葉子平貼水面，喝水完美的日子會開出粉紅色的花。', en: 'Flat pads on the water; blooms pink on perfect days.' } },
  { id: 'lotus', habitat: ['pond'], tiers: ['lush'], size: 1, bloom: true, fruit: true,
    name: { zh: '荷花', en: 'Lotus' },
    desc: { zh: '只喜歡平靜的池塘，水分非常充足時才會出現，最後會結出蓮蓬。', en: 'Loves still ponds only. Appears when you are very hydrated and later grows seed pods.' } },
  // --- shore ---
  { id: 'fern', habitat: ['shore'], tiers: ['low', 'good'], size: 1, bloom: false, fruit: false,
    name: { zh: '蕨類', en: 'Fern' },
    desc: { zh: '喜歡潮濕陰涼的水邊，是恐龍時代就存在的古老植物。', en: 'An ancient plant that loves damp, shady banks.' } },
  { id: 'reed', habitat: ['shore'], tiers: ['good', 'lush'], size: 1, bloom: true, fruit: false,
    name: { zh: '香蒲', en: 'Cattail' },
    desc: { zh: '長在水岸邊，能幫忙淨化水質，開花時像一根根熱狗。', en: 'Grows on banks and cleans the water. Its flowers look like hot dogs!' } },
  { id: 'iris', habitat: ['shore'], tiers: ['lush'], size: 1, bloom: true, fruit: false,
    name: { zh: '鳶尾花', en: 'Water Iris' },
    desc: { zh: '濕地裡的紫色精靈，需要非常充足的水分。', en: 'A purple wetland fairy that needs plenty of water.' } },
  { id: 'mushroom', habitat: ['shore'], tiers: ['low', 'good'], size: 1, bloom: false, fruit: false,
    name: { zh: '小蘑菇', en: 'Mushroom' },
    desc: { zh: '潮濕的土地上會冒出可愛的紅色小蘑菇。', en: 'Cute red mushrooms pop up on damp ground.' } },
  { id: 'willow', habitat: ['shore'], tiers: ['lush'], size: 2, bloom: false, fruit: false,
    name: { zh: '垂柳', en: 'Weeping Willow' },
    desc: { zh: '2×2 的大樹，長長的枝條垂到水邊，只在水分豐沛時出現。', en: 'A 2×2 giant whose long branches droop to the water. Appears only when lush.' } },
  // --- grass ---
  { id: 'clover', habitat: ['grass'], tiers: ['low', 'good'], size: 1, bloom: false, fruit: false,
    name: { zh: '幸運草', en: 'Clover' },
    desc: { zh: '綠油油的三葉草，聽說找到四葉的會有好運。', en: 'Fresh three-leaf clover. Find a four-leaf one for luck!' } },
  { id: 'dandelion', habitat: ['grass'], tiers: ['dry', 'low'], size: 1, bloom: true, fruit: true,
    name: { zh: '蒲公英', en: 'Dandelion' },
    desc: { zh: '很堅強，喝水少也能長，最後會變成會飛的毛球。', en: 'Tough even when you drink little; turns into a flying puffball.' } },
  { id: 'pine', habitat: ['grass'], tiers: ['low', 'good'], size: 1, bloom: false, fruit: true,
    name: { zh: '小松樹', en: 'Pine Tree' },
    desc: { zh: '四季常綠的松樹，最後會結出松果。', en: 'Evergreen pine that eventually bears pine cones.' } },
  { id: 'berry', habitat: ['grass'], tiers: ['good'], size: 1, bloom: true, fruit: true,
    name: { zh: '藍莓叢', en: 'Blueberry Bush' },
    desc: { zh: '圓滾滾的灌木，完美喝水的日子會結出藍莓。', en: 'A round bush that grows blueberries on perfect days.' } },
  { id: 'tulip', habitat: ['grass'], tiers: ['good', 'lush'], size: 1, bloom: true, fruit: false, requires: 'greenhouse',
    name: { zh: '鬱金香', en: 'Tulip' },
    desc: { zh: '需要溫室培育球根才會在城市出現。', en: 'Needs a greenhouse to raise the bulbs.' } },
  { id: 'sunflower', habitat: ['grass'], tiers: ['good', 'lush'], size: 1, bloom: true, fruit: true, requires: 'windmill',
    name: { zh: '向日葵', en: 'Sunflower' },
    desc: { zh: '風車旁的農田最適合向日葵，花謝後會結出瓜子。', en: 'Grows near windmill farms and makes seeds after blooming.' } },
  { id: 'apple', habitat: ['grass'], tiers: ['good', 'lush'], size: 1, bloom: true, fruit: true, requires: 'beehive',
    name: { zh: '蘋果樹', en: 'Apple Tree' },
    desc: { zh: '需要蜜蜂幫忙授粉，開花之後會結出紅蘋果。', en: 'Needs bees to pollinate; red apples follow the blossoms.' } },
  { id: 'sakura', habitat: ['grass'], tiers: ['good', 'lush'], size: 1, bloom: true, fruit: false, requires: 'teahouse',
    name: { zh: '櫻花樹', en: 'Cherry Blossom' },
    desc: { zh: '茶屋旁最美的風景，盛開時一片粉紅。', en: 'The prettiest sight next to a tea house.' } },
  { id: 'oak', habitat: ['grass'], tiers: ['lush'], size: 2, bloom: false, fruit: true,
    name: { zh: '大橡樹', en: 'Great Oak' },
    desc: { zh: '2×2 的巨大橡樹，需要非常多的水，會結出橡實。', en: 'A 2×2 mighty oak that drinks a lot and drops acorns.' } },
  // --- dry / sand ---
  { id: 'cactus', habitat: ['dry'], tiers: ['dry'], size: 1, bloom: true, fruit: true,
    name: { zh: '仙人掌', en: 'Cactus' },
    desc: { zh: '喝水太少時會長出來。不會長在水邊，因為根會爛掉！', en: 'Appears when you drink too little. Never near water — its roots would rot!' } },
  { id: 'barrel', habitat: ['sand'], tiers: ['dry', 'low'], size: 1, bloom: true, fruit: false,
    name: { zh: '仙人球', en: 'Barrel Cactus' },
    desc: { zh: '只住在沙地上的圓滾滾仙人球，會開出黃色的花冠。', en: 'A round cactus that only lives on sand. Wears a yellow flower crown.' } },
  { id: 'aloe', habitat: ['dry'], tiers: ['dry', 'low'], size: 1, bloom: true, fruit: false,
    name: { zh: '蘆薈', en: 'Aloe' },
    desc: { zh: '肥厚的葉子能儲存水分，適合乾燥的土地。', en: 'Stores water in its chunky leaves; suits dry land.' } },
  { id: 'succulent', habitat: ['dry'], tiers: ['low'], size: 1, bloom: true, fruit: false,
    name: { zh: '多肉植物', en: 'Succulent' },
    desc: { zh: '像玫瑰一樣的蓮座，很好養。', en: 'A rosette like a little rose — easy to keep.' } },
  { id: 'palm', habitat: ['oasis'], tiers: ['good', 'lush'], size: 1, bloom: false, fruit: true,
    name: { zh: '椰棗樹', en: 'Date Palm' },
    desc: { zh: '沙漠綠洲的代表：一定要長在靠近水的沙地上。', en: 'The oasis tree: it must grow on sand right next to water.' } },
  // --- wall (flat textures, 1x1 or 1x2) ---
  { id: 'ivy', habitat: ['wall'], tiers: ['dry', 'low', 'good'], size: 1, kind: 'wall', bloom: false, fruit: false,
    name: { zh: '常春藤', en: 'Ivy' },
    desc: { zh: '攀爬在牆壁上的藤蔓，讓建築穿上綠色外套。', en: 'Climbs walls and gives buildings a green coat.' } },
  { id: 'morningglory', habitat: ['wall'], tiers: ['good'], size: 1, kind: 'wall', bloom: true, fruit: false,
    name: { zh: '牽牛花', en: 'Morning Glory' },
    desc: { zh: '在牆上攀爬，完美喝水的早晨會開出喇叭狀的花。', en: 'Climbs walls and opens trumpet flowers on perfect mornings.' } },
  { id: 'grape', habitat: ['wall'], tiers: ['lush'], size: 1, kind: 'wall', bloom: false, fruit: true,
    name: { zh: '葡萄藤', en: 'Grapevine' },
    desc: { zh: '水分豐沛時爬上牆壁，最後掛滿一串串紫色葡萄。', en: 'Climbs walls when you are well hydrated and fills with purple grapes.' } },
];

export const PLANT_MAP = Object.fromEntries(PLANTS.map((p) => [p.id, p]));

// Buildings / decorations. size = footprint, height = 1 or 2 cubes (never above 2x2x2).
// walls: climbing plants can grow on its walls.
// placeOn: 'land' (grass/sand) or 'river'.
export const BUILDINGS = [
  { id: 'cottage', price: 25, size: 1, height: 1, walls: true, placeOn: 'land', cat: 'building',
    name: { zh: '小木屋', en: 'Cottage' },
    desc: { zh: '溫馨的小家。牆面可以讓藤蔓攀爬。', en: 'A cozy home. Vines can climb its walls.' } },
  { id: 'house2', price: 70, size: 2, height: 2, walls: true, placeOn: 'land', cat: 'building',
    name: { zh: '雙層洋房', en: 'Two-story House' },
    desc: { zh: '2×2×2 的大房子，高牆可以長出 1×2 的爬藤。', en: 'A 2×2×2 house; its tall walls host 1×2 vines.' } },
  { id: 'clocktower', price: 55, size: 1, height: 2, walls: true, placeOn: 'land', cat: 'building',
    name: { zh: '鐘塔', en: 'Clock Tower' },
    desc: { zh: '提醒你按時喝水的鐘塔。', en: 'A clock tower reminding you to drink on time.' } },
  { id: 'windmill', price: 60, size: 1, height: 2, walls: true, placeOn: 'land', cat: 'building', unlocks: 'sunflower',
    name: { zh: '風車', en: 'Windmill' },
    desc: { zh: '轉呀轉的風車。城市有風車時會長出向日葵。', en: 'A spinning windmill. Sunflowers start to grow.' } },
  { id: 'teahouse', price: 65, size: 2, height: 1, walls: true, placeOn: 'land', cat: 'building', unlocks: 'sakura',
    name: { zh: '茶屋', en: 'Tea House' },
    desc: { zh: '安靜的和風茶屋。會吸引櫻花樹生長。', en: 'A calm tea house that invites cherry trees.' } },
  { id: 'greenhouse', price: 50, size: 2, height: 1, walls: false, placeOn: 'land', cat: 'building', unlocks: 'tulip',
    name: { zh: '玻璃溫室', en: 'Greenhouse' },
    desc: { zh: '培育球根的溫室，會讓鬱金香出現。玻璃牆無法攀爬。', en: 'Raises bulbs so tulips appear. Glass walls cannot be climbed.' } },
  { id: 'beehive', price: 20, size: 1, height: 1, walls: false, placeOn: 'land', cat: 'building', unlocks: 'apple',
    name: { zh: '蜂箱', en: 'Beehive' },
    desc: { zh: '蜜蜂幫忙授粉，蘋果樹才會出現。', en: 'Bees pollinate flowers, so apple trees can appear.' } },
  { id: 'well', price: 20, size: 1, height: 1, walls: false, placeOn: 'land', cat: 'building', moist: true,
    name: { zh: '水井', en: 'Well' },
    desc: { zh: '讓周圍一格的土地變得濕潤，水邊植物也能在這裡生長。', en: 'Moistens the land around it so waterside plants can grow.' } },
  { id: 'fountain', price: 45, size: 2, height: 1, walls: false, placeOn: 'land', cat: 'building', moist: true,
    name: { zh: '噴水池', en: 'Fountain' },
    desc: { zh: '2×2 的噴水池，讓周圍變成濕潤的土地。', en: 'A 2×2 fountain that moistens the land around it.' } },
  { id: 'pond', price: 35, size: 2, height: 1, walls: false, placeOn: 'grass', cat: 'building', pond: true, unlocks: 'lotus',
    name: { zh: '小池塘', en: 'Pond' },
    desc: { zh: '2×2 的靜水池塘，水生植物可以種在裡面，荷花只長在池塘。', en: 'A 2×2 still pond. Aquatic plants live in it; lotus grows only here.' } },
  { id: 'watertower', price: 50, size: 1, height: 2, walls: false, placeOn: 'land', cat: 'building', bonus: 0.1,
    name: { zh: '水塔', en: 'Water Tower' },
    desc: { zh: '儲水的高塔，每次喝水多得 10% 水源幣。', en: 'Stores water: +10% water coins every drink.' } },
  { id: 'bridge', price: 15, size: 1, height: 1, walls: false, placeOn: 'river', cat: 'deco',
    name: { zh: '小木橋', en: 'Little Bridge' },
    desc: { zh: '只能放在河上的小橋。', en: 'Can only be placed over the river.' } },
  { id: 'lamp', price: 8, size: 1, height: 1, walls: false, placeOn: 'land', cat: 'deco',
    name: { zh: '路燈', en: 'Street Lamp' },
    desc: { zh: '暖暖的燈光。', en: 'A warm little light.' } },
  { id: 'bench', price: 8, size: 1, height: 1, walls: false, placeOn: 'land', cat: 'deco',
    name: { zh: '長椅', en: 'Bench' },
    desc: { zh: '坐下來喝口水吧。', en: 'Sit down and have a sip.' } },
  { id: 'mailbox', price: 6, size: 1, height: 1, walls: false, placeOn: 'land', cat: 'deco',
    name: { zh: '郵筒', en: 'Mailbox' },
    desc: { zh: '寄一封信給明天的自己：記得喝水。', en: 'A letter to tomorrow-you: drink water.' } },
];

export const BUILDING_MAP = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

// Tips for the loading screen: environment & health
export const TIPS = [
  { icon: '💧', zh: '成人每天大約需要「體重(公斤) × 30 ml」的水分。', en: 'Adults need roughly 30 ml of water per kg of body weight each day.' },
  { icon: '♻️', zh: '一個塑膠瓶需要約 450 年才能分解，自備水壺吧！', en: 'A plastic bottle takes ~450 years to break down. Bring your own bottle!' },
  { icon: '🧠', zh: '只要輕微脫水，注意力與心情就可能下降。', en: 'Even mild dehydration can lower focus and mood.' },
  { icon: '🌍', zh: '地球上只有約 2.5% 是淡水，能直接使用的不到 1%。', en: 'Only ~2.5% of Earth’s water is fresh, and less than 1% is easy to use.' },
  { icon: '🌅', zh: '起床先喝一杯水，幫身體溫柔開機。', en: 'A glass of water after waking up gently boots your body.' },
  { icon: '🚰', zh: '一個滴水的水龍頭，一年可能浪費上千公升的水。', en: 'A dripping tap can waste thousands of litres a year.' },
  { icon: '🌾', zh: '洗米水可以拿來澆花，植物很喜歡。', en: 'Rice-washing water makes a great drink for plants.' },
  { icon: '🍋', zh: '尿液呈淡黃色，代表補水充足。', en: 'Pale yellow urine means you are well hydrated.' },
  { icon: '🥵', zh: '覺得口渴時，身體其實已經有點缺水了。', en: 'When you feel thirsty, you are already a little dehydrated.' },
  { icon: '🧋', zh: '含糖飲料熱量高，白開水才是最好的補水選擇。', en: 'Sugary drinks add calories; plain water is the best choice.' },
  { icon: '🪥', zh: '刷牙時關掉水龍頭，每次可以省下好幾公升的水。', en: 'Turning off the tap while brushing saves litres every time.' },
  { icon: '👕', zh: '生產一件棉質 T 恤大約需要 2,700 公升的水。', en: 'Making one cotton T-shirt takes about 2,700 litres of water.' },
  { icon: '🏃', zh: '運動時每 15～20 分鐘補充一些水分。', en: 'During exercise, sip some water every 15–20 minutes.' },
  { icon: '🍉', zh: '西瓜大約有 92% 是水，蔬果也能幫忙補水。', en: 'Watermelon is ~92% water — fruit and veggies hydrate you too.' },
  { icon: '🚿', zh: '淋浴少 1 分鐘，大約可以省下 10 公升的水。', en: 'One minute less in the shower saves about 10 litres.' },
  { icon: '🧍', zh: '人體大約有 60% 是由水組成的。', en: 'About 60% of your body is water.' },
  { icon: '🥤', zh: '小口慢慢喝，比一次大口灌更容易吸收。', en: 'Small, steady sips absorb better than big gulps.' },
  { icon: '🌧️', zh: '收集雨水來澆花，是簡單的節水方法。', en: 'Collecting rainwater for plants is an easy way to save water.' },
  { icon: '☕', zh: '咖啡和茶也能補水，但記得不要過量。', en: 'Coffee and tea hydrate too — just don’t overdo it.' },
  { icon: '⚠️', zh: '短時間喝下大量的水可能造成水中毒，分散喝最好。', en: 'Too much water too fast can be harmful — spread it out.' },
  { icon: '🐢', zh: '海洋中的塑膠垃圾會傷害海龜等海洋生物。', en: 'Plastic waste in the ocean harms turtles and other sea life.' },
  { icon: '🌳', zh: '一棵大樹一天可以蒸散數百公升的水，幫城市降溫。', en: 'A big tree can release hundreds of litres a day, cooling the city.' },
];

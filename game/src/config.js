// Sizzle & Serve — configuration: kitchen layout, ingredients, recipes, tuning.
// The game is an original cooking game: run the Golden Ladle bistro, take orders,
// chop, boil, grill and bake, plate the dish and serve it before patience runs out.
export const GAME_NAME = 'Sizzle & Serve';
export const BISTRO_NAME = 'The Golden Ladle';
export const W = 960;
export const H = 600;
export const HUD_H = 96;
export const STEP = 1 / 60;
export const SHIFT_SECONDS = 150;
export const RUSH_SECONDS = 40;
export const CHEF_SPEED = 265;
export const INTERACT_RANGE = 78;

// Ingredients. prep: 'none' (ready as picked), 'chop' (chopping board),
// 'boil' (stove pot), 'grill' (grill), 'bake' (oven).
export const INGREDIENTS = {
  tomato: { name: 'Tomato', color: '#e5484d', dark: '#a92c31', prep: 'chop', time: 1.2, key: '1' },
  lettuce: { name: 'Lettuce', color: '#58b368', dark: '#2f7d3d', prep: 'chop', time: 1.0, key: '2' },
  cucumber: { name: 'Cucumber', color: '#7bc96f', dark: '#3e7d32', prep: 'chop', time: 1.0, key: '3' },
  lemon: { name: 'Lemon', color: '#fdd835', dark: '#c8a415', prep: 'chop', time: 0.9, key: '4' },
  mushroom: { name: 'Mushroom', color: '#d7ccc8', dark: '#8d6e63', prep: 'chop', time: 1.1, key: '5' },
  cheese: { name: 'Cheese', color: '#ffb300', dark: '#c17900', prep: 'chop', time: 0.9, key: '6' },
  basil: { name: 'Basil', color: '#2e7d32', dark: '#1b5e20', prep: 'none', time: 0, key: '7' },
  berries: { name: 'Berries', color: '#9c4dcc', dark: '#6a1b9a', prep: 'none', time: 0, key: '8' },
  pasta: { name: 'Pasta', color: '#ffca28', dark: '#c17900', prep: 'boil', time: 4.0, key: '9' },
  rice: { name: 'Rice', color: '#fffde7', dark: '#d7ccc8', prep: 'boil', time: 4.5, key: '0' },
  fish: { name: 'Fish', color: '#6fa8b8', dark: '#3d6e7e', prep: 'grill', time: 5.0, key: 'q' },
  dough: { name: 'Dough', color: '#f0d5a8', dark: '#c9a06a', prep: 'bake', time: 6.0, key: 'w' },
};
export const FRIDGE_ORDER = [
  'tomato', 'lettuce', 'cucumber', 'lemon', 'mushroom', 'cheese',
  'basil', 'berries', 'pasta', 'rice', 'fish', 'dough',
];

// Recipes: each dish is a set of three ingredients, combined in different ways.
export const RECIPES = {
  salad: { name: 'Garden Salad', ingredients: ['lettuce', 'tomato', 'cucumber'], base: 100 },
  pasta: { name: 'Tomato Pasta', ingredients: ['pasta', 'tomato', 'basil'], base: 140 },
  fish: { name: 'Grilled Fish', ingredients: ['fish', 'lemon', 'lettuce'], base: 160 },
  risotto: { name: 'Mushroom Risotto', ingredients: ['rice', 'mushroom', 'cheese'], base: 150 },
  tart: { name: 'Berry Tart', ingredients: ['dough', 'berries', 'lemon'], base: 170 },
  soup: { name: 'Tomato Soup', ingredients: ['tomato', 'mushroom', 'basil'], base: 130 },
  pizza: { name: 'Garden Pizza', ingredients: ['dough', 'tomato', 'cheese'], base: 180 },
};
export const RECIPE_KEYS = Object.keys(RECIPES);

// Star targets for the shift's final score: 1 / 2 / 3 stars.
export const STAR_TARGETS = [600, 1200, 2000];

// Stations: rect is the counter/fixture, point is where the chef stands to use it.
export const STATIONS = {
  fridge: { label: 'Fridge', x: 14, y: 196, w: 96, h: 248, px: 128, py: 320 },
  board: { label: 'Chopping Board', x: 176, y: 112, w: 168, h: 56, px: 260, py: 196 },
  stove: { label: 'Stove', x: 392, y: 112, w: 176, h: 56, px: 480, py: 196 },
  grill: { label: 'Grill', x: 616, y: 112, w: 144, h: 56, px: 688, py: 196 },
  oven: { label: 'Oven', x: 808, y: 112, w: 132, h: 56, px: 874, py: 196 },
  // The plating counter is an island in the middle of the kitchen floor.
  plating: { label: 'Plating Counter', x: 380, y: 296, w: 200, h: 52, px: 480, py: 384 },
  serve: { label: 'Serve', x: 884, y: 216, w: 62, h: 208, px: 852, py: 320 },
  trash: { label: 'Trash', x: 36, y: 492, w: 88, h: 52, px: 80, py: 462 },
};

// Cooking slots: stove has 2 pots, grill 2 slots, oven 1 rack.
export const SLOT_STATIONS = {
  stove: { slots: 2, prep: 'boil' },
  grill: { slots: 2, prep: 'grill' },
  oven: { slots: 1, prep: 'bake' },
};

// Tuning.
export const TUNE = {
  orderSlotsStart: 3,
  orderSlotsLevel: 3, // level at which a 4th order slot opens
  spawnIntervalStart: 15,
  spawnIntervalMin: 8,
  patienceStart: 52,
  patiencePerLevel: -3,
  patienceMin: 28,
  rushPatienceFactor: 0.8,
  burnGraceSeconds: 6,
  comboStep: 0.25,
  comboMax: 3,
  rushScoreFactor: 1.5,
  levelEveryServed: 3,
  levelMax: 5,
};

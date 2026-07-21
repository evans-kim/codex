import { MOODS, ENERGY_LEVELS, FEELINGS, METHODS, EXTRA_FILTERS } from './menu-options.js';
import { MENU_CATALOG_A } from './menu-catalog-a.js';
import { MENU_CATALOG_B } from './menu-catalog-b.js';

export { MOODS, ENERGY_LEVELS, FEELINGS, METHODS, EXTRA_FILTERS };
export const MENUS = [...MENU_CATALOG_A, ...MENU_CATALOG_B];

export const LABELS = {
  moods: Object.fromEntries(MOODS.map((item) => [item.id, item.label])),
  energies: Object.fromEntries(ENERGY_LEVELS.map((item) => [item.id, item.label])),
  feelings: Object.fromEntries(FEELINGS.map((item) => [item.id, item.label])),
  methods: Object.fromEntries(METHODS.map((item) => [item.id, item.label])),
  extras: Object.fromEntries(EXTRA_FILTERS.map((item) => [item.id, item.label]))
};

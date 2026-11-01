import type { TileKind } from "@my-better-t-app/backend/convex/lib/parkingState";

export type Tool =
  | "select"
  | "erase"
  | Extract<
      TileKind,
      | "road"
      | "parking"
      | "crossing"
      | "entry"
      | "gate"
      | "roundabout"
      | "tree"
      | "lamp"
      | "bench"
      | "flowers"
    >;

export const TOOLS: {
  id: Tool;
  label: string;
  price: number;
  key: string;
  description: string;
}[] = [
  {
    id: "road",
    label: "Route",
    price: 35,
    key: "1",
    description:
      "Reliez les places aux accès. Cliquez et glissez pour tracer une route.",
  },
  {
    id: "parking",
    label: "Place",
    price: 60,
    key: "2",
    description: "Orientez l’ouverture vers une route avec R.",
  },
  {
    id: "crossing",
    label: "Passage",
    price: 80,
    key: "3",
    description:
      "Posez un passage sur une route pour sécuriser le trajet vers le commerce.",
  },
  {
    id: "gate",
    label: "Sortie",
    price: 240,
    key: "4",
    description:
      "Sur une route, elle encaisse le stationnement à la sortie des clients.",
  },
  {
    id: "roundabout",
    label: "Rond-point",
    price: 280,
    key: "5",
    description: "Un carrefour de 3 × 3 cases qui fluidifie les déplacements.",
  },
  {
    id: "tree",
    label: "Arbre",
    price: 40,
    key: "6",
    description: "Améliore la satisfaction. Remplacé par une route.",
  },
  {
    id: "entry",
    label: "Entrée",
    price: 180,
    key: "7",
    description:
      "Créez un nouvel accès sur une route reliée à la voie publique.",
  },
  {
    id: "lamp",
    label: "Lampadaire",
    price: 30,
    key: "8",
    description: "Éclaire les allées. Remplacé automatiquement par une route.",
  },
  {
    id: "bench",
    label: "Banc",
    price: 25,
    key: "9",
    description: "Mobilier orientable. Remplacé automatiquement par une route.",
  },
  {
    id: "flowers",
    label: "Massif",
    price: 20,
    key: "0",
    description: "Massif de fleurs. Remplacé automatiquement par une route.",
  },
];

export const LEVELS = [
  {
    name: "Le marché des Tilleuls",
    type: "Épicerie de quartier",
    district: "Les Tilleuls",
    subtitle: "Les petites courses font les grands débuts.",
    budget: 4820,
    capacity: 24,
    crossings: 2,
    clients: 30,
    satisfaction: 80,
    demand: 7.5,
    shopping: 20,
    upkeep: 8,
    reward: 1800,
    color: "#7e9f75",
    shop: "LES TILLEULS",
    roof: "#76917d",
  },
  {
    name: "Supermarché Bellevue",
    type: "Supermarché",
    district: "Bellevue",
    subtitle: "Plus de paniers. Plus de voitures. À vous de jouer.",
    budget: 6500,
    capacity: 36,
    crossings: 3,
    clients: 65,
    satisfaction: 82,
    demand: 4.5,
    shopping: 26,
    upkeep: 13,
    reward: 3500,
    color: "#7998ac",
    shop: "BELLEVUE",
    roof: "#7593a8",
  },
  {
    name: "Les Galeries du Parc",
    type: "Centre commercial",
    district: "Le Grand Parc",
    subtitle: "Un grand terrain pour vos plus belles idées.",
    budget: 9000,
    capacity: 50,
    crossings: 4,
    clients: 100,
    satisfaction: 85,
    demand: 2.8,
    shopping: 32,
    upkeep: 19,
    reward: 6000,
    color: "#a38baf",
    shop: "LES GALERIES",
    roof: "#9983a5",
  },
] as const;

export const CAR_COLORS = [
  "#dc9a65",
  "#7fa8a0",
  "#e3bb68",
  "#9a99bf",
  "#ce8586",
  "#7395b5",
  "#d2d2c4",
  "#a4b578",
];
export const STORAGE_KEY = "parkside-save-v1";
export const euro = (value: number, decimals = 0) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(value)} €`;

export const TILE_LABELS: Record<TileKind, string> = {
  grass: "Terrain",
  road: "Route",
  parking: "Place",
  crossing: "Passage piéton",
  entry: "Entrée",
  gate: "Sortie",
  roundabout: "Rond-point",
  tree: "Arbre",
  lamp: "Lampadaire",
  bench: "Banc",
  flowers: "Massif",
  path: "Accès du magasin",
  store: "Commerce",
};

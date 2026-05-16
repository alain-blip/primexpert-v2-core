/** Régions sociosanitaires QC — port Copilote (ISQ/MSSS 2024). */

export interface QuebecRegionRow {
  code: string;
  name: string;
  aliases: string[];
  dominantCity: string;
  population70plus: number;
  rpaUnits: number;
  refYear: number;
  isSubregionOf?: string | null;
}

export const REGIONS_QUEBEC: Record<string, QuebecRegionRow> = {
  "10": {
    "code": "10",
    "name": "Nord-du-Québec",
    "aliases": [
      "nord-du-québec",
      "chibougamau",
      "chapais",
      "lebel-sur-quevillon"
    ],
    "dominantCity": "Chibougamau",
    "population70plus": 4200,
    "rpaUnits": 150,
    "refYear": 2024,
    "isSubregionOf": null
  },
  "11": {
    "code": "11",
    "name": "Gaspésie–Îles-de-la-Madeleine",
    "aliases": [
      "gaspésie",
      "îles-de-la-madeleine",
      "gaspé",
      "matane"
    ],
    "dominantCity": "Gaspé",
    "population70plus": 19200,
    "rpaUnits": 1100,
    "refYear": 2024
  },
  "12": {
    "code": "12",
    "name": "Chaudière-Appalaches",
    "aliases": [
      "chaudière-appalaches",
      "lévis",
      "beauce",
      "thetford"
    ],
    "dominantCity": "Lévis",
    "population70plus": 74000,
    "rpaUnits": 5400,
    "refYear": 2024
  },
  "13": {
    "code": "13",
    "name": "Laval",
    "aliases": [
      "laval"
    ],
    "dominantCity": "Laval",
    "population70plus": 65000,
    "rpaUnits": 5800,
    "refYear": 2024
  },
  "14": {
    "code": "14",
    "name": "Lanaudière",
    "aliases": [
      "lanaudière",
      "joliette",
      "terrebonne",
      "repentigny"
    ],
    "dominantCity": "Terrebonne",
    "population70plus": 72000,
    "rpaUnits": 4900,
    "refYear": 2024
  },
  "15": {
    "code": "15",
    "name": "Laurentides",
    "aliases": [
      "laurentides",
      "saint-jérôme",
      "mont-laurier",
      "blainville"
    ],
    "dominantCity": "Saint-Jérôme",
    "population70plus": 85000,
    "rpaUnits": 6200,
    "refYear": 2024
  },
  "16": {
    "code": "16",
    "name": "Montérégie",
    "aliases": [
      "montérégie",
      "longueuil",
      "brossard",
      "saint-hyacinthe",
      "granby",
      "saint-jean-sur-richelieu"
    ],
    "dominantCity": "Longueuil",
    "population70plus": 225000,
    "rpaUnits": 17500,
    "refYear": 2024
  },
  "17": {
    "code": "17",
    "name": "Nunavik",
    "aliases": [
      "nunavik",
      "kuujjuaq",
      "inukjuak",
      "puvirnituq"
    ],
    "dominantCity": "Kuujjuaq",
    "population70plus": 1200,
    "rpaUnits": 50,
    "refYear": 2024,
    "isSubregionOf": null
  },
  "18": {
    "code": "18",
    "name": "Terres-Cries-de-la-Baie-James",
    "aliases": [
      "terres-cries",
      "cree",
      "eeyou-istchee",
      "chisasibi",
      "mistissini"
    ],
    "dominantCity": "Chisasibi",
    "population70plus": 800,
    "rpaUnits": 30,
    "refYear": 2024,
    "isSubregionOf": null
  },
  "01": {
    "code": "01",
    "name": "Bas-Saint-Laurent",
    "aliases": [
      "bas-saint-laurent",
      "bsl",
      "rimouski"
    ],
    "dominantCity": "Rimouski",
    "population70plus": 42800,
    "rpaUnits": 3200,
    "refYear": 2024
  },
  "02": {
    "code": "02",
    "name": "Saguenay–Lac-Saint-Jean",
    "aliases": [
      "saguenay",
      "lac-saint-jean",
      "slsj",
      "chicoutimi"
    ],
    "dominantCity": "Saguenay",
    "population70plus": 52100,
    "rpaUnits": 4100,
    "refYear": 2024
  },
  "03": {
    "code": "03",
    "name": "Capitale-Nationale",
    "aliases": [
      "capitale-nationale",
      "québec",
      "quebec"
    ],
    "dominantCity": "Québec",
    "population70plus": 135000,
    "rpaUnits": 12500,
    "refYear": 2024
  },
  "04": {
    "code": "04",
    "name": "Mauricie et Centre-du-Québec",
    "aliases": [
      "mauricie",
      "centre-du-québec",
      "trois-rivières",
      "shawinigan",
      "drummondville",
      "victoriaville"
    ],
    "dominantCity": "Trois-Rivières",
    "population70plus": 98500,
    "rpaUnits": 6800,
    "refYear": 2024
  },
  "05": {
    "code": "05",
    "name": "Estrie",
    "aliases": [
      "estrie",
      "sherbrooke",
      "cantons-de-l'est"
    ],
    "dominantCity": "Sherbrooke",
    "population70plus": 62000,
    "rpaUnits": 5100,
    "refYear": 2024
  },
  "06": {
    "code": "06",
    "name": "Montréal",
    "aliases": [
      "montréal",
      "montreal",
      "mtl"
    ],
    "dominantCity": "Montréal",
    "population70plus": 285000,
    "rpaUnits": 24500,
    "refYear": 2024
  },
  "07": {
    "code": "07",
    "name": "Outaouais",
    "aliases": [
      "outaouais",
      "gatineau",
      "hull"
    ],
    "dominantCity": "Gatineau",
    "population70plus": 58000,
    "rpaUnits": 4200,
    "refYear": 2024
  },
  "08": {
    "code": "08",
    "name": "Abitibi-Témiscamingue",
    "aliases": [
      "abitibi",
      "témiscamingue",
      "rouyn-noranda",
      "val-d'or"
    ],
    "dominantCity": "Rouyn-Noranda",
    "population70plus": 24500,
    "rpaUnits": 1600,
    "refYear": 2024
  },
  "09": {
    "code": "09",
    "name": "Côte-Nord",
    "aliases": [
      "côte-nord",
      "cote-nord",
      "baie-comeau",
      "sept-îles"
    ],
    "dominantCity": "Sept-Îles",
    "population70plus": 14800,
    "rpaUnits": 900,
    "refYear": 2024
  }
};

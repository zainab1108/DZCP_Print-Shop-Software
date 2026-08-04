import type { DecorationMethod } from "@/generated/prisma/client";

export const DECORATION_METHODS: DecorationMethod[] = [
  "SCREEN_PRINT",
  "DTF",
  "EMBROIDERY",
  "LASER_ENGRAVING",
  "PROMOTIONAL",
];

export const METHOD_LABELS: Record<DecorationMethod, string> = {
  SCREEN_PRINT: "Screen printing",
  DTF: "Direct to film (DTF)",
  EMBROIDERY: "Embroidery",
  LASER_ENGRAVING: "Laser engraving",
  PROMOTIONAL: "Promotional products",
};

/**
 * What the grid's tier axis usually means for each method — used as a starting
 * point when creating a grid. Always editable: a shop may price DTF by size
 * bands, embroidery by stitch count, etc.
 */
export const DEFAULT_TIER_LABELS: Record<DecorationMethod, string> = {
  SCREEN_PRINT: "Colors",
  DTF: "Size",
  EMBROIDERY: "Stitch count (k)",
  LASER_ENGRAVING: "Area (sq in)",
  PROMOTIONAL: "Tier",
};

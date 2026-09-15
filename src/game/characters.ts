export interface CharacterDef {
  id: string;
  name: string;
  body: number;
  accent: number;
  silhouette: { width: number; height: number; length: number };
}

// SPEC-M2 §6. Names/palettes are placeholders — data only, rename freely.
export const CHARACTERS: CharacterDef[] = [
  { id: 'rex', name: 'Rex', body: 0xff3355, accent: 0xffcc33, silhouette: { width: 1, height: 1, length: 1 } },
  { id: 'bruno', name: 'Bruno', body: 0x557744, accent: 0xdddd33, silhouette: { width: 1.15, height: 1.1, length: 1.1 } },
  { id: 'mika', name: 'Mika', body: 0x33ccee, accent: 0xffffff, silhouette: { width: 0.9, height: 0.95, length: 0.9 } },
  { id: 'nyx', name: 'Nyx', body: 0xaa33ee, accent: 0x22ffaa, silhouette: { width: 1, height: 1.25, length: 0.95 } },
];

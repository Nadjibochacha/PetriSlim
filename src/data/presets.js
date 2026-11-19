export const PRESET_NETS = [
  {
    id: 'demo-all-rules',
    name: 'Démo Complète (Les 6 Règles)',
    description: 'Réseau conçu pour déclencher successivement les 6 techniques de réduction.',
    net: {
      places: [
        { id: 'p1', label: 'P1', tokens: 1, x: 100, y: 200 },
        { id: 'p2', label: 'P2', tokens: 0, x: 300, y: 120 },
        { id: 'p3', label: 'P3', tokens: 0, x: 300, y: 280 }, // Identical to P2 (Rule 2)
        { id: 'p4', label: 'P4', tokens: 0, x: 500, y: 200 }, // Substitutable place (Rule 1)
        { id: 'p5', label: 'P5', tokens: 0, x: 700, y: 200 }, // Series with P6 (Rule 5)
        { id: 'p6', label: 'P6', tokens: 1, x: 900, y: 200 },
        { id: 'p7', label: 'P7', tokens: 1, x: 100, y: 60 },  // Identity Place self-loop (Rule 6)
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 200, y: 200 },
        { id: 't2', label: 'T2', x: 400, y: 140 },
        { id: 't3', label: 'T3', x: 400, y: 260 }, // Identical to T2 (Rule 4)
        { id: 't4', label: 'T4', x: 600, y: 200 },
        { id: 't5', label: 'T5', x: 800, y: 200 }, // Strict series transition (Rule 5)
        { id: 't6', label: 'T6', x: 500, y: 360 }, // Return loop to P1
        { id: 't7', label: 'T7', x: 900, y: 60 },  // Identity Transition self-loop (Rule 3)
      ],
      arcs: [
        // Rule 6: P7 self-loop on T1
        { id: 'a1', source: 'p7', target: 't1', weight: 1 },
        { id: 'a2', source: 't1', target: 'p7', weight: 1 },

        // P1 -> T1 -> (P2 || P3) -> (T2 || T3) -> P4
        { id: 'a3', source: 'p1', target: 't1', weight: 1 },
        { id: 'a4', source: 't1', target: 'p2', weight: 1 },
        { id: 'a5', source: 't1', target: 'p3', weight: 1 },
        { id: 'a6', source: 'p2', target: 't2', weight: 1 },
        { id: 'a7', source: 'p3', target: 't2', weight: 1 },
        { id: 'a8', source: 'p2', target: 't3', weight: 1 },
        { id: 'a9', source: 'p3', target: 't3', weight: 1 },
        { id: 'a10', source: 't2', target: 'p4', weight: 1 },
        { id: 'a11', source: 't3', target: 'p4', weight: 1 },

        // Rule 1: P4 -> T4 -> P5
        { id: 'a12', source: 'p4', target: 't4', weight: 1 },
        { id: 'a13', source: 't4', target: 'p5', weight: 1 },

        // Rule 5: P5 -> T5 -> P6
        { id: 'a14', source: 'p5', target: 't5', weight: 1 },
        { id: 'a15', source: 't5', target: 'p6', weight: 1 },

        // Rule 3: T7 self-loop on P6
        { id: 'a16', source: 'p6', target: 't7', weight: 1 },
        { id: 'a17', source: 't7', target: 'p6', weight: 1 },

        // Cycle back: P6 -> T6 -> P1
        { id: 'a18', source: 'p6', target: 't6', weight: 1 },
        { id: 'a19', source: 't6', target: 'p1', weight: 1 },
      ],
    },
  },
  {
    id: 'producer-consumer',
    name: 'Producteur / Consommateur',
    description: 'Illustre la réduction de l’explosion combinatoire des états.',
    net: {
      places: [
        { id: 'p1', label: 'ProdPrêt', tokens: 2, x: 120, y: 120 },
        { id: 'p2', label: 'EnCours', tokens: 0, x: 320, y: 120 },
        { id: 'p3', label: 'Tampon1', tokens: 0, x: 520, y: 80 },
        { id: 'p4', label: 'Tampon2', tokens: 0, x: 520, y: 180 },
        { id: 'p5', label: 'ConsPrêt', tokens: 1, x: 720, y: 120 },
      ],
      transitions: [
        { id: 't1', label: 'Produire', x: 220, y: 120 },
        { id: 't2', label: 'Déposer', x: 420, y: 120 },
        { id: 't3', label: 'Consommer', x: 620, y: 120 },
      ],
      arcs: [
        { id: 'pc1', source: 'p1', target: 't1', weight: 1 },
        { id: 'pc2', source: 't1', target: 'p2', weight: 1 },
        { id: 'pc3', source: 'p2', target: 't2', weight: 1 },
        { id: 'pc4', source: 't2', target: 'p3', weight: 1 },
        { id: 'pc5', source: 't2', target: 'p4', weight: 1 },
        { id: 'pc6', source: 'p3', target: 't3', weight: 1 },
        { id: 'pc7', source: 'p4', target: 't3', weight: 1 },
        { id: 'pc8', source: 't3', target: 'p5', weight: 1 },
        { id: 'pc9', source: 'p5', target: 't1', weight: 1 },
      ],
    },
  },
  {
    id: 'identity-loops',
    name: 'Boucles Identités (Règles 3 & 6)',
    description: 'Teste la suppression d’une transition neutre et d’une place auto-bouclée.',
    net: {
      places: [
        { id: 'p1', label: 'P1', tokens: 1, x: 150, y: 180 },
        { id: 'p2', label: 'P2_Loop', tokens: 2, x: 350, y: 80 },
        { id: 'p3', label: 'P3', tokens: 0, x: 550, y: 180 },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 350, y: 180 },
        { id: 't2', label: 'T2_Neutral', x: 150, y: 80 },
      ],
      arcs: [
        { id: 'il1', source: 'p1', target: 't1', weight: 1 },
        { id: 'il2', source: 't1', target: 'p3', weight: 1 },
        // Rule 6: P2 self-loops on T1
        { id: 'il3', source: 'p2', target: 't1', weight: 1 },
        { id: 'il4', source: 't1', target: 'p2', weight: 1 },
        // Rule 3: T2 self-loops on P1
        { id: 'il5', source: 'p1', target: 't2', weight: 1 },
        { id: 'il6', source: 't2', target: 'p1', weight: 1 },
      ],
    },
  },
];
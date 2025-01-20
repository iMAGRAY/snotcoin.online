export interface Ball {
  id: number;
  x: number;
  y: number;
  level: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  isExplosive?: boolean;
  isExploding?: boolean;
  isBull?: boolean;
  throwTime: number;
  sleeping: boolean;
}

export interface BallLevel {
  level: number;
  size: number;
  image: string;
}

export const EXPLOSIVE_BALL = {
  level: -2,
  size: 25,
  image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Explosive%20Ball-hsOK11hLnlg4hOQr8eVTUm978oJrx8.webp",
  explosionRadius: 100,
};

export const BULL_BALL = {
  level: -1,
  size: 50,
  image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Bull-1M7D5LosFxR8JboQnnnwCR7xnXoZb2.webp",
};

export const BALL_LEVELS: BallLevel[] = [
  { level: 1, size: 15, image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-ZmipK1uuk8QxMKzDduGxBOGKZZ2Rcc.webp" },
  { level: 2, size: 25, image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/2-eyZRTuRxmnsVn1xoQP3S0NzHBwjnkv.webp" },
  { level: 3, size: 40, image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/3-hV2oI70qTOCB36XL21VqkcKRcJFisK.webp" },
  { level: 4, size: 50, image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/4-iyni2xVHd7r3raUug7YoRVFwoy2ml4.webp" },
  { level: 5, size: 65, image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/5-Fh2rp7PQJRDrVIVtdoxm5NwDZZ0vKX.webp" },
  { level: 6, size: 90, image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/6-hdt8hVMmSLD3AQHnM2V90lqq4JOvd4.webp" },
  { level: 7, size: 110, image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/7-9CoJRA8dYdK3RX7y0T5yTNjS88hUA5.webp" },
  { level: 8, size: 130, image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/8-XZUxvzL89WqoqsevBz5OTDJosSWEPi.webp" },
  { level: 9, size: 150, image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/9-lvl0RY4p49rq34JjQutocHvBFRdQxs.webp" },
  { level: 10, size: 170, image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/10-7Jr5LtYXWFRq1kKlWm9a4UlPrIHijV.webp" },
  { level: 11, size: 190, image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/11-YY8OurxQ4teAsqFtjlW4A3h75R3uHh.webp" },
];

export const GAME_CONSTANTS = {
  GRAVITY: 0.15,
  BOUNCE_FACTOR: 0.5,
  COLLISION_DAMPING: 0.8,
  POSITION_CORRECTION_FACTOR: 0.8,
  MINIMUM_VELOCITY: 0.01,
  AIR_RESISTANCE: 0.99,
  UNIFORM_BALL_MASS: 1,
  GAME_WIDTH: 300,
  GAME_HEIGHT: 380,
  WALL_WIDTH: 15,
  FOOTER_HEIGHT: 40,
  HEADER_HEIGHT: 56,
  LAUNCHER_Y: 50,
  MINIMUM_MOVEMENT_THRESHOLD: 0.05,
  RESTITUTION: 0.3,
};


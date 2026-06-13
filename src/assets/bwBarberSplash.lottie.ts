export const bwBarberSplashLottie = {
  v: '5.12.2',
  nm: 'BW Barber Splash',
  fr: 60,
  ip: 0,
  op: 168,
  w: 512,
  h: 512,
  meta: {
    product: 'BW Barber',
    durationMs: 2800,
    renderer: 'svg-css',
  },
  layers: [
    {
      nm: 'cyan_glow',
      ty: 4,
      ks: {
        o: { k: [{ t: 0, s: [0] }, { t: 48, s: [35] }, { t: 132, s: [18] }] },
        p: { k: [256, 256, 0] },
        s: { k: [{ t: 0, s: [62, 62, 100] }, { t: 96, s: [105, 105, 100] }] },
      },
    },
    {
      nm: 'symbol_lines',
      ty: 4,
      ks: {
        o: { k: [{ t: 0, s: [0] }, { t: 18, s: [100] }, { t: 150, s: [92] }] },
        p: { k: [256, 238, 0] },
      },
    },
    {
      nm: 'logo_reveal',
      ty: 2,
      ks: {
        o: { k: [{ t: 28, s: [0] }, { t: 72, s: [100] }] },
        p: { k: [256, 238, 0] },
        s: { k: [{ t: 28, s: [94, 94, 100] }, { t: 82, s: [100, 100, 100] }] },
      },
    },
    {
      nm: 'loading_text',
      ty: 5,
      t: {
        d: {
          k: [
            {
              s: {
                t: 'Entrando no BW Barber',
                s: 18,
                fc: [0.72, 0.94, 1],
              },
            },
          ],
        },
      },
      ks: {
        o: { k: [{ t: 58, s: [0] }, { t: 92, s: [100] }] },
        p: { k: [256, 390, 0] },
      },
    },
  ],
} as const

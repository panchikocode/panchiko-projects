/* =========================================================================
   main.js — cartridge boot vector.
   ========================================================================= */
'use strict';

window.addEventListener('load', () => {
  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: VW,
    height: VH,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    backgroundColor: '#05040a',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      zoom: 1
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: GRAV }, debug: false, fps: 60, tileBias: 20 }
    },
    fps: { target: 60, forceSetTimeOut: false },
    scene: [BootScene, TitleScene, GameScene, HudScene, EndScene]
  };

  const game = new Phaser.Game(config);
  window.__game = game;

  /* a lost WebGL context leaves a blank canvas that still swallows clicks —
     the app looks alive and is not. surface it and offer a reload. */
  const canvas = game.canvas;
  const lost = document.getElementById('lost');
  if (canvas) {
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      try { SND.stop(); } catch (err) { /* audio may never have started */ }
      if (lost) {
        lost.style.display = 'flex';
        const reload = () => location.reload();
        lost.addEventListener('click', reload, { once: true });
        window.addEventListener('keydown', reload, { once: true });
      }
    }, false);
    canvas.addEventListener('webglcontextrestored', () => location.reload(), false);
  }

  /* the audio context may only start after a real gesture */
  const wake = () => { SND.init(); SND.resume(); };
  window.addEventListener('keydown', wake, { once: true });
  window.addEventListener('pointerdown', wake, { once: true });
});

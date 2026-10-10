// Phase 2B / V-32: place the Inkdrop window at a fixed position and size (screen points) so every
// native capture uses the same geometry. The original geometry is restored with config.json at the end.
(async () => {
  inkdrop.window.setSize(1200, 700);
  inkdrop.window.setPosition(400, 250);
  await new Promise((r) => setTimeout(r, 500));
  return { screen: [screenX, screenY, outerWidth, outerHeight], viewport: [innerWidth, innerHeight, devicePixelRatio] };
})();

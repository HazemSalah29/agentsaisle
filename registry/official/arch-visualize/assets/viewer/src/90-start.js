// ---- start: draw, then restore the view from the address if it has one
setLens(lens);
fit();
renderPanel();
applyLink(ArchHash.parseHash(location.hash));

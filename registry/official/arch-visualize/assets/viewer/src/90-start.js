// ---- start: draw, then restore the view from the address if it has one
fit();
renderPanel();
applyLink(ArchHash.parseHash(location.hash));

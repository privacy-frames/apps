# Privacy Frames applications

Maintained security examples and licensed upstream applications for evaluating
[Privacy Frames](https://github.com/privacy-frames/host).

This is an unrestricted publisher site. Applications become confined only after
installation through the trusted host at https://pf.damenh.com/.

Build with `npm ci && npm run build`. Output is static GitHub Pages content.
Mirrored archives and corresponding source are pinned in `mirrors/lock.json`;
the build verifies their SHA256 before extracting and records URL relocations.

The public catalogue is https://privacy-frames.github.io/apps/. Maintained examples
live in `examples/`. Mirrors of Squoosh, Excalidraw, StackEdit and draw.io are
captured in the pinned release archives, with original per-file hashes and notices.
Squoosh's ImageQuant Wasm matches the distributed GPL source and wrapper/build files.

The build relocates known root-relative resources into `/apps/<name>/`, preserves
relative URL semantics and records each changed file in `MODIFICATIONS.json`.
Squoosh's `/editor` client route is declared as an additional relocation path.
Application behavior is evaluated after relocation; this packaging grants no host
capabilities. The site includes links to externally hosted PhotoCraft, Pitch
Training, Wikipedia HTML and CyberChef.

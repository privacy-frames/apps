# Examples and security fixtures

The examples are ordinary websites. Install their webpage URLs in Privacy Frames;
none uses a host-specific installation manifest.

- **notes** combines local note editing with an installed JSON article and image.
  It uses React and standard service-worker precaching.
- **playground** provides editable HTML, CSS and JavaScript with a default network
  disclosure attempt.
- **adversary** keeps focused browser escape probes and unrestricted controls.
- **image** is a small native canvas fixture for private pixels and file input.
- **ordinary** is a minimal precache compatibility fixture. Its `document/`
  directory checks generic document import, CSS dependencies and PWA metadata.

`npm run build:examples` compiles TypeScript and React into `dist-examples/`.
Publisher assets must be served on an origin separate from both trusted host
origins. The configurations in `deployment/examples/` preserve the independent
static publisher domains. The playground is also included in the adversary
publisher at `/playground/`.

Opening a fixture directly runs it outside confinement. Use diagnostic values
when running the hostile probes.

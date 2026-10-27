# Maintained examples

- `notes`: React notebook with local persistence, JSON and image resources, and a
  conventional precache worker.
- `adversary`: direct API and browser-event disclosure attempts.
- `playground`: editable HTML, CSS and JavaScript with a default disclosure attempt.
- `image`: private file/pixel fixture used by security tests.
- `ordinary`: small import, document, service-worker preparation and Wasm fixtures.

Run `npm run build:examples` to write `dist-examples/`, or pass `--output /path`.
The Pages build includes these directories beside the licensed application mirrors.

Opening these URLs directly runs application code outside confinement. Install an
application through the trusted host to evaluate its confined behavior. Use
synthetic values for hostile probes.

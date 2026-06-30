# London Underground DAKboard

Live London Underground and Elizabeth line status dashboards plus
DAKboard-friendly widgets using Transport for London's public Unified API.

## Files

- `index.html` - original dashboard.
- `responsive.html` - viewport-fitting dashboard that adapts as the browser is resized.
- `dakboard-widget.html` - static DAKboard iframe widget.
- `dakboard-json-server.mjs` - small Node server exposing a JSON endpoint.
- `dakboard-json-endpoint.md` - JSON endpoint usage notes.

## Local Preview

Static dashboards:

```sh
npm run static
```

Then open:

```text
http://localhost:8000/
http://localhost:8000/responsive.html
http://localhost:8000/dakboard-widget.html
```

JSON endpoint:

```sh
npm start
```

Then open:

```text
http://127.0.0.1:8787/api/tube-status.json
```

## DAKboard

For the iframe widget, host `dakboard-widget.html` somewhere public over HTTPS,
then add it to DAKboard as a Website/iframe block.

Examples:

```text
/dakboard-widget.html
/dakboard-widget.html?show=issues
/dakboard-widget.html?layout=grid&theme=transparent&title=0&meta=0
/dakboard-widget.html?lines=central,elizabeth,jubilee,piccadilly,victoria
```

For JSON/external data blocks, deploy the Node server and use:

```text
/api/tube-status.json
/api/tube-status.json?show=issues
/api/tube-status.json?lines=central,elizabeth,jubilee,piccadilly,victoria
```

## Notes

The browser widgets fetch live data directly from:

```text
https://api.tfl.gov.uk/Line/Mode/tube/Status
https://api.tfl.gov.uk/Line/Mode/elizabeth-line/Status
```

The JSON server caches TfL responses briefly to avoid unnecessary API traffic.

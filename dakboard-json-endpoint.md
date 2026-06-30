# DAKboard Tube Status JSON Endpoint

Run the endpoint server:

```sh
node dakboard-json-server.mjs
```

Default local JSON URL:

```text
http://127.0.0.1:8787/api/tube-status.json
```

DAKboard needs a public HTTPS URL, so deploy `dakboard-json-server.mjs`
to a small Node-capable host, then use the hosted endpoint in a DAKboard
External Data or JSON-powered block.

## Query Parameters

```text
/api/tube-status.json
/api/tube-status.json?pretty=1
/api/tube-status.json?show=issues
/api/tube-status.json?lines=central,jubilee,piccadilly,victoria
/api/tube-status.json?show=issues&lines=central,jubilee&pretty=1
```

- `lines`: comma-separated TfL line IDs.
- `show=issues`: return only disrupted lines.
- `pretty=1`: format JSON for easier inspection.

Line IDs:

```text
bakerloo, central, circle, district, hammersmith-city, jubilee,
metropolitan, northern, piccadilly, victoria, waterloo-city
```

## Response Shape

```json
{
  "updatedAt": "2026-06-30T06:00:00.000Z",
  "source": "Transport for London Unified API",
  "sourceUrl": "https://api.tfl.gov.uk/Line/Mode/tube/Status",
  "summary": {
    "selected": 11,
    "returned": 11,
    "goodService": 11,
    "issues": 0,
    "message": "All selected Tube lines are reporting good service."
  },
  "lines": [
    {
      "id": "central",
      "name": "Central",
      "colour": "#E32017",
      "zones": "Zones 1-6",
      "status": "Good Service",
      "severity": 10,
      "tone": "good",
      "disrupted": false,
      "reason": "No current disruptions reported by TfL.",
      "validityPeriods": []
    }
  ]
}
```

The server caches TfL responses for 30 seconds by default. Override with:

```sh
CACHE_SECONDS=60 PORT=8787 node dakboard-json-server.mjs
```

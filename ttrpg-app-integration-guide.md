# TTRPG App Integration Guide — Home Assistant Lighting Engine

This document provides complete instructions for developers and external companion apps (web dashboards, native desktop/tablet apps, stream decks, or soundboards) to discover, display, and trigger lighting cues managed by this Home Assistant pipeline.

---

## 1. Network & API Setup

### Do I need to open ports?
- **Default Port**: Home Assistant operates on HTTP port **`8123`** (or `443` if using an SSL/reverse proxy like NGINX/Cloudflare).
- **Default Enabled**: The Home Assistant REST API is enabled out-of-the-box via `default_config:`. No extra YAML ports or firewall changes are required on the Home Assistant machine unless a host firewall is actively blocking port `8123`.
- **CORS (Only for Browser-based Web Apps)**: If your TTRPG app is hosted in a web browser on a different domain/port (e.g. `http://localhost:3000`), add CORS authorization to `/config/configuration.yaml` in Home Assistant:
  ```yaml
  http:
    cors_allowed_origins:
      - "http://localhost:3000"
      - "http://192.168.178.*"
  ```

### Authentication: Long-Lived Access Token
The external app authenticates using a **Long-Lived Access Token**:

1. In Home Assistant, click your user profile icon (bottom left).
2. Go to the **Security** tab.
3. Scroll down to **Long-Lived Access Tokens** $\to$ click **Create Token**.
4. Name the token (e.g., `TTRPG Companion App`) and copy the generated token string.

---

## 2. API Contract & Manifest (`ttrpg_cues.json`)

The generator emits a single, stable JSON manifest at [`manifest/ttrpg_cues.json`](file:///c:/Users/lukas/Documents/GitHub/HA_stuff/manifest/ttrpg_cues.json). The external app should consume this manifest to build its UI.

### Manifest Schema (Version 1)

```json
{
  "schema_version": 1,
  "generated_at": "2026-08-15T06:03:04Z",
  "channels": ["dm", "t1", "t2", "t3", "t4"],
  "systems": [
    { "id": "dnd5e", "label": "D&D 5e", "description": "High fantasy adventure..." },
    { "id": "cthulhu", "label": "Call of Cthulhu", "description": "1920s cosmic horror..." },
    { "id": "mothership", "label": "Mothership", "description": "Sci-fi survival horror..." },
    { "id": "core", "label": "Core / Utility", "description": "Neutral utility lighting..." }
  ],
  "categories": [
    "combat", "environment", "exploration", "rest", "social", "suspense", "utility"
  ],
  "total_cues": 220,
  "cues": [
    {
      "id": "dnd5e_dungeon_tense",
      "entity_id": "scene.ttrpg_dnd5e_dungeon_tense",
      "system": "dnd5e",
      "mood": "dungeon",
      "intensity": "tense",
      "category": "exploration",
      "label": "D&D 5e — Dungeon (Tense)",
      "description": "Guttering torchlight with cold shadow beyond the circle.",
      "tags": ["indoor", "dark", "exploration", "subterranean"],
      "transition_s": 3.0,
      "readable": true,
      "fx": "script.ttrpg_fx_torch_flicker",
      "preview": ["#cc7e14", "#2c2957", "#2b2656", "#292455", "#282155"]
    }
  ]
}
```

### Visual Preview Swatches
- `preview`: Array of 5 hex color codes in physical channel order: `[dm, t1, t2, t3, t4]`.
- Use `preview[0]` for the DM spotlight indicator.
- Use `preview[1..4]` to render a continuous CSS gradient across the tabletop representation:
  ```css
  background: linear-gradient(90deg, #2c2957 0%, #2b2656 33%, #292455 66%, #282155 100%);
  ```

---

## 3. Triggering Lighting Cues

The external app **only ever needs to call one unified endpoint**: `POST /api/services/script/ttrpg_cue`.

### Endpoint Specification

- **Method**: `POST`
- **URL**: `http://<HA_IP>:8123/api/services/script/ttrpg_cue`
- **Headers**:
  ```http
  Authorization: Bearer <YOUR_LONG_LIVED_ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Body Payload**:
  ```json
  {
    "scene_id": "scene.ttrpg_dnd5e_dungeon_tense",
    "fx_script": "script.ttrpg_fx_torch_flicker",
    "transition_s": 2.5
  }
  ```

### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `scene_id` | `string` | **Yes** | — | The scene entity to apply (from `cue.entity_id`). |
| `fx_script` | `string` | No | `null` | Companion FX script to start (from `cue.fx`). If `null` or omitted, only static lights apply. |
| `transition_s` | `number` | No | `2.5` | Fade transition time in seconds. |

---

## 4. Code Examples

### JavaScript / TypeScript (Fetch API)

```typescript
interface TriggerCueParams {
  haUrl: string;       // e.g. "http://192.168.178.167:8123"
  token: string;       // Long-lived access token
  sceneId: string;     // e.g. "scene.ttrpg_dnd5e_dungeon_tense"
  fxScript?: string;   // e.g. "script.ttrpg_fx_torch_flicker"
  transitionSec?: number;
}

async function triggerTtrpgCue({
  haUrl,
  token,
  sceneId,
  fxScript,
  transitionSec = 2.5
}: TriggerCueParams): Promise<void> {
  const url = `${haUrl.replace(/\/$/, '')}/api/services/script/ttrpg_cue`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scene_id: sceneId,
      fx_script: fxScript || 'none',
      transition_s: transitionSec,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to trigger cue (${response.status}): ${errorText}`);
  }
}
```

### Python (Requests / aiohttp)

```python
import requests

HA_URL = "http://192.168.178.167:8123"
TOKEN = "YOUR_LONG_LIVED_ACCESS_TOKEN"

def set_ttrpg_cue(scene_id: str, fx_script: str = None, transition_s: float = 2.5):
    endpoint = f"{HA_URL}/api/services/script/ttrpg_cue"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "scene_id": scene_id,
        "fx_script": fx_script or "none",
        "transition_s": transition_s,
    }
    resp = requests.post(endpoint, json=payload, headers=headers, timeout=5.0)
    resp.raise_for_status()
```

### C# / Unity / .NET

```csharp
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

public class HomeAssistantClient
{
    private readonly HttpClient _http;
    private readonly string _haBaseUrl;

    public HomeAssistantClient(string haBaseUrl, string bearerToken)
    {
        _haBaseUrl = haBaseUrl.TrimEnd('/');
        _http = new HttpClient();
        _http.DefaultRequestHeaders.Add("Authorization", $"Bearer {bearerToken}");
    }

    public async Task TriggerCueAsync(string sceneId, string fxScript = null, float transitionSeconds = 2.5f)
    {
        var payload = new
        {
            scene_id = sceneId,
            fx_script = fxScript ?? "none",
            transition_s = transitionSeconds
        };

        var json = JsonConvert.SerializeObject(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _http.PostAsync($"{_haBaseUrl}/api/services/script/ttrpg_cue", content);
        response.EnsureSuccessStatusCode();
    }
}
```

### cURL (CLI / Shell Testing)

```bash
curl -X POST "http://192.168.178.167:8123/api/services/script/ttrpg_cue" \
  -H "Authorization: Bearer YOUR_LONG_LIVED_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scene_id": "scene.ttrpg_dnd5e_dungeon_tense",
    "fx_script": "script.ttrpg_fx_torch_flicker",
    "transition_s": 2.0
  }'
```

---

## 5. Built-in Backend Automations Handled by Home Assistant

Your app **does not** need to manage the following complex hardware state logic, because `script.ttrpg_cue` handles them automatically:

1. **Mains Relay Auto-Power & Boot Delay**: If the physical Sonoff ZBMiniL2 relay was powered off, `script.ttrpg_cue` turns the relay on and waits 2.0s for the Paulmann Zigbee radios to establish coordinator synchronization before firing the scene.
2. **FX Cancellation / Tear-down**: Triggering a new cue automatically stops any running ambient FX loops (`torch_flicker`, `pulse_slow`, `alert_sweep`, `heartbeat`) so animations never collide or accumulate.
3. **Hardware Floor & Overflow Protection**: All CIE 1931 $(x, y)$ coordinates in the catalog are clamped ($y \ge 0.12$, brightness $\ge 2$), guaranteeing the fixtures will not flicker or drop off.

---

## 6. Recommended App UI Features

1. **Quick Scene Presets**: Group cues by `system` and `category` (Combat, Exploration, Suspense, Social, Rest, Environment, Utility).
2. **Emergency Rules Lookup Button**: Bind a dedicated button to `scene.ttrpg_core_rules_lookup_standard` (neutral white, 85% brightness) for instant rulebook lookups.
3. **FX Toggle Indicator**: Show a badge if `cue.fx` is active.
4. **Readability Filter**: Highlight or filter by `cue.readable == true` for combat/reading scenarios vs `cue.readable == false` (cinematic blackouts).

# Deployment auth and LLM configuration

Flovart now treats authentication and provider/model/API-key setup as deployment-owned configuration.
End users should not add provider keys in the settings panel.

For local debugging only, user-managed API key configuration can be re-enabled with:

```bash
VITE_ENABLE_USER_API_KEY_CONFIG=true
```

## Logto authentication

Create a Logto SPA application in the self-hosted Logto console and configure:

- Redirect URI: `<app-origin>/callback`
- Post sign-out redirect URI: `<app-origin>/`
- Sign-in methods: phone, email, and WeChat in Logto Sign-in Experience

Environment variables:

```bash
VITE_LOGTO_ENABLED=true
VITE_LOGTO_ENDPOINT=https://logto.example.com
VITE_LOGTO_APP_ID=your-spa-app-id
VITE_LOGTO_RESOURCES=https://api.example.com
VITE_LOGTO_SCOPES=read,write
```

`VITE_LOGTO_RESOURCES` and `VITE_LOGTO_SCOPES` are optional comma-separated lists.
The app always requests Logto email, phone, and identities scopes so user identity can be displayed.
When Logto is configured, the workspace remains visible to anonymous visitors. Mutating actions such
as generation, upload, edit, drag/drop, paste, save, and canvas zoom/pan prompt the visitor to sign in.

## LLM configuration

Configure provider keys and supported models with `VITE_FLOVART_LLM_CONFIG`.
Image generation is the only exposed generation capability. The supported image models are:

- `gemini-3.1-flash-image-preview`
- `gpt-image-2`

```bash
VITE_FLOVART_LLM_CONFIG='{
  "modelPreference": {
    "textModel": "gemini-3-flash-preview",
    "imageModel": "gemini-3.1-flash-image-preview",
    "videoModel": ""
  },
  "providers": [
    {
      "id": "google-main",
      "name": "Google production",
      "provider": "google",
      "key": "AIza...",
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
      "capabilities": ["image"],
      "isDefault": true,
      "defaultModel": "gemini-3.1-flash-image-preview",
      "models": [
        { "id": "gemini-3.1-flash-image-preview", "name": "Gemini image" }
      ]
    },
    {
      "id": "openai-image",
      "name": "OpenAI image",
      "provider": "openai",
      "key": "sk-...",
      "baseUrl": "https://api.openai.com/v1",
      "capabilities": ["image"],
      "defaultModel": "gpt-image-2",
      "models": [
        { "id": "gpt-image-2", "name": "GPT Image 2" }
      ]
    }
  ]
}'
```

Runtime injection is also supported before the app bundle loads:

```html
<script>
  window.__FLOVART_CONFIG__ = {
    auth: {
      logto: {
        enabled: true,
        endpoint: 'https://logto.example.com',
        appId: 'your-spa-app-id',
        resources: ['https://api.example.com'],
        scopes: ['read', 'write']
      }
    },
    llm: {
      modelPreference: {
        textModel: 'gemini-3-flash-preview',
        imageModel: 'gemini-3.1-flash-image-preview',
        videoModel: ''
      },
      providers: []
    }
  };
</script>
```

## Security boundary

The current app is still a browser-side provider runtime. Any provider key configured through Vite
or `window.__FLOVART_CONFIG__` is visible to the browser. Production deployments should move provider
calls behind a backend gateway and let the browser send only the Logto access token to that gateway.

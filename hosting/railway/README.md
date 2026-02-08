# Railway Deployment

Deploy Colanode on [Railway](https://railway.app) using Railpack (no Dockerfiles needed). Two services — **server** and **web** — backed by Railway-managed Postgres and Redis.

## Build order

The root `package.json` includes convenience scripts that build dependency packages in the correct order. Set these as your build commands in Railway:

- `npm run build:server` — builds core, crdt, then server
- `npm run build:web` — builds core, crdt, client, ui, then web
- `npm run start:server` — runs the production server

## Setup

### 1. Add infrastructure services

In your Railway project, add:

- **PostgreSQL** — use the pgvector template or standard Postgres 17
- **Redis** — or Valkey

Railway provisions these and exposes connection URLs as reference variables.

### 2. Configure the server

The server loads its configuration from a JSON file specified by the `CONFIG` environment variable. A template is provided at `hosting/railway/config.json`.

**At minimum**, you must set the CORS origin to your web app's domain. Without this, the browser will block the web app from reaching the server API.

#### Option A: Use the repo config file (simplest)

The template at `hosting/railway/config.json` is deployed with your code. Set the env var:

```
CONFIG=hosting/railway/config.json
```

Edit the file to set your web app's domain:

```json
{
  "cors": {
    "origin": [
      "https://your.domain.com"
    ]
  }
}
```

This works for basic deployments but requires a commit and redeploy to change settings.

#### Option B: Use a Railway volume (recommended for production)

A volume lets you edit config without redeploying and keeps secrets out of the repo.

1. **Attach a volume** to the server service in Railway (e.g., mount path `/data`)
2. **Copy the template** into the volume by shelling into the service:

   ```bash
   railway shell
   cp hosting/railway/config.json /data/config.json
   ```

   Or create it directly:

   ```bash
   cat > /data/config.json << 'EOF'
   {
     "cors": {
       "origin": [
         "https://your.domain.com"
       ]
     }
   }
   EOF
   ```

3. **Set the env var** on the server service:

   ```
   CONFIG=/data/config.json
   ```

4. **Restart** the server service for the config to take effect.

To update config later, shell in again, edit `/data/config.json`, and restart.

### 3. Deploy the server

Create a new service in Railway:

- **Source**: Connect your GitHub repo
- **Root directory**: `/` (repo root, required for monorepo workspace resolution)

Set these in **Settings > Build & Deploy**:

| Setting            | Value                             |
|--------------------|-----------------------------------|
| **Build command**  | `npm run build:server`            |
| **Start command**  | `npm run start:server`            |
| **Watch paths**    | `packages/core/**`, `packages/crdt/**`, `apps/server/**` |

Set these environment variables:

| Variable       | Value                                                     |
|----------------|-----------------------------------------------------------|
| `NODE_ENV`     | `production`                                              |
| `POSTGRES_URL` | `${{Postgres.DATABASE_URL}}` (Railway reference variable) |
| `REDIS_URL`    | `${{Redis.REDIS_URL}}` (Railway reference variable)       |
| `PORT`         | `3000`                                                    |
| `CONFIG`       | `hosting/railway/config.json` or `/data/config.json`      |
| `ORIGIN`       | Your web app origin for CORS (e.g. `https://your.domain.com`) |
| `SERVER_NAME`  | Display name shown to users (e.g. `My Colanode Server`)   |

The default `hosting/railway/config.json` also enables Google OAuth and email verification. Set these additional variables on the server service:

**Google OAuth:**

| Variable              | Value                                       |
|-----------------------|---------------------------------------------|
| `GOOGLE_CLIENT_ID`    | Google Cloud OAuth 2.0 client ID            |
| `GOOGLE_CLIENT_SECRET`| Google Cloud OAuth 2.0 client secret        |

**Email (SMTP):**

| Variable              | Value                                       |
|-----------------------|---------------------------------------------|
| `EMAIL_FROM`          | Sender email address (e.g. `noreply@your.domain.com`) |
| `EMAIL_FROM_NAME`     | Sender display name (e.g. `Colanode`)       |
| `EMAIL_SMTP_HOST`     | SMTP server hostname (e.g. `smtp.gmail.com`)|
| `EMAIL_SMTP_USER`     | SMTP auth username                          |
| `EMAIL_SMTP_PASSWORD` | SMTP auth password or app-specific password |

### 4. Deploy the web app

Create a second service in Railway:

- **Source**: Connect the same GitHub repo
- **Root directory**: `/` (repo root)

Set these in **Settings > Build & Deploy**:

| Setting            | Value                                     |
|--------------------|-------------------------------------------|
| **Build command**  | `npm run build:web`                       |
| **Start command**  | `npx serve apps/web/dist -s -l 3000`     |
| **Watch paths**    | `packages/**`, `apps/web/**`              |

The `-s` flag enables SPA fallback (rewrites all routes to `index.html`).

### 5. Connect the web app to the server

After both services are deployed, open your web app. You'll see an "Add a server" dialog. Enter the server's config URL:

```
https://<your-server-domain>/config
```

For example: `https://colanodeserver-production.up.railway.app/config`

### 6. Networking

- Expose **public domains** on both services via Railway's settings.
- If the web app needs to reach the server internally, use Railway's private networking (e.g., `server.railway.internal:3000`).

## Additional configuration

All settings below go in the same `config.json` file. Combine them as needed.

### S3-compatible storage (Tigris)

Railway offers [Tigris Object Storage](https://docs.railway.com/guides/object-storage) which is S3-compatible. Add a Tigris volume to your project, then link it to the server service — Railway auto-populates the environment variables.

Add to your `config.json`:

```json
{
  "cors": {
    "origin": ["https://your.domain.com"]
  },
  "storage": {
    "provider": {
      "type": "s3",
      "endpoint": "env://BUCKET_ENDPOINT",
      "accessKey": "env://AWS_ACCESS_KEY_ID",
      "secretKey": "env://AWS_SECRET_ACCESS_KEY",
      "bucket": "env://BUCKET_NAME",
      "region": "env://AWS_REGION",
      "forcePathStyle": true
    }
  }
}
```

### Google OAuth

The default `hosting/railway/config.json` enables Google sign-in. To set it up:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Web application type)
3. Add your web app domain to **Authorized JavaScript origins** (e.g. `https://your.domain.com`)
4. Add `https://<your-server-domain>/v1/accounts/google/callback` to **Authorized redirect URIs**
5. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the Railway server service

If you don't need Google OAuth, set `account.google.enabled` to `false` in your config file, or use a custom config that omits the `account` section.

### Email (SMTP)

To enable invitation and verification emails, add to your `config.json`:

```json
{
  "email": {
    "enabled": true,
    "from": { "name": "Colanode", "email": "noreply@yourdomain.com" },
    "provider": {
      "type": "smtp",
      "host": "env://EMAIL_HOST",
      "port": 587,
      "secure": false,
      "auth": {
        "user": "env://EMAIL_USER",
        "password": "env://EMAIL_PASSWORD"
      }
    }
  }
}
```

### Full example config.json

A complete config with CORS, Google OAuth, S3 storage, and email enabled:

```json
{
  "cors": {
    "origin": ["https://your.domain.com", "http://localhost:4000"]
  },
  "name": "env://SERVER_NAME",
  "account": {
    "verificationType": "email",
    "google": {
      "enabled": true,
      "clientId": "env://GOOGLE_CLIENT_ID",
      "clientSecret": "env://GOOGLE_CLIENT_SECRET"
    }
  },
  "storage": {
    "provider": {
      "type": "s3",
      "endpoint": "env://BUCKET_ENDPOINT",
      "accessKey": "env://AWS_ACCESS_KEY_ID",
      "secretKey": "env://AWS_SECRET_ACCESS_KEY",
      "bucket": "env://BUCKET_NAME",
      "region": "env://AWS_REGION",
      "forcePathStyle": true
    }
  },
  "email": {
    "enabled": true,
    "from": { "name": "Colanode", "email": "noreply@yourdomain.com" },
    "provider": {
      "type": "smtp",
      "host": "env://EMAIL_HOST",
      "port": 587,
      "secure": false,
      "auth": {
        "user": "env://EMAIL_USER",
        "password": "env://EMAIL_PASSWORD"
      }
    }
  }
}
```

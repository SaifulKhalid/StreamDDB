# StreamDDB Security Hardening Guide & Environment Reference

StreamDDB has been updated following a complete security audit. Hardcoded configuration values and developer credentials have been migrated to a centralized environment configuration architecture. This repository is now safe to be made public.

---

## 🔒 1. Environment Variable Reference

The table below documents every environment variable supported by StreamDDB.

| Variable Name | Category | Scope | Description | Default / Example Value |
| :--- | :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Backend Secret | Private (Sensitive) | API credential used by server-side models for AI features or processing. | `AIzaSy...` |
| `APP_URL` | Public Config | Public / Shared | The hosted URL of this StreamDDB service, used for self-referential links or OAuth callbacks. | `https://streamddb.myhost.com` |
| `IPTV_SOURCE_URL` | Public Config | Private & Public | The primary IPTV source list in standard M3U format. | `https://raw.githubusercontent.com/.../playlist.m3u` |
| `VITE_FIREBASE_API_KEY` | Public Frontend | Public / Client-Safe | Firebase App API credential. Standard client-safe browser key. | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Public Frontend | Public / Client-Safe | The Firebase Auth Domain for single sign-on / authentication. | `my-app.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Public Frontend | Public / Client-Safe | The Firebase Project ID. | `my-app-id` |
| `VITE_FIREBASE_STORAGE_BUCKET`| Public Frontend| Public / Client-Safe | The optional Firebase Cloud Storage bucket. | `my-app.appspot.com` |
| `VITE_FIREBASE_MESSAGING` | Public Frontend | Public / Client-Safe | Unique signaling key for Firebase cloud push notifications. | `1234567890` |
| `VITE_FIREBASE_APP_ID` | Public Frontend | Public / Client-Safe | Standard client application ID identifier. | `1:123456:web:...` |
| `VITE_FIREBASE_MEASUREMENT_ID` | Public Frontend | Public / Client-Safe | Google Analytics identifier (Optional). | `G-XXXXXXXXXX` |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | Public Frontend | Public / Client-Safe | Named Firestore database ID (defaults to `(default)` in standard setup). | `ai-studio-60aca418-...` |
| `JWT_SECRET` | Backend Secret | Private (Sensitive) | Signing key for administrative sessions and token verification (Optional). | `super-secret-key-phrase` |
| `DATABASE_URL` | Backend Secret | Private (Sensitive) | Standard connection string for an optional relational SQL database. | `postgres://user:pass@host:5432/...` |

---

## 🛠️ 2. Security Setup Guide

Follow these steps to configure StreamDDB securely:

1. **Clone the repository**: Ensure that target directories are clean.
2. **Duplicate `.env.example` to produce `.env`**:
   ```bash
   cp .env.example .env
   ```
3. **Populate values**: Specify the Firebase parameters and/or custom IPTV source lists under the local `.env` file containing local development overrides.
4. **Vite Injection**: All client-safe configurations are prefixed with `VITE_`. During compilation (`npm run build`), Vite automatically injects these constants safely into the client application.

---

## 📦 3. Deployment Instructions

### Local Development Setup
1. Fill in the `.env` values.
2. Execute the dev setup:
   ```bash
   npm run dev
   ```
   The backend server automatically reads `.env` variables using a secure `dotenv` runtime integration, and boots the localized catalog on `http://localhost:3000`.

### Cloud Container / Production Build
1. Set the appropriate environment values in your target cloud provider container variables (e.g., Google Cloud Run, Docker Compose, Kubernetes secrets, or Vercel/Netlify env panels).
2. Execute the production build workflow:
   ```bash
   npm run build
   ```
3. Start the bundled production server:
   ```bash
   npm run start
   ```

---

## 🚨 4. Git Protection Invariants

The repository includes standard protections inside `.gitignore` preventing absolute leakage of:
- All localized environmental configuration files (`.env`, `.env.local`, `.env.production`, `.env.development`).
- Private Cryptographic files (`*.pem`, `*.key`).
- Cloud Provider service-account credentials (`service-account.json`).
- Automatically generated provisioning configs (`firebase-applet-config.json`).

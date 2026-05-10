# AI Website Builder

An AI-powered website generator using Google Gemini, React, Firebase Firestore, and Vercel.

## Features

- 🤖 **AI Generation** — Gemini 2.5 Flash generates complete, production-ready HTML/CSS/JS websites
- 🖼 **Image Upload** — Upload up to 5 images to incorporate into your generated sites
- 💾 **History** — All generated sites saved to Firestore for future reference
- 📱 **Responsive Preview** — Toggle between desktop and mobile views
- 🔄 **Iterative Refinement** — Refine designs conversationally
- 🔐 **Secure** — API key never exposed to the browser (serverless backend)

## Project Structure

```
ai-website-builder/
├── api/
│   └── generate.js        # Vercel serverless function (Gemini API call)
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React application
│   │   ├── firebase.js     # Firebase/Firestore client
│   │   ├── main.jsx        # Entry point
│   │   └── index.css       # Tailwind CSS
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore indexes
├── vercel.json             # Vercel deployment config
└── .env.example            # Environment variable template
```

## Quick Start (Local Development)

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your `GEMINI_API_KEY`
3. Copy `frontend/.env.example` to `frontend/.env` and fill in your Firebase values
4. Run `cd frontend && npm install && npm run dev`
5. In a separate terminal, use [Vercel CLI](https://vercel.com/docs/cli): `vercel dev`

## Deployment

See the included `DEPLOYMENT_GUIDE.pdf` for step-by-step instructions.

## Environment Variables

### Root (Vercel / server-side)
| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key from AI Studio |

### Frontend (Vite / client-side)
| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |

## Security Notes

- `GEMINI_API_KEY` is a server-side only variable — it is NOT prefixed with `VITE_` and is never sent to the browser
- Firestore rules prevent documents larger than ~900KB (protecting against abuse)
- Image data is never stored in Firestore; only text prompts and generated HTML are persisted

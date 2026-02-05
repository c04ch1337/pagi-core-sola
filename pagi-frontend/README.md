<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1x7YmDRAFcZHtmHzezHNHnpQfyafyEqcb

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies: `npm install`
2. Configure the backend bridge (repo root): copy [.env.example](../.env.example) to `.env` and set `PAGI_OPENROUTER_API_KEY`. Ensure the bridge has `PAGI_ALLOW_OUTBOUND=true` if you want streaming chat.
3. Run the app: `npm run dev`

## Verifying L5 chaining

**UI verification:** Run the frontend (`npm run dev`), open Settings and set **Bridge URL** to the intelligence bridge (e.g. `http://127.0.0.1:8000`). Send a multi-turn query in ChatView; the response shows each RLM turn (THOUGHT/ACTION/OBSERVATION) as chat bubbles, with "Continuing..." when the last turn has `converged=false`. Check the browser Network tab for `POST …/rlm-multi-turn` and the bridge terminal for THOUGHT/EXECUTING lines.

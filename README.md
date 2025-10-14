# Zoom Video SDK & Open AI Realtime API Agents demo
![](public/cover.png)
This is a demo app for using voice agents the OpenAI Agents SDK in a Zoom Video SDK session.

Use of this Sample App is subject to our [Terms of Use](https://www.zoom.com/en/trust/terms/).

This project uses the [Zoom Video SDK](https://developers.zoom.us/docs/video-sdk/) with [OpenAI Agents SDK](https://github.com/openai/openai-agents-js).

## Setup
- This is a Next.js typescript app. Install dependencies with `npm i`.
- Add environment variables:
```bash
cp .env.sample .env
```
Set the `ZOOM_SDK_KEY`, `ZOOM_SDK_SECRET`, `OPENAI_API_KEY` as:
```
OPENAI_API_KEY=sk-proj-xxxx
ZOOM_SDK_KEY=sdkkey123
ZOOM_SDK_SECRET=secret123
```
- Start the server with `npm run dev`
- Open your browser to [http://localhost:3000](http://localhost:3000). 

The app is based on the [sample app](https://github.com/openai/openai-realtime-agents/) provided by OpenAI.

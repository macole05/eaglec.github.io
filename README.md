# Legacy Blocks Hub (Node)

A Node.js web app and backend for uploading legacy-style game place files and generating launch payloads for custom older-client workflows.

## Features
- Upload `.rbxl`, `.rbxlx`, `.rbxm`, or `.zip` game files
- Store game metadata in a lightweight JSON database
- Configure the backend base URL used by legacy client endpoints
- Get URL replacement mappings to patch 2014 client endpoint URLs
- Dedicated games page that generates a Windows CMD launch command

## Run locally
```bash
npm install
npm start
```

Then open:
- `http://localhost:3000/index.html` (upload + URL replacement info)
- `http://localhost:3000/games.html` (game list + CMD launch generator)

## API
- `GET /api/client-config` (XML settings for legacy-style clients)
- `GET /api/client-config-json` (current editable client config)
- `PUT /api/client-config-json` (update base URL / endpoint paths)
- `GET /api/client-url-replacements` (string replacement map for old client files)
- `GET /api/games`, `POST /api/games`, `POST /api/launch`

## Notes
This project provides a custom launcher backend pattern. You must implement your own compatible game client/launcher and `rbxlegacy://` protocol registration for full launch integration.

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
const gamesDbFile = path.join(dataDir, 'games.json');
const clientConfigFile = path.join(dataDir, 'client-config.json');

const defaultClientConfig = {
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`,
  gamesPagePath: '/games.html',
  launchEndpointPath: '/api/launch',
  uploadEndpointPath: '/api/games'
};

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(gamesDbFile)) fs.writeFileSync(gamesDbFile, '[]', 'utf-8');
if (!fs.existsSync(clientConfigFile)) {
  fs.writeFileSync(clientConfigFile, JSON.stringify(defaultClientConfig, null, 2), 'utf-8');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${uuidv4()}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.rbxl', '.rbxlx', '.rbxm', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error(`Unsupported file type: ${ext}`));
    }
    cb(null, true);
  }
});

function readGames() {
  try {
    return JSON.parse(fs.readFileSync(gamesDbFile, 'utf-8'));
  } catch {
    return [];
  }
}

function writeGames(games) {
  fs.writeFileSync(gamesDbFile, JSON.stringify(games, null, 2), 'utf-8');
}

function readClientConfig() {
  try {
    const data = JSON.parse(fs.readFileSync(clientConfigFile, 'utf-8'));
    return { ...defaultClientConfig, ...data };
  } catch {
    return { ...defaultClientConfig };
  }
}

function writeClientConfig(config) {
  fs.writeFileSync(clientConfigFile, JSON.stringify(config, null, 2), 'utf-8');
}

function joinUrl(base, pathname) {
  return `${String(base).replace(/\/$/, '')}${pathname.startsWith('/') ? '' : '/'}${pathname}`;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'legacy-launcher', timestamp: new Date().toISOString() });
});

app.get('/api/client-config', (_req, res) => {
  const cfg = readClientConfig();
  const launchUrl = joinUrl(cfg.publicBaseUrl, cfg.launchEndpointPath);
  const uploadUrl = joinUrl(cfg.publicBaseUrl, cfg.uploadEndpointPath);
  const gamesPageUrl = joinUrl(cfg.publicBaseUrl, cfg.gamesPagePath);

  res.type('application/xml').send(`<?xml version="1.0" encoding="utf-8"?>
<ClientSettings>
  <Compatibility>2014-style</Compatibility>
  <BaseUrl>${cfg.publicBaseUrl}</BaseUrl>
  <LaunchEndpoint>${launchUrl}</LaunchEndpoint>
  <UploadEndpoint>${uploadUrl}</UploadEndpoint>
  <GamesPage>${gamesPageUrl}</GamesPage>
</ClientSettings>`);
});

app.get('/api/client-config-json', (_req, res) => {
  const cfg = readClientConfig();
  res.json(cfg);
});

app.put('/api/client-config-json', (req, res) => {
  const { publicBaseUrl, gamesPagePath, launchEndpointPath, uploadEndpointPath } = req.body || {};

  if (!publicBaseUrl || typeof publicBaseUrl !== 'string') {
    return res.status(400).json({ error: 'publicBaseUrl is required.' });
  }

  const normalized = {
    publicBaseUrl: publicBaseUrl.trim(),
    gamesPagePath: typeof gamesPagePath === 'string' ? gamesPagePath.trim() : '/games.html',
    launchEndpointPath: typeof launchEndpointPath === 'string' ? launchEndpointPath.trim() : '/api/launch',
    uploadEndpointPath: typeof uploadEndpointPath === 'string' ? uploadEndpointPath.trim() : '/api/games'
  };

  writeClientConfig(normalized);
  res.json({ message: 'Client config updated.', config: normalized });
});

app.get('/api/client-url-replacements', (_req, res) => {
  const cfg = readClientConfig();
  const base = cfg.publicBaseUrl.replace(/\/$/, '');

  res.json({
    message: 'Use these replacements in your 2014 client files to point to this backend.',
    baseUrl: base,
    replacements: [
      { from: 'http://www.roblox.com', to: base },
      { from: 'https://www.roblox.com', to: base },
      { from: 'http://web.roblox.com', to: base },
      { from: 'http://api.roblox.com', to: base },
      { from: 'http://assetgame.roblox.com', to: base },
      { from: 'http://clientsettings.roblox.com', to: base }
    ]
  });
});

app.get('/api/games', (_req, res) => {
  const games = readGames();
  res.json(games.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/games', upload.single('gameFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Missing game file (field name: gameFile).' });
  }

  const { name, description = '', creator = 'anonymous' } = req.body;
  if (!name || !name.trim()) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Game name is required.' });
  }

  const games = readGames();
  const game = {
    id: uuidv4(),
    name: name.trim(),
    description: description.trim(),
    creator: creator.trim(),
    fileName: req.file.filename,
    originalName: req.file.originalname,
    fileUrl: `/uploads/${req.file.filename}`,
    createdAt: new Date().toISOString()
  };

  games.push(game);
  writeGames(games);

  res.status(201).json({
    message: 'Game uploaded successfully.',
    game
  });
});

app.post('/api/launch', (req, res) => {
  const { gameId, username = 'Guest' } = req.body;
  const games = readGames();
  const game = games.find((g) => g.id === gameId);

  if (!game) {
    return res.status(404).json({ error: 'Game not found.' });
  }

  const launchTicket = Buffer.from(
    JSON.stringify({ gameId, username, issuedAt: new Date().toISOString() })
  ).toString('base64');

  const legacyJoinUrl = `rbxlegacy://launch?ticket=${encodeURIComponent(launchTicket)}`;
  const windowsCmdLaunch = `start \"\" \"${legacyJoinUrl}\"`;

  res.json({
    game: {
      id: game.id,
      name: game.name
    },
    joinScript: {
      gameFile: game.fileUrl,
      userName: username,
      joinToken: launchTicket
    },
    legacyJoinUrl,
    windowsCmdLaunch,
    note: 'Use windowsCmdLaunch in cmd.exe, and register rbxlegacy:// in your launcher.'
  });
});

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || 'Request failed.' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

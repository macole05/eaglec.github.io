const gamesList = document.getElementById('gamesList');
const template = document.getElementById('gameItemTemplate');

async function fetchGames() {
  const res = await fetch('/api/games');
  const games = await res.json();

  gamesList.innerHTML = '';
  if (!games.length) {
    gamesList.textContent = 'No games uploaded yet.';
    return;
  }

  for (const game of games) {
    const node = template.content.cloneNode(true);
    node.querySelector('.game-name').textContent = game.name;
    node.querySelector('.game-meta').textContent = `${game.creator} · ${new Date(game.createdAt).toLocaleString()}`;
    node.querySelector('.game-description').textContent = game.description || 'No description';

    const dl = node.querySelector('.download-link');
    dl.href = game.fileUrl;
    dl.textContent = 'Download file';

    const output = node.querySelector('.launch-output');
    const launchBtn = node.querySelector('.launch-btn');
    launchBtn.addEventListener('click', async () => {
      launchBtn.disabled = true;
      launchBtn.textContent = 'Generating...';

      try {
        const username = prompt('Username for launch ticket?', 'Guest2014') || 'Guest2014';
        const launchRes = await fetch('/api/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId: game.id, username })
        });

        const launchData = await launchRes.json();
        if (!launchRes.ok) throw new Error(launchData.error || 'Launch failed');

        output.textContent = `CMD:\n${launchData.windowsCmdLaunch}\n\nLegacy URL:\n${launchData.legacyJoinUrl}\n\nFull Payload:\n${JSON.stringify(launchData, null, 2)}`;
      } catch (err) {
        output.textContent = String(err.message || err);
      } finally {
        launchBtn.disabled = false;
        launchBtn.textContent = 'Generate CMD Launch';
      }
    });

    gamesList.appendChild(node);
  }
}

fetchGames().catch((err) => {
  gamesList.textContent = `Failed to load games: ${err.message || err}`;
});

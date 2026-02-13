const uploadForm = document.getElementById('uploadForm');
const uploadStatus = document.getElementById('uploadStatus');
const replacementOutput = document.getElementById('replacementOutput');

async function fetchUrlReplacements() {
  const res = await fetch('/api/client-url-replacements');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load URL replacements');
  replacementOutput.textContent = JSON.stringify(data, null, 2);
}

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  uploadStatus.textContent = 'Uploading...';

  try {
    const formData = new FormData(uploadForm);
    const res = await fetch('/api/games', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    uploadStatus.textContent = `Uploaded: ${data.game.name}`;
    uploadForm.reset();
  } catch (err) {
    uploadStatus.textContent = `Error: ${err.message || err}`;
  }
});

fetchUrlReplacements().catch((err) => {
  replacementOutput.textContent = `Failed to load replacements: ${err.message || err}`;
});

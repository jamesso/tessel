document.addEventListener('DOMContentLoaded', async () => {
  const el = document.getElementById('app-version')
  if (!el || !window.tesselAbout) return
  el.textContent = await window.tesselAbout.getVersion()
})

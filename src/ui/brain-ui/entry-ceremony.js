export function initEntryCeremony() {
  const overlay = document.getElementById('gai-entry-ceremony')
  if (!overlay) return
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  const finish = () => {
    overlay.classList.add('is-complete')
    setTimeout(() => overlay.remove(), reduced ? 80 : 650)
  }
  requestAnimationFrame(() => overlay.classList.add('is-active'))
  setTimeout(finish, reduced ? 180 : 1750)
}

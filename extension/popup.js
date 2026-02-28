// Seal Extension Popup

chrome.runtime.sendMessage({ type: 'SEAL_GET_SESSION' }, (response) => {
  const dot = document.getElementById('status-dot')
  const text = document.getElementById('status-text')
  const emailEl = document.getElementById('status-email')

  if (response?.session) {
    dot.className = 'dot green'
    text.textContent = 'Session active'
    emailEl.textContent = response.session.user?.email || ''
  } else {
    dot.className = 'dot red'
    text.textContent = 'Not signed in'
    emailEl.textContent = ''
  }
})

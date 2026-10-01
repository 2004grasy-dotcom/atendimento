(function () {
  const currentScript = document.currentScript;
  const scriptUrl = new URL(currentScript ? currentScript.src : window.location.href);
  const botOrigin = scriptUrl.origin;

  // Evita carregar duas vezes
  if (document.getElementById('typebot-custom-widget-root')) return;

  const root = document.createElement('div');
  root.id = 'typebot-custom-widget-root';
  root.style.position = 'fixed';
  root.style.bottom = '20px';
  root.style.right = '20px';
  root.style.zIndex = '999999';
  root.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // Botão flutuante
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'typebot-bubble-btn';
  toggleBtn.style.cssText = `
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: #4F46E5;
    color: white;
    border: none;
    box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4), 0 8px 10px -6px rgba(79, 70, 229, 0.3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    outline: none;
  `;
  toggleBtn.innerHTML = `
    <svg id="typebot-open-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
    <svg id="typebot-close-icon" style="display:none;" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;

  // Janela Iframe
  const container = document.createElement('div');
  container.id = 'typebot-window';
  container.style.cssText = `
    display: none;
    position: fixed;
    bottom: 95px;
    right: 20px;
    width: 420px;
    max-width: calc(100vw - 40px);
    height: 650px;
    max-height: calc(100vh - 120px);
    border-radius: 24px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.18);
    overflow: hidden;
    background: white;
    z-index: 999998;
    transform: translateY(20px);
    opacity: 0;
    transition: transform 0.3s ease, opacity 0.3s ease;
  `;

  const iframe = document.createElement('iframe');
  iframe.src = botOrigin;
  iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
  container.appendChild(iframe);

  let isOpen = false;
  function toggleChat() {
    isOpen = !isOpen;
    const openIcon = document.getElementById('typebot-open-icon');
    const closeIcon = document.getElementById('typebot-close-icon');

    if (isOpen) {
      container.style.display = 'block';
      setTimeout(() => {
        container.style.transform = 'translateY(0)';
        container.style.opacity = '1';
      }, 10);
      toggleBtn.style.transform = 'scale(0.92)';
      openIcon.style.display = 'none';
      closeIcon.style.display = 'block';
    } else {
      container.style.transform = 'translateY(20px)';
      container.style.opacity = '0';
      setTimeout(() => {
        container.style.display = 'none';
      }, 300);
      toggleBtn.style.transform = 'scale(1)';
      openIcon.style.display = 'block';
      closeIcon.style.display = 'none';
    }
  }

  toggleBtn.addEventListener('click', toggleChat);

  root.appendChild(container);
  root.appendChild(toggleBtn);
  document.body.appendChild(root);
})();

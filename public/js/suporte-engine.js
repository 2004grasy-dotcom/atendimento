/**
 * Engine do Chat de Suporte e Entrega Pós-Compra (Letícia Suporte)
 */
class SuporteChat {
  constructor() {
    this.chatContainer = document.getElementById('chat-messages');
    this.inputArea = document.getElementById('input-area');
    this.inputForm = document.getElementById('input-form');
    this.textInput = document.getElementById('chat-input');
    this.newMessagesPill = document.getElementById('new-messages-pill');

    this.botAvatar = '/images/leticia.jpg';
    this.buyerData = null;
    this.isAIMode = false;
    this.audioEnabled = true;

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.startFlow();
  }

  setupEventListeners() {
    this.setupScrollListener();

    this.inputForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleInputSubmit();
    });
  }

  setupScrollListener() {
    if (this.chatContainer) {
      this.chatContainer.addEventListener('scroll', () => {
        if (!this.isUserScrolledUp()) {
          this.hideNewMessageAlert();
        }
      }, { passive: true });
    }
  }

  isUserScrolledUp() {
    if (!this.chatContainer) return false;
    const distanceToBottom = this.chatContainer.scrollHeight - this.chatContainer.scrollTop - this.chatContainer.clientHeight;
    return distanceToBottom > 130;
  }

  showNewMessageAlert() {
    if (this.newMessagesPill) this.newMessagesPill.classList.remove('hidden');
  }

  hideNewMessageAlert() {
    if (this.newMessagesPill) this.newMessagesPill.classList.add('hidden');
  }

  scrollToBottom(force = false) {
    if (!this.chatContainer) return;
    if (!force && this.isUserScrolledUp()) {
      this.showNewMessageAlert();
      return;
    }
    this.hideNewMessageAlert();
    setTimeout(() => {
      this.chatContainer.scrollTo({
        top: this.chatContainer.scrollHeight,
        behavior: 'smooth'
      });
    }, 60);
  }

  playBeepSound() {
    if (!this.audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch (e) {}
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async showTypingIndicator(customText = null) {
    const typingId = 'typing-' + Date.now();
    const typingEl = document.createElement('div');
    typingEl.id = typingId;
    typingEl.className = 'flex items-end gap-2.5 animate-pop-in mb-3 max-w-2xl w-full mx-auto';
    typingEl.innerHTML = `
      <img src="${this.botAvatar}" class="w-8 h-8 rounded-full shadow-sm flex-shrink-0 bg-white p-0.5 border border-gray-200 object-cover">
      <div class="bg-white border border-gray-200/90 rounded-2xl rounded-bl-sm px-4 py-3 shadow-xs flex items-center gap-2">
        <div class="flex items-center gap-1">
          <div class="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style="animation-delay: 0ms"></div>
          <div class="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style="animation-delay: 150ms"></div>
          <div class="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style="animation-delay: 300ms"></div>
        </div>
        ${customText ? `<span class="text-xs text-gray-500 font-medium ml-1">${customText}</span>` : ''}
      </div>
    `;
    this.chatContainer.appendChild(typingEl);
    this.scrollToBottom(false);

    await this.sleep(1100);
    typingEl.remove();
  }

  renderBotMessage(text) {
    const msgEl = document.createElement('div');
    msgEl.className = 'flex items-end gap-2.5 animate-pop-in mb-3 max-w-2xl w-full mx-auto';
    msgEl.innerHTML = `
      <img src="${this.botAvatar}" class="w-8 h-8 rounded-full shadow-sm flex-shrink-0 bg-white p-0.5 border border-gray-200 object-cover">
      <div class="bg-white border border-gray-200/90 rounded-2xl rounded-bl-sm p-4 shadow-xs text-gray-800 text-sm md:text-base leading-relaxed break-words max-w-[85%]">
        ${this.formatMarkdown(text)}
      </div>
    `;
    this.chatContainer.appendChild(msgEl);
    this.scrollToBottom(false);
  }

  renderUserMessage(text) {
    const msgEl = document.createElement('div');
    msgEl.className = 'flex justify-end animate-pop-in mb-3 max-w-2xl w-full mx-auto';
    msgEl.innerHTML = `
      <div class="bg-emerald-600 text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-xs text-sm md:text-base leading-relaxed break-words max-w-[85%] font-normal">
        ${this.escapeHtml(text)}
      </div>
    `;
    this.chatContainer.appendChild(msgEl);
    this.scrollToBottom(true);
  }

  renderAccessCard(buyerName, deliveryLink) {
    const cardEl = document.createElement('div');
    cardEl.className = 'pl-10 pr-2 my-4 animate-pop-in max-w-2xl w-full mx-auto';
    cardEl.innerHTML = `
      <div class="bg-gradient-to-br from-emerald-50 to-white border-2 border-emerald-400 rounded-2xl p-5 shadow-md">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xl font-bold">
            🔑
          </div>
          <div>
            <h3 class="font-bold text-gray-900 text-base">Acesso Liberado com Sucesso!</h3>
            <p class="text-xs text-emerald-700 font-medium">Plataforma Oficial + Grupo VIP</p>
          </div>
        </div>
        <p class="text-sm text-gray-600 mb-4 leading-relaxed">
          Clique no botão abaixo para entrar na plataforma e acessar o grupo de membros exclusivos:
        </p>
        <a 
          href="${deliveryLink}" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg hover:shadow-emerald-500/30 transition-all flex items-center justify-between text-base group cursor-pointer transform hover:-translate-y-0.5"
        >
          <span class="flex items-center gap-2">
            <span class="text-xl">🚀</span>
            <span>Acessar Plataforma & Grupo VIP</span>
          </span>
          <svg class="w-5 h-5 text-white/90 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </a>
      </div>
    `;
    this.chatContainer.appendChild(cardEl);
    this.scrollToBottom(false);
  }

  async startFlow() {
    this.chatContainer.innerHTML = '';
    this.inputArea.classList.add('hidden');

    await this.showTypingIndicator();
    this.renderBotMessage("Olá! Seja muito bem-vindo(a) à **Plataforma de Fabricantes e Fornecedores**! 🎉🛍️");
    this.playBeepSound();

    await this.sleep(600);
    await this.showTypingIndicator();
    this.renderBotMessage("Eu sou a **Letícia** do Suporte Oficial e vou liberar o seu acesso VIP e o link exclusivo agora mesmo!");
    this.playBeepSound();

    await this.sleep(700);
    await this.showTypingIndicator();
    this.renderBotMessage("Para eu localizar seu pedido no sistema, **digite abaixo o seu e-mail** (o mesmo utilizado na compra): 👇");
    this.playBeepSound();

    this.inputArea.classList.remove('hidden');
    this.textInput.placeholder = 'Digite seu e-mail da compra...';
    this.textInput.type = 'email';
    this.textInput.value = '';
    this.textInput.focus();
  }

  async handleInputSubmit() {
    const rawVal = this.textInput.value.trim();
    if (!rawVal) return;

    if (this.isAIMode) {
      this.handleAIQuestion(rawVal);
      return;
    }

    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(rawVal)) {
      alert('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    const email = rawVal;
    this.textInput.value = '';
    this.renderUserMessage(email);
    this.playBeepSound();

    await this.showTypingIndicator("🔍 Consultando cadastro no sistema...");

    try {
      const res = await fetch('/api/suporte/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      });
      const data = await res.json();

      if (data.success && data.encontrado) {
        this.buyerData = data.comprador;
        const buyerName = (data.comprador && data.comprador.name) || 'Cliente';
        const deliveryLink = data.linkEntrega || "https://plataforma-das-fabricas.lovable.app/";

        await this.showTypingIndicator();
        this.renderBotMessage(`Localizei sua compra com sucesso, **${buyerName}**! Parabéns pela sua decisão e seja muito bem-vindo(a)! 🚀✨`);
        this.playBeepSound();

        await this.sleep(600);
        await this.showTypingIndicator();
        this.renderBotMessage("Aqui está o seu link de acesso oficial à **Plataforma e ao Grupo VIP**: 👇");
        this.renderAccessCard(buyerName, deliveryLink);
        this.playBeepSound();

        await this.sleep(800);
        await this.showTypingIndicator();
        this.renderBotMessage(`💡 **Dica de ouro para você começar a comprar com preço de fábrica:**\n\nDentro da plataforma, você tem **duas formas** de encontrar os fornecedores:\n\n1️⃣ **Opção de Busca:** para você pesquisar direto pelo tipo de peça que procura (ex: vestidos, conjuntos, moda íntima, jeans, fitness, infantil, etc.)\n2️⃣ **Central de Fornecedores:** onde você navega por todos os contatos diretos e catálogos organizados por polos industriais de confecção!`);
        this.playBeepSound();

        await this.sleep(800);
        await this.showTypingIndicator();
        this.renderBotMessage("💬 **Ficou com alguma dúvida sobre o acesso ou o primeiro uso da plataforma?**\n\nPode digitar sua pergunta aqui embaixo que eu te respondo agora mesmo! 👇");
        this.playBeepSound();

        // Ativa modo IA de Suporte
        this.isAIMode = true;
        this.textInput.placeholder = 'Tire sua dúvida sobre a plataforma ou fornecedores...';
        this.textInput.type = 'text';
        this.textInput.focus();

      } else {
        await this.showTypingIndicator();
        this.renderBotMessage(`Não localizei nenhuma compra aprovada com o e-mail: **${email}** 😕\n\nPode ser que tenha ocorrido algum erro de digitação, ou o pagamento via boleto/Pix ainda esteja sendo processado.\n\nPor favor, confira e **digite seu e-mail novamente abaixo** para tentarmos outra vez: 👇`);
        this.playBeepSound();
        this.textInput.placeholder = 'Digite seu e-mail novamente...';
        this.textInput.focus();
      }
    } catch (err) {
      console.error('Erro na verificação:', err);
      this.renderBotMessage("Ocorreu uma oscilação na consulta, por favor tente novamente em alguns segundos.");
    }
  }

  async handleAIQuestion(question) {
    this.textInput.value = '';
    this.renderUserMessage(question);
    this.playBeepSound();

    await this.showTypingIndicator();

    try {
      const res = await fetch('/api/suporte/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question,
          email: this.buyerData ? this.buyerData.email : '',
          name: this.buyerData ? this.buyerData.name : ''
        })
      });
      const data = await res.json();
      const msgs = (data.messages && data.messages.length > 0)
        ? data.messages
        : ["Estou aqui para te dar todo suporte! O link para você acessar a plataforma e o Grupo VIP é: https://plataforma-das-fabricas.lovable.app/ ✨"];

      for (let i = 0; i < msgs.length; i++) {
        if (i > 0) await this.showTypingIndicator();
        this.renderBotMessage(msgs[i]);
        this.playBeepSound();
      }
    } catch (err) {
      console.error('Erro na IA de suporte:', err);
      this.renderBotMessage("Tive uma pequena oscilação aqui, mas você pode acessar a plataforma pelo link liberado acima! ✨");
    }

    this.textInput.focus();
  }

  formatMarkdown(text) {
    if (!text) return '';
    let escaped = this.escapeHtml(text);
    escaped = escaped.replace(/\[(.*?)\]\((https?:\/\/.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-emerald-700 underline font-bold hover:text-emerald-900">$1 🔗</a>');
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\n/g, '<br>');
    return escaped;
  }

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.suporteInstance = new SuporteChat();
});

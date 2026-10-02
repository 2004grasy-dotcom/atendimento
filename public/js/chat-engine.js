// Typebot Chat Engine
class TypebotChat {
  constructor() {
    this.flow = null;
    this.currentStepId = null;
    this.answers = {};

    let storedSession = sessionStorage.getItem('typebot_session_id');
    if (!storedSession) {
      storedSession = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
      sessionStorage.setItem('typebot_session_id', storedSession);
    }
    this.sessionId = storedSession;

    this.chatContainer = document.getElementById('chat-messages');
    this.inputArea = document.getElementById('input-area');
    this.inputForm = document.getElementById('input-form');
    this.textInput = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('send-btn');
    this.audioEnabled = true;
    this.isAIMode = false;

    window.chatInstance = this;
    this.init();
  }

  async init() {
    try {
      const res = await fetch('/api/flow');
      this.flow = await res.json();
      this.applyTheme(this.flow.settings);
      this.setupEventListeners();
      this.startConversation();
    } catch (err) {
      console.error('Falha ao carregar fluxo:', err);
      this.showSystemMessage('Erro ao carregar fluxo de atendimento. Verifique o servidor.');
    }
  }

  applyTheme(settings) {
    if (!settings) return;
    if (settings.botName) {
      document.querySelectorAll('.bot-name-text').forEach(el => el.textContent = settings.botName);
      document.title = settings.botName + ' - Atendimento';
    }
    if (settings.botSubtitle) {
      document.querySelectorAll('.bot-subtitle-text').forEach(el => el.textContent = settings.botSubtitle);
    }
    if (settings.botAvatar) {
      document.querySelectorAll('.bot-avatar-img').forEach(el => el.src = settings.botAvatar);
    }
    if (settings.primaryColor) {
      document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
      document.querySelectorAll('.btn-primary-bg').forEach(el => {
        el.style.backgroundColor = settings.primaryColor;
      });
    }
  }

  setupEventListeners() {
    this.setupScrollListener();

    this.inputForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUserTextSubmit();
    });

    const resetBtn = document.getElementById('restart-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.restartConversation());
    }

    // Máscara de telefone quando necessário
    this.textInput.addEventListener('input', (e) => {
      const step = this.getStepById(this.currentStepId);
      if (step && (step.type === 'input_phone' || step.variable === 'whatsapp' || step.variable === 'telefone')) {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 11) val = val.substring(0, 11);
        if (val.length > 6) {
          e.target.value = `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7)}`;
        } else if (val.length > 2) {
          e.target.value = `(${val.substring(0, 2)}) ${val.substring(2)}`;
        } else if (val.length > 0) {
          e.target.value = `(${val}`;
        }
      }
    });
  }

  startConversation() {
    // Tenta restaurar estado anterior para evitar reset acidental
    const savedHtml = sessionStorage.getItem('typebot_history_html');
    const savedAnswers = sessionStorage.getItem('typebot_answers');
    const savedStep = sessionStorage.getItem('typebot_current_step');

    if (savedHtml && savedStep) {
      try {
        this.chatContainer.innerHTML = savedHtml;
        this.answers = savedAnswers ? JSON.parse(savedAnswers) : {};
        this.currentStepId = savedStep;
        this.scrollToBottom();
        // Se o passo atual ainda precisa de input do usuário, exibe
        const step = this.getStepById(savedStep);
        if (step && ['input_text', 'input_name', 'input_email', 'input_phone'].includes(step.type)) {
          this.showTextInput(step);
        }
        return;
      } catch (e) {}
    }

    this.chatContainer.innerHTML = '';
    this.answers = { etapa_atual: 'Iniciou Atendimento' };
    this.saveLead();

    if (!this.flow || !this.flow.steps || this.flow.steps.length === 0) {
      this.showSystemMessage('Nenhum passo configurado no fluxo.');
      return;
    }
    const firstStep = this.flow.steps[0];
    this.executeStep(firstStep.id);
  }

  restartConversation() {
    sessionStorage.removeItem('typebot_history_html');
    sessionStorage.removeItem('typebot_answers');
    sessionStorage.removeItem('typebot_current_step');
    this.sessionId = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    sessionStorage.setItem('typebot_session_id', this.sessionId);
    this.chatContainer.innerHTML = '';
    this.answers = { etapa_atual: 'Reiniciou Atendimento' };
    this.saveLead();
    const firstStep = this.flow && this.flow.steps && this.flow.steps[0];
    if (firstStep) this.executeStep(firstStep.id);
  }

  getStepById(stepId) {
    if (!this.flow || !this.flow.steps) return null;
    return this.flow.steps.find(s => s.id === stepId);
  }

  async executeStep(stepId) {
    this.currentStepId = stepId;
    const step = this.getStepById(stepId);
    if (!step) {
      this.hideInput();
      return;
    }

    // Mensagem regular do Bot
    if (step.type === 'message') {
      this.hideInput();
      await this.showTypingIndicator();
      this.renderBotMessage(this.interpolate(step.content));
      this.playBeepSound();

      if (step.nextStepId) {
        const delay = step.delay || 800;
        setTimeout(() => {
          this.executeStep(step.nextStepId);
        }, delay);
      }
      return;
    }

    // Perguntas que exigem entrada de texto (Nome, WhatsApp, E-mail, Texto livre)
    // Perguntas que exigem entrada de texto (Nome, WhatsApp, E-mail, Texto livre)
    if (['input_text', 'input_name', 'input_email', 'input_phone'].includes(step.type)) {
      this.hideInput();
      await this.showTypingIndicator();
      this.renderBotMessage(this.interpolate(step.content));
      this.playBeepSound();

      this.showTextInput(step);
      return;
    }

    // Mensagem de Áudio (Nota de voz estilo WhatsApp)
    if (step.type === 'audio') {
      this.hideInput();
      await this.showTypingIndicator();
      this.renderAudioMessage(step);
      this.playBeepSound();

      if (step.nextStepId) {
        const delay = step.delay || 4500;
        setTimeout(() => {
          this.executeStep(step.nextStepId);
        }, delay);
      }
      return;
    }

    // Mensagem de Imagem
    if (step.type === 'image') {
      this.hideInput();
      await this.showTypingIndicator();
      this.renderImageMessage(step);
      this.playBeepSound();

      if (step.nextStepId) {
        const delay = step.delay || 2500;
        setTimeout(() => {
          this.executeStep(step.nextStepId);
        }, delay);
      }
      return;
    }

    // Perguntas com botões de múltipla escolha
    if (step.type === 'buttons') {
      this.hideInput();
      await this.showTypingIndicator();
      this.renderBotMessage(this.interpolate(step.content));
      this.playBeepSound();

      this.renderButtons(step);
      return;
    }

    // Pergunta de Avaliação (Estrelas)
    if (step.type === 'rating') {
      this.hideInput();
      await this.showTypingIndicator();
      this.renderBotMessage(this.interpolate(step.content));
      this.playBeepSound();

      this.renderRatingStars(step);
      return;
    }

    // Redirecionamento / CTA Final para WhatsApp
    if (step.type === 'redirect_whatsapp') {
      this.hideInput();
      await this.showTypingIndicator();
      this.renderBotMessage(this.interpolate(step.content));
      this.playBeepSound();

      this.renderWhatsappCTA(step);
      this.saveLead();
      return;
    }

    // Desconhecido ou final
    this.hideInput();
  }

  async showTypingIndicator() {
    const typingId = 'typing-indicator-' + Date.now();
    const typingEl = document.createElement('div');
    typingEl.id = typingId;
    typingEl.className = 'flex items-end gap-2.5 animate-pop-in max-w-2xl w-full mx-auto mb-2';
    typingEl.innerHTML = `
      <img src="${this.flow.settings.botAvatar}" class="w-8 h-8 rounded-full shadow-sm flex-shrink-0 bg-white p-0.5 border border-gray-200 object-cover">
      <div class="bg-white text-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm inline-flex items-center gap-1.5 border border-gray-100">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
    this.chatContainer.appendChild(typingEl);
    this.scrollToBottom(false);

    return new Promise(resolve => {
      setTimeout(() => {
        if (typingEl && typingEl.parentNode) {
          typingEl.remove();
        }
        resolve();
      }, 700);
    });
  }

  renderBotMessage(text) {
    const formatted = this.formatMarkdown(text);
    const msgEl = document.createElement('div');
    msgEl.className = 'flex items-end gap-2.5 animate-pop-in mb-3 max-w-2xl w-full mx-auto';
    msgEl.innerHTML = `
      <img src="${this.flow.settings.botAvatar}" class="w-8 h-8 rounded-full shadow-sm flex-shrink-0 bg-white p-0.5 border border-gray-200 object-cover">
      <div class="bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm max-w-[85%] text-sm md:text-base leading-relaxed break-words">
        ${formatted}
      </div>
    `;
    this.chatContainer.appendChild(msgEl);
    this.scrollToBottom(false);
  }

  renderUserMessage(text) {
    const primaryBg = this.flow.settings.primaryColor || '#598E71';
    const msgEl = document.createElement('div');
    msgEl.className = 'flex justify-end animate-pop-in mb-3 max-w-2xl w-full mx-auto';
    msgEl.innerHTML = `
      <div style="background-color: ${primaryBg}" class="text-white rounded-2xl rounded-br-sm px-4 py-2.5 shadow-sm max-w-[85%] text-sm md:text-base leading-relaxed break-words font-medium">
        ${this.escapeHtml(text)}
      </div>
    `;
    this.chatContainer.appendChild(msgEl);
    this.scrollToBottom(true);
  }

  renderAudioMessage(step) {
    const audioUrl = step.audioUrl || (step.content && step.content.url) || '';
    const audioId = 'audio-' + Math.random().toString(36).substring(2, 8);
    const primaryBg = this.flow.settings.primaryColor || '#598E71';

    const msgEl = document.createElement('div');
    msgEl.className = 'flex items-end gap-2.5 animate-pop-in mb-3 max-w-2xl w-full mx-auto';
    msgEl.innerHTML = `
      <img src="${this.flow.settings.botAvatar}" class="w-8 h-8 rounded-full shadow-sm flex-shrink-0 bg-white p-0.5 border border-gray-200 object-cover">
      <div class="bg-white border border-gray-200/90 rounded-2xl rounded-bl-sm p-3.5 shadow-sm max-w-[90%] sm:max-w-xs w-full flex items-center gap-3">
        <audio id="${audioId}" src="${audioUrl}" preload="metadata"></audio>
        <button type="button" class="audio-play-btn w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-md transition-transform transform active:scale-95" style="background-color: ${primaryBg}">
          <svg class="w-5 h-5 play-icon ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          <svg class="w-5 h-5 pause-icon hidden" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        </button>
        <div class="flex-1 flex flex-col justify-center">
          <div class="flex items-center justify-between text-[11px] text-gray-500 font-mono mb-1">
            <span class="audio-time">0:00</span>
            <span class="audio-duration">🎙️ Áudio</span>
          </div>
          <div class="audio-progress-bar w-full bg-gray-200 h-1.5 rounded-full overflow-hidden cursor-pointer relative">
            <div class="audio-progress-fill h-full rounded-full transition-all" style="width: 0%; background-color: ${primaryBg}"></div>
          </div>
        </div>
      </div>
    `;

    const audioElement = msgEl.querySelector(`#${audioId}`);
    const playBtn = msgEl.querySelector('.audio-play-btn');
    const playIcon = msgEl.querySelector('.play-icon');
    const pauseIcon = msgEl.querySelector('.pause-icon');
    const timeDisplay = msgEl.querySelector('.audio-time');
    const durationDisplay = msgEl.querySelector('.audio-duration');
    const progressFill = msgEl.querySelector('.audio-progress-fill');
    const progressBar = msgEl.querySelector('.audio-progress-bar');

    const formatSec = (sec) => {
      if (!sec || isNaN(sec)) return '0:00';
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    audioElement.addEventListener('loadedmetadata', () => {
      durationDisplay.textContent = formatSec(audioElement.duration);
    });

    audioElement.addEventListener('timeupdate', () => {
      timeDisplay.textContent = formatSec(audioElement.currentTime);
      if (audioElement.duration) {
        const pct = (audioElement.currentTime / audioElement.duration) * 100;
        progressFill.style.width = pct + '%';
      }
    });

    audioElement.addEventListener('ended', () => {
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
      progressFill.style.width = '0%';
      timeDisplay.textContent = '0:00';
    });

    playBtn.addEventListener('click', () => {
      if (audioElement.paused) {
        document.querySelectorAll('audio').forEach(a => { if (a !== audioElement) a.pause(); });
        audioElement.play().then(() => {
          playIcon.classList.add('hidden');
          pauseIcon.classList.remove('hidden');
        }).catch(err => console.warn('Autoplay error:', err));
      } else {
        audioElement.pause();
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
      }
    });

    progressBar.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = clickX / rect.width;
      if (audioElement.duration) {
        audioElement.currentTime = pct * audioElement.duration;
      }
    });

    this.chatContainer.appendChild(msgEl);
    this.scrollToBottom(false);
  }

  renderImageMessage(step) {
    const imageUrl = step.imageUrl || (step.content && step.content.url) || '';
    const msgEl = document.createElement('div');
    msgEl.className = 'flex items-end gap-2.5 animate-pop-in mb-3 max-w-2xl w-full mx-auto';
    msgEl.innerHTML = `
      <img src="${this.flow.settings.botAvatar}" class="w-8 h-8 rounded-full shadow-sm flex-shrink-0 bg-white p-0.5 border border-gray-200 object-cover">
      <div class="bg-white border border-gray-200/90 rounded-2xl rounded-bl-sm p-1.5 shadow-sm max-w-[85%] cursor-pointer group" onclick="openLightbox('${imageUrl}')">
        <img src="${imageUrl}" alt="Imagem do fluxo" class="rounded-xl max-h-72 w-auto object-cover group-hover:opacity-90 transition-all shadow-xs">
        <div class="text-[11px] text-emerald-700 font-semibold text-right px-1 pt-1 flex items-center justify-end gap-1">
          <span>🔍 Toque para ampliar</span>
        </div>
      </div>
    `;
    this.chatContainer.appendChild(msgEl);
    this.scrollToBottom(false);
    this.saveStateToStorage();
  }

  renderButtons(step) {
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'flex flex-col gap-2 pl-10 pr-2 my-2 animate-pop-in max-w-2xl w-full mx-auto';

    step.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'w-full text-left bg-white hover:bg-emerald-50 border-2 border-emerald-200 hover:border-emerald-600 text-gray-800 font-medium py-3 px-4 rounded-xl shadow-sm transition-all duration-200 flex items-center justify-between group cursor-pointer';

      if (opt.url) {
        btn.innerHTML = `
          <span class="group-hover:translate-x-1 transition-transform text-sm md:text-base font-bold text-emerald-800">${this.interpolate(opt.label)}</span>
          <svg class="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
        `;
        btn.addEventListener('click', () => {
          this.answers['clicou_cadastro'] = true;
          this.answers['etapa_atual'] = '🔥 Clicou em Cadastrar (' + opt.label + ')';
          this.answers['ultimo_clique'] = opt.label;
          if (step.variable) {
            this.answers[step.variable] = opt.label;
          }
          this.saveLead();

          window.open(opt.url, '_blank');
          optionsContainer.remove();
          this.renderUserMessage(opt.label);
          const nextId = opt.nextStepId || step.nextStepId;
          if (nextId) {
            setTimeout(() => this.executeStep(nextId), 600);
          }
        });
      } else {
        btn.innerHTML = `
          <span class="group-hover:translate-x-1 transition-transform text-sm md:text-base">${this.interpolate(opt.label)}</span>
          <svg class="w-4 h-4 text-gray-400 opacity-60 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        `;
        btn.addEventListener('click', () => {
          const varKey = step.variable || ('escolha_' + (step.id || 'btn'));
          this.answers[varKey] = opt.label;
          this.answers['etapa_atual'] = 'Avançou: ' + opt.label;
          this.answers['ultimo_clique'] = opt.label;
          this.saveLead();

          optionsContainer.remove();
          this.renderUserMessage(opt.label);
          const nextId = opt.nextStepId || step.nextStepId;
          if (nextId) {
            setTimeout(() => this.executeStep(nextId), 400);
          }
        });
      }

      optionsContainer.appendChild(btn);
    });

    this.chatContainer.appendChild(optionsContainer);
    this.scrollToBottom(false);
  }

  renderRatingStars(step) {
    const container = document.createElement('div');
    container.className = 'flex items-center justify-center gap-2 pl-10 pr-2 my-3 p-3 bg-white/70 rounded-2xl border border-gray-100 animate-pop-in max-w-2xl w-full mx-auto';

    for (let star = 1; star <= 5; star++) {
      const starBtn = document.createElement('button');
      starBtn.className = 'text-3xl p-2 hover:scale-125 transition-transform duration-150 cursor-pointer focus:outline-none';
      starBtn.innerHTML = '⭐';
      starBtn.title = `${star} estrelas`;

      starBtn.addEventListener('click', () => {
        container.remove();
        this.renderUserMessage(`Avaliação: ${'⭐'.repeat(star)} (${star}/5)`);
        if (step.variable) {
          this.answers[step.variable] = `${star} estrelas`;
        }
        this.answers['etapa_atual'] = `Avaliou com ${star} estrelas`;
        this.saveLead();
        if (step.nextStepId) {
          setTimeout(() => this.executeStep(step.nextStepId), 500);
        }
      });
      container.appendChild(starBtn);
    }

    this.chatContainer.appendChild(container);
    this.scrollToBottom(false);
  }

  renderWhatsappCTA(step) {
    const zapNumber = (this.flow.settings.companyWhatsapp || '').replace(/\D/g, '');
    let customText = step.customMessage || "Olá, gostaria de dar continuidade ao meu atendimento!";
    customText = this.interpolate(customText);

    const waLink = `https://wa.me/${zapNumber}?text=${encodeURIComponent(customText)}`;

    // Registra no painel que o cliente concluiu todas as etapas e chegou ao fim
    this.answers['chegou_ao_fim'] = true;
    this.answers['etapa_atual'] = '🏆 Chegou ao final do funil';
    this.saveLead();

    const ctaContainer = document.createElement('div');
    ctaContainer.className = 'pl-10 pr-2 my-4 animate-pop-in max-w-2xl w-full mx-auto';
    ctaContainer.innerHTML = `
      <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg hover:shadow-emerald-500/30 transition-all flex items-center justify-center gap-3 text-base text-center transform hover:-translate-y-0.5">
        <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.353.101.173.449.741.964 1.2 1.349 1.2 2.378 1.385 2.68 1.488.246.084.391-.014.536-.145.144-.13.621-.724.787-.97.166-.246.332-.202.557-.116.224.087 1.423.67 1.668.793.245.122.408.181.468.283.06.101.06 1.055-.084 1.46z"/></svg>
        <span>${step.buttonText || 'Abrir WhatsApp'}</span>
      </a>
      <div class="mt-2 text-center text-xs text-gray-500">
        Clique para ser atendido(a) diretamente pelo nosso WhatsApp
      </div>
    `;

    const zapLinkEl = ctaContainer.querySelector('a');
    if (zapLinkEl) {
      zapLinkEl.addEventListener('click', () => {
        this.answers['clicou_whatsapp'] = true;
        this.answers['etapa_atual'] = '💬 Chamou no WhatsApp';
        this.saveLead();
      });
    }

    this.chatContainer.appendChild(ctaContainer);
    this.scrollToBottom(false);

    // Ativa campo de tirar dúvidas com Inteligência Artificial
    this.isAIMode = true;
    this.inputArea.classList.remove('hidden');
    this.textInput.placeholder = 'Ficou com alguma dúvida? Pergunte aqui...';
    this.textInput.value = '';

    setTimeout(() => {
      this.renderBotMessage("💬 **Ficou com alguma dúvida sobre fornecedores, frete ou acesso?**\n\nPode digitar sua pergunta aqui embaixo que eu te respondo agora mesmo! 👇");
    }, 1200);
  }

  showTextInput(step) {
    this.inputArea.classList.remove('hidden');
    this.textInput.value = '';
    this.textInput.placeholder = step.placeholder || 'Digite sua resposta...';

    if (step.type === 'input_email') {
      this.textInput.type = 'email';
    } else if (step.type === 'input_phone') {
      this.textInput.type = 'tel';
    } else {
      this.textInput.type = 'text';
    }

    this.textInput.focus();
  }

  hideInput() {
    this.inputArea.classList.add('hidden');
  }

  async handleAIQuestion(question) {
    this.textInput.value = '';
    this.renderUserMessage(question);
    this.playBeepSound();

    await this.showTypingIndicator();

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question,
          sessionId: this.sessionId,
          answers: this.answers
        })
      });
      const data = await res.json();
      const reply = data.answer || "Estou à disposição para te ajudar! Caso queira tirar mais dúvidas ou confirmar seu acesso, você pode clicar no botão acima para escolher seu plano ou me chamar no WhatsApp!";
      this.renderBotMessage(reply);
      this.playBeepSound();
    } catch (err) {
      console.error('Erro na IA:', err);
      this.renderBotMessage("Tive uma pequena oscilação aqui, mas você pode tirar qualquer dúvida diretamente no nosso WhatsApp pelo botão acima! ✨");
    }

    this.textInput.focus();
  }

  handleUserTextSubmit() {
    const rawVal = this.textInput.value.trim();
    if (!rawVal) return;

    if (this.isAIMode) {
      this.handleAIQuestion(rawVal);
      return;
    }

    const step = this.getStepById(this.currentStepId);
    if (!step) return;

    // Validação de E-mail
    if (step.type === 'input_email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(rawVal)) {
        alert('Por favor, informe um endereço de e-mail válido.');
        return;
      }
    }

    // Validação de Telefone
    if (step.type === 'input_phone') {
      const digits = rawVal.replace(/\D/g, '');
      if (digits.length < 10) {
        alert('Por favor, informe o telefone com DDD (ex: 11 99999-9999).');
        return;
      }
    }

    // Salva resposta
    const variableName = step.variable || (step.type === 'input_name' ? 'nome' : 'resposta');
    this.answers[variableName] = rawVal;
    this.answers['etapa_atual'] = 'Respondeu: ' + variableName;

    this.renderUserMessage(rawVal);
    this.hideInput();

    // Salva progresso incremental
    this.saveLead();

    if (step.nextStepId) {
      setTimeout(() => this.executeStep(step.nextStepId), 500);
    }
  }

  async saveLead(extra = {}) {
    try {
      if (extra && typeof extra === 'object') {
        Object.assign(this.answers, extra);
      }
      this.saveStateToStorage();
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          answers: this.answers,
          etapaAtual: this.answers.etapa_atual || 'Iniciou Atendimento',
          clicouCadastro: !!this.answers.clicou_cadastro,
          clicouWhatsapp: !!this.answers.clicou_whatsapp,
          chegouAoFim: !!this.answers.chegou_ao_fim
        })
      });
    } catch (err) {
      console.warn('Erro ao salvar lead:', err);
    }
  }

  interpolate(text) {
    if (!text) return '';
    return text.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, p1) => {
      return this.answers[p1] || '';
    });
  }

  formatMarkdown(text) {
    if (!text) return '';
    let escaped = this.escapeHtml(text);
    // Links [texto](url)
    escaped = escaped.replace(/\[(.*?)\]\((https?:\/\/.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-emerald-700 underline font-bold hover:text-emerald-900">$1 🔗</a>');
    // Negrito **texto** ou *texto*
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    // Quebras de linha
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

  setupScrollListener() {
    this.newMessagesPill = document.getElementById('new-messages-pill');
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
    // Se a distância do scroll até o fundo for maior que 130px, o usuário está lendo mensagens anteriores
    const distanceToBottom = this.chatContainer.scrollHeight - this.chatContainer.scrollTop - this.chatContainer.clientHeight;
    return distanceToBottom > 130;
  }

  showNewMessageAlert() {
    if (this.newMessagesPill) {
      this.newMessagesPill.classList.remove('hidden');
    }
  }

  hideNewMessageAlert() {
    if (this.newMessagesPill) {
      this.newMessagesPill.classList.add('hidden');
    }
  }

  scrollToBottom(force = false) {
    if (!this.chatContainer) return;

    // Se o usuário rolou para cima e a nova mensagem veio do bot, NÃO força o scroll para não atrapalhar a leitura!
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
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // A5

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch (e) {
      // Navegadores podem bloquear áudio antes da 1a interação
    }
  }

  saveStateToStorage() {
    try {
      if (!this.chatContainer) return;
      sessionStorage.setItem('typebot_history_html', this.chatContainer.innerHTML);
      sessionStorage.setItem('typebot_answers', JSON.stringify(this.answers));
      sessionStorage.setItem('typebot_current_step', this.currentStepId || '');
    } catch (e) {}
  }

  showSystemMessage(msg) {
    const el = document.createElement('div');
    el.className = 'text-center my-4 text-xs text-red-500 bg-red-50 p-2 rounded';
    el.textContent = msg;
    this.chatContainer.appendChild(el);
  }
}

// Funções globais de Lightbox (Zoom de imagem na mesma página sem reset)
window.openLightbox = function(url) {
  const lb = document.getElementById('image-lightbox');
  const img = document.getElementById('lightbox-img');
  if (lb && img) {
    img.src = url;
    lb.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
};

window.closeLightbox = function() {
  const lb = document.getElementById('image-lightbox');
  if (lb) {
    lb.classList.add('hidden');
    document.body.style.overflow = '';
  }
};

// Inicia ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  window.typebot = new TypebotChat();
});

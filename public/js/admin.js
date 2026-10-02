// Admin Dashboard & Flow Builder Logic
let currentFlow = { settings: {}, steps: [] };
let currentLeads = [];
let editingStepIndex = null;

const ADMIN_PASS = 'leticia2026';

document.addEventListener('DOMContentLoaded', async () => {
  checkAdminAuth();
  await loadFlow();
  await loadLeads();
  await loadCompradores();
  setupSettingsSync();

  document.getElementById('save-all-btn').addEventListener('click', saveFlowToServer);
});

function checkAdminAuth() {
  const isAuth = sessionStorage.getItem('admin_authenticated') === 'true';
  const overlay = document.getElementById('admin-login-overlay');
  if (overlay) {
    if (isAuth) {
      overlay.classList.add('hidden');
    } else {
      overlay.classList.remove('hidden');
    }
  }
}

function handleAdminLogin(event) {
  event.preventDefault();
  const input = document.getElementById('admin-pass-input');
  const error = document.getElementById('admin-pass-error');
  const val = (input.value || '').trim();

  if (val === ADMIN_PASS || val === 'admin123') {
    sessionStorage.setItem('admin_authenticated', 'true');
    checkAdminAuth();
    showToast('🔓 Acesso liberado!');
  } else {
    error.classList.remove('hidden');
    input.focus();
  }
}

function handleAdminLogout() {
  sessionStorage.removeItem('admin_authenticated');
  checkAdminAuth();
  showToast('🔒 Painel bloqueado!');
}

// Navigation Tabs
function switchTab(tabName) {
  document.querySelectorAll('.tab-section').forEach(sec => sec.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('text-indigo-600', 'bg-indigo-50');
    btn.classList.add('text-gray-600');
  });

  const activeSection = document.getElementById(`section-${tabName}`);
  if (activeSection) activeSection.classList.remove('hidden');

  const activeBtn = document.getElementById(`tab-btn-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-gray-600');
    activeBtn.classList.add('text-indigo-600', 'bg-indigo-50');
  }

  if (tabName === 'leads') {
    loadLeads();
  }
  if (tabName === 'compradores') {
    loadCompradores();
  }
}

// Carregar Fluxo da API
async function loadFlow() {
  try {
    const res = await fetch('/api/flow');
    currentFlow = await res.json();
    renderStepsList();
    populateSettingsInputs();
  } catch (err) {
    showToast('❌ Erro ao carregar fluxo da API');
  }
}

// Salvar Fluxo Completo no Servidor
async function saveFlowToServer() {
  try {
    const res = await fetch('/api/flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentFlow)
    });
    if (res.ok) {
      showToast('✅ Fluxo salvo com sucesso!');
      reloadPreview();
    } else {
      showToast('❌ Falha ao salvar no servidor.');
    }
  } catch (e) {
    showToast('❌ Erro de conexão.');
  }
}

// Renderizar Lista de Blocos no Builder
function renderStepsList() {
  const container = document.getElementById('steps-container');
  container.innerHTML = '';

  if (!currentFlow.steps || currentFlow.steps.length === 0) {
    container.innerHTML = `
      <div class="text-center p-8 bg-white rounded-2xl border border-gray-200 text-gray-500">
        Nenhum bloco cadastrado. Clique no botão abaixo para adicionar o primeiro passo!
      </div>
    `;
    return;
  }

  currentFlow.steps.forEach((step, index) => {
    const card = document.createElement('div');
    card.className = 'bg-white p-4 rounded-2xl border border-gray-200/90 hover:border-indigo-300 shadow-xs hover:shadow-md transition-all flex items-start justify-between gap-3 group';

    const typeInfo = getTypeBadge(step.type);

    card.innerHTML = `
      <div class="flex items-start gap-3 flex-1 min-w-0">
        <div class="w-9 h-9 rounded-xl ${typeInfo.bg} ${typeInfo.text} flex items-center justify-center font-bold text-base flex-shrink-0 mt-0.5 shadow-2xs">
          ${typeInfo.icon}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-bold px-2 py-0.5 rounded-md ${typeInfo.bg} ${typeInfo.text}">
              ${typeInfo.label}
            </span>
            <span class="text-xs font-mono text-gray-400">ID: ${step.id}</span>
            ${step.variable ? `<span class="text-xs font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">Salva em: {{${step.variable}}}</span>` : ''}
          </div>
          <p class="text-sm text-gray-800 font-medium mt-1 truncate max-w-full">
            ${escapeHtml(step.content || '')}
          </p>
          ${renderStepExtras(step)}
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex items-center gap-1 flex-shrink-0">
        <button onclick="moveStep(${index}, -1)" ${index === 0 ? 'disabled' : ''} title="Mover para cima" class="p-1.5 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-gray-400 rounded-lg hover:bg-gray-100">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
        </button>
        <button onclick="moveStep(${index}, 1)" ${index === currentFlow.steps.length - 1 ? 'disabled' : ''} title="Mover para baixo" class="p-1.5 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-gray-400 rounded-lg hover:bg-gray-100">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <button onclick="openEditStepModal(${index})" title="Editar bloco" class="p-1.5 text-indigo-600 hover:text-indigo-800 rounded-lg hover:bg-indigo-50">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button onclick="deleteStep(${index})" title="Excluir bloco" class="p-1.5 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

function renderStepExtras(step) {
  if (step.type === 'buttons' && step.options) {
    const list = step.options.map(o => `<span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs">${escapeHtml(o.label)}</span>`).join(' ');
    return `<div class="mt-2 flex flex-wrap gap-1">${list}</div>`;
  }
  if (step.type === 'redirect_whatsapp') {
    return `<div class="mt-1 text-xs text-emerald-600 font-semibold flex items-center gap-1">💬 Botão: "${step.buttonText || 'Abrir WhatsApp'}"</div>`;
  }
  if (step.type === 'audio') {
    return `<div class="mt-1 text-xs text-emerald-700 font-medium flex items-center gap-1">🎙️ Mensagem de Voz: <span class="text-gray-500 font-mono text-[11px]">${(step.audioUrl || '').substring(0, 50)}...</span></div>`;
  }
  if (step.type === 'image') {
    return `<div class="mt-1 text-xs text-teal-700 font-medium flex items-center gap-1">🖼️ Imagem: <a href="${step.imageUrl}" target="_blank" class="text-teal-600 underline text-[11px]">Ver imagem</a></div>`;
  }
  return '';
}

function getTypeBadge(type) {
  switch (type) {
    case 'message': return { icon: '💬', label: 'Mensagem', bg: 'bg-blue-50', text: 'text-blue-700' };
    case 'audio': return { icon: '🎙️', label: 'Áudio (Voz)', bg: 'bg-emerald-50', text: 'text-emerald-700' };
    case 'image': return { icon: '🖼️', label: 'Imagem', bg: 'bg-teal-50', text: 'text-teal-700' };
    case 'input_name': return { icon: '👤', label: 'Pedir Nome', bg: 'bg-emerald-50', text: 'text-emerald-700' };
    case 'input_phone': return { icon: '📱', label: 'Pedir WhatsApp', bg: 'bg-green-50', text: 'text-green-700' };
    case 'input_email': return { icon: '✉️', label: 'Pedir E-mail', bg: 'bg-purple-50', text: 'text-purple-700' };
    case 'input_text': return { icon: '📝', label: 'Pergunta Livre', bg: 'bg-yellow-50', text: 'text-yellow-700' };
    case 'buttons': return { icon: '🔘', label: 'Botões de Escolha', bg: 'bg-indigo-50', text: 'text-indigo-700' };
    case 'rating': return { icon: '⭐', label: 'Avaliação Estrelas', bg: 'bg-amber-50', text: 'text-amber-700' };
    case 'redirect_whatsapp': return { icon: '🚀', label: 'Finalizar no WhatsApp', bg: 'bg-emerald-100', text: 'text-emerald-800' };
    default: return { icon: '⚙️', label: type, bg: 'bg-gray-100', text: 'text-gray-700' };
  }
}

// Mover bloco para cima/baixo
function moveStep(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= currentFlow.steps.length) return;

  const temp = currentFlow.steps[index];
  currentFlow.steps[index] = currentFlow.steps[newIndex];
  currentFlow.steps[newIndex] = temp;

  renderStepsList();
  saveFlowToServer();
}

function deleteStep(index) {
  if (confirm('Deseja realmente remover esta etapa do atendimento?')) {
    currentFlow.steps.splice(index, 1);
    renderStepsList();
    saveFlowToServer();
  }
}

// Modal de Adicionar / Editar Passo
function openAddStepModal() {
  editingStepIndex = null;
  document.getElementById('modal-title').textContent = 'Adicionar Novo Bloco de Conversa';
  document.getElementById('modal-step-id').value = 'step_' + Date.now();
  document.getElementById('modal-step-type').value = 'message';
  document.getElementById('modal-step-content').value = '';
  document.getElementById('modal-step-variable').value = '';
  document.getElementById('modal-step-placeholder').value = '';
  document.getElementById('modal-step-audiourl').value = '';
  document.getElementById('modal-step-imageurl').value = '';
  document.getElementById('modal-cta-button-text').value = 'Continuar no WhatsApp';
  document.getElementById('modal-cta-message').value = 'Olá, meu nome é {{nome}} e quero saber mais!';

  populateNextStepSelect(null);
  handleModalTypeChange();
  document.getElementById('step-modal').classList.remove('hidden');
}

function openEditStepModal(index) {
  editingStepIndex = index;
  const step = currentFlow.steps[index];

  document.getElementById('modal-title').textContent = 'Editar Bloco: ' + step.id;
  document.getElementById('modal-step-id').value = step.id;
  document.getElementById('modal-step-type').value = step.type || 'message';
  document.getElementById('modal-step-content').value = step.content || '';
  document.getElementById('modal-step-variable').value = step.variable || '';
  document.getElementById('modal-step-placeholder').value = step.placeholder || '';
  document.getElementById('modal-step-audiourl').value = step.audioUrl || '';
  document.getElementById('modal-step-imageurl').value = step.imageUrl || '';
  document.getElementById('modal-cta-button-text').value = step.buttonText || 'Continuar no WhatsApp';
  document.getElementById('modal-cta-message').value = step.customMessage || '';

  populateNextStepSelect(step.nextStepId);
  handleModalTypeChange();

  // Se for botões, renderiza lista
  if (step.type === 'buttons' && step.options) {
    const list = document.getElementById('modal-buttons-list');
    list.innerHTML = '';
    step.options.forEach(opt => addModalButtonOption(opt.label, opt.nextStepId));
  }

  document.getElementById('step-modal').classList.remove('hidden');
}

function closeStepModal() {
  document.getElementById('step-modal').classList.add('hidden');
}

function handleModalTypeChange() {
  const type = document.getElementById('modal-step-type').value;

  const showVar = ['input_text', 'input_name', 'input_phone', 'input_email', 'buttons', 'rating'].includes(type);
  const showPlaceholder = ['input_text', 'input_name', 'input_phone', 'input_email'].includes(type);
  const showButtons = type === 'buttons';
  const showWhatsappCTA = type === 'redirect_whatsapp';
  const showAudio = type === 'audio';
  const showImage = type === 'image';

  document.getElementById('modal-field-variable').classList.toggle('hidden', !showVar);
  document.getElementById('modal-field-placeholder').classList.toggle('hidden', !showPlaceholder);
  document.getElementById('modal-field-buttons').classList.toggle('hidden', !showButtons);
  document.getElementById('modal-field-whatsapp-cta').classList.toggle('hidden', !showWhatsappCTA);
  document.getElementById('modal-field-audio').classList.toggle('hidden', !showAudio);
  document.getElementById('modal-field-image').classList.toggle('hidden', !showImage);

  if (showButtons) {
    const list = document.getElementById('modal-buttons-list');
    if (list.children.length === 0) {
      addModalButtonOption('Opção 1');
      addModalButtonOption('Opção 2');
    }
  }
}

function addModalButtonOption(label = '', targetNext = '') {
  const list = document.getElementById('modal-buttons-list');
  const optId = 'opt_' + Math.random().toString(36).substring(2, 7);

  const div = document.createElement('div');
  div.className = 'flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-xl';
  div.innerHTML = `
    <input type="text" class="opt-label-input flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500" placeholder="Texto do botão..." value="${escapeHtml(label)}">
    <select class="opt-target-select bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none text-gray-700">
      <option value="">(Próximo padrão)</option>
      ${currentFlow.steps.map(s => `<option value="${s.id}" ${s.id === targetNext ? 'selected' : ''}>Ir para: ${s.id}</option>`).join('')}
    </select>
    <button type="button" onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700 p-1">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;
  list.appendChild(div);
}

function populateNextStepSelect(selectedNextId) {
  const select = document.getElementById('modal-step-next');
  select.innerHTML = '<option value="">(Fim da conversa / Aguardar)</option>';

  currentFlow.steps.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.id} - ${s.type}`;
    if (s.id === selectedNextId) opt.selected = true;
    select.appendChild(opt);
  });
}

function saveModalStep() {
  const stepId = document.getElementById('modal-step-id').value;
  const type = document.getElementById('modal-step-type').value;
  const content = document.getElementById('modal-step-content').value;
  const variable = document.getElementById('modal-step-variable').value;
  const placeholder = document.getElementById('modal-step-placeholder').value;
  const nextStepId = document.getElementById('modal-step-next').value;
  const buttonText = document.getElementById('modal-cta-button-text').value;
  const customMessage = document.getElementById('modal-cta-message').value;

  const newStep = {
    id: stepId,
    type: type,
    content: content,
    nextStepId: nextStepId || undefined
  };

  if (variable) newStep.variable = variable;
  if (placeholder) newStep.placeholder = placeholder;

  if (type === 'buttons') {
    const options = [];
    document.querySelectorAll('#modal-buttons-list > div').forEach((row, i) => {
      const label = row.querySelector('.opt-label-input').value.trim();
      const target = row.querySelector('.opt-target-select').value;
      if (label) {
        options.push({
          id: 'opt_' + i,
          label: label,
          nextStepId: target || undefined
        });
      }
    });
    newStep.options = options;
  }

  if (type === 'audio') {
    newStep.audioUrl = document.getElementById('modal-step-audiourl').value.trim();
  }

  if (type === 'image') {
    newStep.imageUrl = document.getElementById('modal-step-imageurl').value.trim();
  }

  if (type === 'redirect_whatsapp') {
    newStep.buttonText = buttonText;
    newStep.customMessage = customMessage;
  }

  if (editingStepIndex !== null) {
    currentFlow.steps[editingStepIndex] = newStep;
  } else {
    currentFlow.steps.push(newStep);
  }

  closeStepModal();
  renderStepsList();
  saveFlowToServer();
}

// Importar arquivo JSON exportado do Typebot
async function handleImportJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.groups && data.edges) {
        // Formato oficial do Typebot
        showToast('⏳ Processando funil do Typebot...');
        const res = await fetch('/api/import-typebot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success && result.flow) {
          currentFlow = result.flow;
          renderStepsList();
          populateSettingsInputs();
          reloadPreview();
          showToast(`✅ ${result.count} blocos importados com sucesso!`);
        } else {
          alert('Erro ao converter: ' + (result.error || 'Falha desconhecida'));
        }
      } else if (data.steps && data.settings) {
        // Formato do nosso app
        currentFlow = data;
        renderStepsList();
        populateSettingsInputs();
        await saveFlowToServer();
        showToast('✅ Fluxo carregado com sucesso!');
      } else {
        alert('Formato de arquivo JSON não reconhecido.');
      }
    } catch (err) {
      alert('Erro ao ler arquivo: ' + err.message);
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

// Configurações e Aparência
function populateSettingsInputs() {
  const s = currentFlow.settings || {};
  document.getElementById('setting-bot-name').value = s.botName || '';
  document.getElementById('setting-bot-subtitle').value = s.botSubtitle || '';
  document.getElementById('setting-bot-avatar').value = s.botAvatar || '';
  document.getElementById('avatar-preview-img').src = s.botAvatar || '/images/leticia.jpg';
  document.getElementById('setting-primary-color').value = s.primaryColor || '#4F46E5';
  document.getElementById('setting-primary-color-text').value = s.primaryColor || '#4F46E5';
  document.getElementById('setting-company-whatsapp').value = s.companyWhatsapp || '';
  document.getElementById('setting-gemini-key').value = s.geminiApiKey || '';
  document.getElementById('setting-webhook-url').value = s.webhookUrl || '';
}

function setupSettingsSync() {
  const colorPicker = document.getElementById('setting-primary-color');
  const colorText = document.getElementById('setting-primary-color-text');

  colorPicker.addEventListener('input', (e) => {
    colorText.value = e.target.value;
  });

  colorText.addEventListener('input', (e) => {
    if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
      colorPicker.value = e.target.value;
    }
  });
}

function updateAvatarPreview(url) {
  document.getElementById('avatar-preview-img').src = url;
}

function saveSettings() {
  if (!currentFlow.settings) currentFlow.settings = {};
  currentFlow.settings.botName = document.getElementById('setting-bot-name').value;
  currentFlow.settings.botSubtitle = document.getElementById('setting-bot-subtitle').value;
  currentFlow.settings.botAvatar = document.getElementById('setting-bot-avatar').value;
  currentFlow.settings.primaryColor = document.getElementById('setting-primary-color-text').value;
  currentFlow.settings.companyWhatsapp = document.getElementById('setting-company-whatsapp').value;
  currentFlow.settings.geminiApiKey = document.getElementById('setting-gemini-key').value.trim();
  currentFlow.settings.webhookUrl = document.getElementById('setting-webhook-url').value;

  saveFlowToServer();
}

// Leads Management
async function loadLeads() {
  try {
    const res = await fetch('/api/leads');
    currentLeads = await res.json();
    renderLeadsTable();
  } catch (err) {
    console.error('Erro ao carregar leads:', err);
  }
}

function renderLeadsTable() {
  const tbody = document.getElementById('leads-table-body');
  tbody.innerHTML = '';

  const total = currentLeads.length;
  const cadastros = currentLeads.filter(l => l.clicouCadastro || (l.answers && l.answers.clicou_cadastro)).length;
  const finalizados = currentLeads.filter(l => l.chegouAoFim || (l.answers && l.answers.chegou_ao_fim)).length;
  const zapClicks = currentLeads.filter(l => l.clicouWhatsapp || (l.answers && l.answers.clicou_whatsapp)).length;
  const avancaram = currentLeads.filter(l => {
    if (l.clicouCadastro || l.chegouAoFim || l.clicouWhatsapp) return true;
    if (!l.answers) return false;
    const ansKeys = Object.keys(l.answers).filter(k => !['etapa_atual'].includes(k));
    return ansKeys.length > 0;
  }).length;

  if (document.getElementById('stat-total-leads')) document.getElementById('stat-total-leads').textContent = total;
  if (document.getElementById('stat-avancaram-leads')) document.getElementById('stat-avancaram-leads').textContent = avancaram;
  if (document.getElementById('stat-cadastro-leads')) document.getElementById('stat-cadastro-leads').textContent = cadastros;
  if (document.getElementById('stat-fim-leads')) document.getElementById('stat-fim-leads').textContent = finalizados;
  if (document.getElementById('stat-whatsapp-leads')) document.getElementById('stat-whatsapp-leads').textContent = zapClicks;
  if (document.getElementById('leads-badge')) document.getElementById('leads-badge').textContent = total;

  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-5 py-8 text-center text-gray-400">
          Nenhum visitante registrado ainda. Quando alguém interagir com o bot, os passos aparecerão aqui em tempo real!
        </td>
      </tr>
    `;
    return;
  }

  currentLeads.forEach(lead => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-colors';

    const dInicio = new Date(lead.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' (' + new Date(lead.createdAt).toLocaleDateString('pt-BR') + ')';
    const dUpdate = lead.updatedAt && lead.updatedAt !== lead.createdAt
      ? new Date(lead.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : null;

    const hasCadastro = !!(lead.clicouCadastro || (lead.answers && lead.answers.clicou_cadastro));
    const hasWhatsapp = !!(lead.clicouWhatsapp || (lead.answers && lead.answers.clicou_whatsapp));
    const hasFim = !!(lead.chegouAoFim || (lead.answers && lead.answers.chegou_ao_fim));

    let etapaBadge = '';
    if (hasCadastro) {
      etapaBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">🔥 Clicou em Cadastrar</span>';
    } else if (hasWhatsapp) {
      etapaBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300">💬 Chamou no WhatsApp</span>';
    } else if (hasFim) {
      etapaBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">🏆 Chegou ao Fim</span>';
    } else {
      const etapaTxt = escapeHtml(lead.etapaAtual || 'Iniciou Atendimento');
      etapaBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">${etapaTxt}</span>`;
    }

    const zapNumber = (lead.whatsapp || '').replace(/\D/g, '');
    const waLink = zapNumber ? `https://wa.me/55${zapNumber}` : null;

    tr.innerHTML = `
      <td class="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500 font-mono">
        <div>${dInicio}</div>
        ${dUpdate ? `<div class="text-[10px] text-gray-400">Última ação: ${dUpdate}</div>` : ''}
      </td>
      <td class="px-5 py-3.5">
        <div class="font-bold text-gray-900 text-xs sm:text-sm">${escapeHtml(lead.name || 'Visitante')}</div>
        <div class="text-[11px] text-gray-400 font-mono">${escapeHtml(lead.sessionId || '')}</div>
        ${lead.whatsapp ? `
          <a href="${waLink}" target="_blank" class="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold hover:underline mt-0.5">
            💬 ${escapeHtml(lead.whatsapp)}
          </a>
        ` : ''}
      </td>
      <td class="px-5 py-3.5 whitespace-nowrap">
        ${etapaBadge}
      </td>
      <td class="px-5 py-3.5 text-center whitespace-nowrap">
        ${hasCadastro 
          ? '<span class="inline-block px-2.5 py-1 text-xs font-black rounded-lg bg-emerald-500 text-white shadow-xs">SIM 🔥</span>' 
          : '<span class="text-xs text-gray-400 font-medium">Não</span>'}
      </td>
      <td class="px-5 py-3.5 text-center whitespace-nowrap">
        ${hasWhatsapp 
          ? '<span class="inline-block px-2.5 py-1 text-xs font-black rounded-lg bg-emerald-600 text-white shadow-xs">SIM 💬</span>' 
          : '<span class="text-xs text-gray-400 font-medium">Não</span>'}
      </td>
      <td class="px-5 py-3.5 text-xs text-gray-700 max-w-sm">
        ${renderAnswersSummary(lead.answers)}
      </td>
      <td class="px-5 py-3.5 text-right whitespace-nowrap">
        <button onclick="deleteLead('${lead.id}')" class="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Excluir este registro">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function renderAnswersSummary(answers) {
  if (!answers || Object.keys(answers).length === 0) return '<span class="text-gray-400 italic">Nenhuma escolha ainda</span>';
  const ignoredKeys = ['etapa_atual', 'clicou_cadastro', 'clicou_whatsapp', 'chegou_ao_fim', 'nome', 'name', 'whatsapp', 'telefone', 'email', 'ultimo_clique'];
  const keys = Object.keys(answers).filter(k => !ignoredKeys.includes(k));
  if (keys.length === 0) {
    if (answers.ultimo_clique) {
      return `<span class="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">👉 ${escapeHtml(answers.ultimo_clique)}</span>`;
    }
    return '<span class="text-gray-400 italic">Iniciou conversa</span>';
  }
  return keys.map(k => {
    const val = answers[k];
    const cleanKey = k.replace(/^step_opt_/, '').replace(/^step_/, '').replace(/^opt_/, '').replace(/^escolha_/, '');
    return `<span class="inline-block px-2 py-0.5 m-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium"><strong>${escapeHtml(cleanKey)}:</strong> ${escapeHtml(String(val))}</span>`;
  }).join(' ');
}

// Auto-refresh a cada 8 segundos caso esteja no painel de leads
setInterval(() => {
  const leadsTab = document.getElementById('section-leads');
  if (leadsTab && !leadsTab.classList.contains('hidden')) {
    loadLeads();
  }
}, 8000);

async function deleteLead(leadId) {
  if (confirm('Deseja excluir este registro de lead?')) {
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Lead excluído');
        loadLeads();
      }
    } catch (e) {
      showToast('❌ Erro ao excluir');
    }
  }
}

// Simulador
function reloadPreview() {
  const frame = document.getElementById('preview-frame');
  if (frame) {
    frame.src = '/?t=' + Date.now();
  }
}

// Utilitários
function copyToClipboard(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    navigator.clipboard.writeText(el.innerText || el.textContent);
    showToast('📋 Código copiado!');
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  msgEl.textContent = message;

  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 2500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================
// GESTÃO DE COMPRADORES DA CACTUS (PÓS-VENDA)
// ==========================================
let currentCompradores = [];

async function loadCompradores() {
  try {
    const res = await fetch('/api/compradores');
    if (!res.ok) return;
    currentCompradores = await res.json();

    const badge = document.getElementById('compradores-badge');
    const totalText = document.getElementById('compradores-total-text');
    if (badge) badge.textContent = currentCompradores.length;
    if (totalText) totalText.textContent = `${currentCompradores.length} comprador(es)`;

    renderCompradoresTable();
  } catch (err) {
    console.error('Erro ao carregar compradores:', err);
  }
}

function renderCompradoresTable() {
  const tbody = document.getElementById('compradores-table-body');
  if (!tbody) return;

  if (currentCompradores.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-10 text-gray-400">
          <div class="text-2xl mb-1">📦</div>
          Nenhum comprador registrado ainda.<br>
          <span class="text-xs text-gray-400">As compras aprovadas da Cactus aparecerão aqui automaticamente, ou você pode cadastrar manualmente.</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = currentCompradores.map(c => {
    const dataCompra = c.paidAt ? new Date(c.paidAt).toLocaleString('pt-BR') : '-';
    const safeName = escapeHtml(c.name || 'Cliente');
    const safeEmail = escapeHtml(c.email || '-');
    const safePhone = escapeHtml(c.phone || '-');
    const safeProduct = escapeHtml(c.product || 'Plataforma');

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-6 py-4">
          <div class="font-bold text-gray-900">${safeName}</div>
          <div class="text-xs text-gray-400">${safePhone}</div>
        </td>
        <td class="px-6 py-4 font-mono text-xs text-indigo-700 font-semibold select-all">
          ${safeEmail}
        </td>
        <td class="px-6 py-4">
          <span class="inline-block bg-emerald-50 text-emerald-800 text-xs px-2.5 py-1 rounded-lg border border-emerald-200 font-medium">
            ${safeProduct}
          </span>
        </td>
        <td class="px-6 py-4 text-xs text-gray-500">
          ${dataCompra}
        </td>
        <td class="px-6 py-4 text-center">
          <span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Pago / VIP
          </span>
        </td>
        <td class="px-6 py-4 text-right">
          <button onclick="excluirComprador('${encodeURIComponent(c.email)}')" title="Remover comprador" class="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function abrirModalComprador() {
  const modal = document.getElementById('modal-add-comprador');
  if (modal) {
    document.getElementById('manual-comp-name').value = '';
    document.getElementById('manual-comp-email').value = '';
    modal.classList.remove('hidden');
    document.getElementById('manual-comp-name').focus();
  }
}

function fecharModalComprador() {
  const modal = document.getElementById('modal-add-comprador');
  if (modal) modal.classList.add('hidden');
}

async function handleSalvarCompradorManual(event) {
  event.preventDefault();
  const name = document.getElementById('manual-comp-name').value.trim();
  const email = document.getElementById('manual-comp-email').value.trim();
  const product = document.getElementById('manual-comp-product').value;

  try {
    const res = await fetch('/api/compradores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, product })
    });
    const data = await res.json();
    if (data.success) {
      fecharModalComprador();
      showToast('🎉 Comprador liberado com sucesso!');
      await loadCompradores();
    } else {
      alert('Erro: ' + (data.error || 'Não foi possível salvar.'));
    }
  } catch (err) {
    alert('Erro de conexão ao salvar comprador.');
  }
}

async function excluirComprador(encodedEmail) {
  const email = decodeURIComponent(encodedEmail);
  if (confirm(`Deseja remover o acesso do comprador ${email}?`)) {
    try {
      const res = await fetch(`/api/compradores/${encodedEmail}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Comprador removido');
        await loadCompradores();
      }
    } catch (e) {
      showToast('❌ Erro ao remover');
    }
  }
}

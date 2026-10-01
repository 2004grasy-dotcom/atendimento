// Admin Dashboard & Flow Builder Logic
let currentFlow = { settings: {}, steps: [] };
let currentLeads = [];
let editingStepIndex = null;

const ADMIN_PASS = 'leticia2026';

document.addEventListener('DOMContentLoaded', async () => {
  checkAdminAuth();
  await loadFlow();
  await loadLeads();
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
  document.getElementById('avatar-preview-img').src = s.botAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=VirtualBot';
  document.getElementById('setting-primary-color').value = s.primaryColor || '#4F46E5';
  document.getElementById('setting-primary-color-text').value = s.primaryColor || '#4F46E5';
  document.getElementById('setting-company-whatsapp').value = s.companyWhatsapp || '';
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
  const withZap = currentLeads.filter(l => l.whatsapp).length;
  const withEmail = currentLeads.filter(l => l.email).length;

  document.getElementById('stat-total-leads').textContent = total;
  document.getElementById('stat-whatsapp-leads').textContent = withZap;
  document.getElementById('stat-email-leads').textContent = withEmail;
  document.getElementById('leads-badge').textContent = total;

  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-5 py-8 text-center text-gray-400">
          Nenhum lead coletado até o momento. Teste seu bot no simulador ou compartilhe o link!
        </td>
      </tr>
    `;
    return;
  }

  currentLeads.forEach(lead => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-colors';

    const formattedDate = new Date(lead.createdAt).toLocaleString('pt-BR');
    const zapNumber = (lead.whatsapp || '').replace(/\D/g, '');
    const waLink = zapNumber ? `https://wa.me/55${zapNumber}?text=Olá%20${encodeURIComponent(lead.name || '')}` : null;

    tr.innerHTML = `
      <td class="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500 font-mono">${formattedDate}</td>
      <td class="px-5 py-3.5 font-semibold text-gray-900">${escapeHtml(lead.name || 'Anônimo')}</td>
      <td class="px-5 py-3.5 whitespace-nowrap">
        ${lead.whatsapp ? `
          <a href="${waLink}" target="_blank" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium text-xs border border-emerald-200">
            <span>💬 ${escapeHtml(lead.whatsapp)}</span>
          </a>
        ` : '<span class="text-gray-400 text-xs">-</span>'}
      </td>
      <td class="px-5 py-3.5 text-xs text-gray-600">${escapeHtml(lead.email || '-')}</td>
      <td class="px-5 py-3.5 text-xs text-gray-600 max-w-xs truncate" title='${escapeHtml(JSON.stringify(lead.answers, null, 2))}'>
        ${renderAnswersSummary(lead.answers)}
      </td>
      <td class="px-5 py-3.5 text-right whitespace-nowrap">
        <button onclick="deleteLead('${lead.id}')" class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50" title="Excluir">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function renderAnswersSummary(answers) {
  if (!answers) return '-';
  const keys = Object.keys(answers).filter(k => !['nome', 'name', 'whatsapp', 'telefone', 'email'].includes(k));
  if (keys.length === 0) return '<span class="text-gray-400">Dados básicos</span>';
  return keys.map(k => `<strong>${k}:</strong> ${answers[k]}`).join(' | ');
}

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

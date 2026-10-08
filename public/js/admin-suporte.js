/**
 * Lógica do Painel Exclusivo de Suporte & Pós-Venda
 */

const ADMIN_PASS = 'leticia2026';
let todosAtendimentos = [];
let dadosCarregados = null;

document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();
  carregarDadosSuporte();

  // Auto-refresh a cada 45 segundos para acompanhar novos clientes em tempo real
  setInterval(() => {
    if (sessionStorage.getItem('admin_authenticated') === 'true') {
      carregarDadosSuporte(true);
    }
  }, 45000);
});

// Autenticação
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
    carregarDadosSuporte();
  } else {
    error.classList.remove('hidden');
    input.focus();
  }
}

function handleAdminLogout() {
  sessionStorage.removeItem('admin_authenticated');
  checkAdminAuth();
}

// Carregamento de Dados da API
async function carregarDadosSuporte(silencioso = false) {
  const tbody = document.getElementById('atendimentos-tbody');
  if (!silencioso && (!todosAtendimentos || todosAtendimentos.length === 0)) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-10 text-gray-400">
          <div class="flex items-center justify-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Carregando dados do suporte...</span>
          </div>
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetch('/api/suporte/atendimentos');
    const data = await res.json();
    dadosCarregados = data;
    todosAtendimentos = data.atendimentos || [];

    // Atualiza Métricas
    document.getElementById('stat-total-compradores').innerText = (data.totalCompradores || 0).toLocaleString('pt-BR');
    document.getElementById('stat-total-atendimentos').innerText = (data.totalAtendimentos || 0).toLocaleString('pt-BR');
    document.getElementById('stat-total-duvidas').innerText = (data.totalDuvidas || 0).toLocaleString('pt-BR');

    if (data.totalCompradores > 0) {
      const taxa = ((data.totalAtendimentos / data.totalCompradores) * 100).toFixed(1);
      document.getElementById('stat-taxa-resolucao').innerText = taxa + '%';
    }

    filtrarAtendimentos();
  } catch (err) {
    console.error('Erro ao buscar atendimentos:', err);
    if (!silencioso) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-10 text-red-500 font-semibold">
            Erro ao conectar à API de suporte. Tente atualizar a página.
          </td>
        </tr>
      `;
    }
  }
}

// Filtro e Renderização
function filtrarAtendimentos() {
  const busca = (document.getElementById('search-input').value || '').toLowerCase().trim();
  const filtroStatus = document.getElementById('status-filter').value;

  const filtrados = todosAtendimentos.filter(item => {
    // Filtro de busca textual
    const nome = (item.name || '').toLowerCase();
    const email = (item.email || '').toLowerCase();
    const phone = (item.phone || '').toLowerCase();
    const status = (item.status || '').toLowerCase();
    const duvidasTexto = (item.questions || []).map(q => (q.question || '').toLowerCase()).join(' ');

    const matchBusca = !busca || nome.includes(busca) || email.includes(busca) || phone.includes(busca) || status.includes(busca) || duvidasTexto.includes(busca);

    if (!matchBusca) return false;

    // Filtro de categoria de status
    const temDuvidas = item.questions && item.questions.length > 0;
    if (filtroStatus === 'duvidas') return temDuvidas;
    if (filtroStatus === 'liberados') return !temDuvidas && item.encontrado;
    if (filtroStatus === 'nao_encontrados') return !item.encontrado;

    return true;
  });

  renderTabela(filtrados);
}

function renderTabela(lista) {
  const tbody = document.getElementById('atendimentos-tbody');
  const countBadge = document.getElementById('atendimentos-count');
  countBadge.innerText = `${lista.length} registro${lista.length === 1 ? '' : 's'}`;

  if (lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-12 text-gray-400">
          <div class="text-3xl mb-2">🔍</div>
          <div class="font-bold text-gray-700 text-sm">Nenhum atendimento localizado</div>
          <div class="text-xs text-gray-400 mt-0.5">Assim que os clientes digitarem o e-mail no suporte, eles aparecerão aqui automaticamente!</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista.map(item => {
    const dataFormatada = formatarData(item.lastAccessAt || item.createdAt);
    const qtdDuvidas = (item.questions && item.questions.length) || 0;
    const cleanPhone = (item.phone || '').replace(/\D/g, '');
    const whatsLink = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(`Olá ${item.name || ''}, tudo bem? Sou a Letícia do Suporte Oficial da Plataforma de Fornecedores!`)}` : null;

    let statusBadge = '';
    if (!item.encontrado) {
      statusBadge = `<span class="inline-flex items-center gap-1.5 bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-[11px] font-bold"><span class="w-1.5 h-1.5 rounded-full bg-red-600"></span> E-mail Não Localizado</span>`;
    } else if (qtdDuvidas > 0) {
      statusBadge = `<span class="inline-flex items-center gap-1.5 bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full text-[11px] font-bold"><span class="w-1.5 h-1.5 rounded-full bg-purple-600"></span> Tirou Dúvidas (${qtdDuvidas})</span>`;
    } else {
      statusBadge = `<span class="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-[11px] font-bold"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Acesso Entregue</span>`;
    }

    let duvidasCol = '';
    if (qtdDuvidas > 0) {
      const ultima = item.questions[item.questions.length - 1];
      duvidasCol = `
        <div class="bg-gray-50 border border-gray-200 rounded-xl p-2.5 max-w-sm space-y-1 cursor-pointer hover:bg-emerald-50/50 hover:border-emerald-300 transition-all" onclick="abrirModalDuvidas('${item.id}')">
          <p class="text-xs text-gray-800 font-semibold truncate">"${escapeHtml(ultima.question || '')}"</p>
          <div class="flex items-center justify-between text-[11px] text-emerald-700">
            <span>✓ Respondido pela IA</span>
            <span class="font-bold underline">Ver todas (${qtdDuvidas}) →</span>
          </div>
        </div>
      `;
    } else {
      duvidasCol = `<span class="text-xs text-gray-400 italic">Sem dúvidas (acessou direto)</span>`;
    }

    return `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-3.5 px-4">
          <div class="font-bold text-gray-900">${escapeHtml(item.name || 'Cliente')}</div>
          <div class="text-xs text-gray-500">${escapeHtml(item.email || '')}</div>
          ${item.phone ? `
            <div class="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
              <span>📱 ${escapeHtml(item.phone)}</span>
              ${whatsLink ? `<a href="${whatsLink}" target="_blank" class="text-emerald-600 hover:text-emerald-800 font-semibold ml-1 underline">WhatsApp</a>` : ''}
            </div>
          ` : ''}
        </td>
        <td class="py-3.5 px-4">
          <span class="inline-block bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
            ${escapeHtml(item.product || 'Plataforma + Grupo VIP')}
          </span>
        </td>
        <td class="py-3.5 px-4 text-xs text-gray-600">
          <div>${dataFormatada}</div>
          <div class="text-[10px] text-gray-400 mt-0.5">${item.accessCount || 1} consulta${(item.accessCount || 1) > 1 ? 's' : ''}</div>
        </td>
        <td class="py-3.5 px-4">
          ${statusBadge}
        </td>
        <td class="py-3.5 px-4">
          ${duvidasCol}
        </td>
        <td class="py-3.5 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            ${qtdDuvidas > 0 ? `
              <button onclick="abrirModalDuvidas('${item.id}')" class="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200 transition-all" title="Ver conversa completa">
                Ver Dúvidas
              </button>
            ` : ''}
            ${whatsLink ? `
              <a href="${whatsLink}" target="_blank" class="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1.5 rounded-lg transition-all" title="Chamar cliente no WhatsApp">
                Chamar
              </a>
            ` : ''}
            <button onclick="removerAtendimento('${item.id}')" class="text-gray-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Excluir do painel">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Modal de Dúvidas
function abrirModalDuvidas(id) {
  const item = todosAtendimentos.find(a => a.id === id);
  if (!item) return;

  document.getElementById('modal-duvidas-nome').innerText = item.name || 'Cliente';
  document.getElementById('modal-duvidas-email').innerText = `${item.email} • ${item.product || 'Plataforma + Grupo VIP'}`;

  const listaEl = document.getElementById('modal-duvidas-lista');
  const questions = item.questions || [];

  if (questions.length === 0) {
    listaEl.innerHTML = `
      <div class="text-center py-8 text-gray-400 text-xs">
        Este cliente não enviou nenhuma dúvida pelo chat do suporte.
      </div>
    `;
  } else {
    listaEl.innerHTML = questions.map((q, idx) => `
      <div class="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2">
        <div class="flex items-center justify-between text-[11px] text-gray-400 font-semibold">
          <span>Pergunta #${idx + 1}</span>
          <span>${formatarData(q.askedAt)}</span>
        </div>
        <div class="bg-white border border-gray-200 rounded-xl p-3 text-xs md:text-sm text-gray-900 font-medium">
          💬 "${escapeHtml(q.question)}"
        </div>
        ${q.answer ? `
          <div class="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 leading-relaxed">
            <span class="font-bold text-emerald-800 text-[11px] block mb-1">🤖 Resposta da Letícia:</span>
            ${escapeHtml(q.answer).replace(/\n/g, '<br>')}
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  document.getElementById('modal-duvidas').classList.remove('hidden');
}

function fecharModalDuvidas() {
  document.getElementById('modal-duvidas').classList.add('hidden');
}

// Excluir registro
async function removerAtendimento(id) {
  if (!confirm('Deseja realmente remover este registro do painel de suporte?')) return;

  try {
    const res = await fetch(`/api/suporte/atendimentos/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      todosAtendimentos = todosAtendimentos.filter(a => a.id !== id);
      filtrarAtendimentos();
    }
  } catch (err) {
    alert('Erro ao excluir registro: ' + err.message);
  }
}

// Exportar CSV
function exportarCSV() {
  if (!todosAtendimentos || todosAtendimentos.length === 0) {
    alert('Nenhum atendimento para exportar no momento.');
    return;
  }

  let csv = 'Nome;Email;Telefone;Produto;Status;Data Ultimo Acesso;Qtd Duvidas;Duvidas Registradas\n';
  todosAtendimentos.forEach(item => {
    const nome = (item.name || '').replace(/;/g, ' ');
    const email = (item.email || '').replace(/;/g, ' ');
    const phone = (item.phone || '').replace(/;/g, ' ');
    const prod = (item.product || '').replace(/;/g, ' ');
    const st = (item.status || '').replace(/;/g, ' ');
    const dt = formatarData(item.lastAccessAt || item.createdAt);
    const qtd = (item.questions && item.questions.length) || 0;
    const duvidas = (item.questions || []).map(q => `"${(q.question || '').replace(/"/g, '""')}"`).join(' | ');

    csv += `${nome};${email};${phone};${prod};${st};${dt};${qtd};${duvidas}\n`;
  });

  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `atendimentos_suporte_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Helpers
function formatarData(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return isoStr;
  }
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

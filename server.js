const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const FLOW_FILE = path.join(DATA_DIR, 'flow.json');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

// Helpers for reading/writing JSON files
function readJSON(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(fallback, null, 2), 'utf-8');
      return fallback;
    }
    const content = fs.readFileSync(file, 'utf-8');
    return JSON.parse(content || JSON.stringify(fallback));
  } catch (err) {
    console.error(`Erro ao ler arquivo ${file}:`, err);
    return fallback;
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Erro ao salvar arquivo ${file}:`, err);
    return false;
  }
}

// Rotas de API para o Fluxo (Flow Builder)
app.get('/api/flow', (req, res) => {
  const flow = readJSON(FLOW_FILE, { settings: {}, steps: [] });
  res.json(flow);
});

app.post('/api/flow', (req, res) => {
  const newFlow = req.body;
  if (!newFlow || !newFlow.steps) {
    return res.status(400).json({ error: 'Formato de fluxo inválido' });
  }

  const success = writeJSON(FLOW_FILE, newFlow);
  if (success) {
    res.json({ message: 'Fluxo salvo com sucesso!', flow: newFlow });
  } else {
    res.status(500).json({ error: 'Erro ao persistir o fluxo no disco.' });
  }
});

// Importador de exportação oficial do Typebot (.json)
app.post('/api/import-typebot', (req, res) => {
  try {
    const raw = req.body;
    if (!raw.groups || !raw.edges) {
      return res.status(400).json({ error: 'JSON não parece ser uma exportação oficial do Typebot.' });
    }

    const settings = {
      botName: raw.name || "Atendimento Oficial",
      botSubtitle: "Atendimento Automatizado",
      botAvatar: (raw.theme && raw.theme.chat && raw.theme.chat.hostAvatar && raw.theme.chat.hostAvatar.url) || "https://api.dicebear.com/7.x/bottts/svg?seed=VirtualBot",
      primaryColor: (raw.theme && raw.theme.chat && raw.theme.chat.buttons && raw.theme.chat.buttons.backgroundColor) || "#598E71",
      bubbleColor: "#F3F4F6",
      bubbleTextColor: "#1F2937",
      companyWhatsapp: "5511999999999",
      webhookUrl: ""
    };

    const steps = [];
    const edgeMap = {}; // from blockId/itemId -> to groupId/blockId
    raw.edges.forEach(e => {
      const fromKey = e.from.itemId || e.from.blockId || e.from.eventId;
      if (fromKey) edgeMap[fromKey] = e.to.groupId;
    });

    // Converter cada grupo e bloco
    raw.groups.forEach((group, gIdx) => {
      group.blocks.forEach((block, bIdx) => {
        const stepId = `step_${group.id}_${block.id}`;
        let nextStepId = null;

        // Próximo bloco dentro do mesmo grupo
        if (bIdx < group.blocks.length - 1) {
          nextStepId = `step_${group.id}_${group.blocks[bIdx + 1].id}`;
        } else if (edgeMap[block.id]) {
          const targetGroup = raw.groups.find(g => g.id === edgeMap[block.id]);
          if (targetGroup && targetGroup.blocks.length > 0) {
            nextStepId = `step_${targetGroup.id}_${targetGroup.blocks[0].id}`;
          }
        }

        if (block.type === 'text') {
          let text = '';
          if (block.content && block.content.richText) {
            text = block.content.richText.map(n => {
              if (n.children) {
                return n.children.map(c => {
                  let t = c.text || '';
                  if (c.bold) t = `**${t}**`;
                  if (c.url || n.url) t = `[${t || 'Clique aqui'}](${c.url || n.url})`;
                  return t;
                }).join('');
              }
              return '';
            }).join('\n\n').trim();
          }
          if (text) {
            steps.push({ id: stepId, type: 'message', content: text, delay: 1200, nextStepId });
          }
        } else if (block.type === 'audio') {
          const audioUrl = block.content ? block.content.url : '';
          steps.push({ id: stepId, type: 'audio', content: 'Mensagem de áudio', audioUrl, delay: 4500, nextStepId });
        } else if (block.type === 'image') {
          const imageUrl = block.content ? block.content.url : '';
          steps.push({ id: stepId, type: 'image', content: 'Imagem', imageUrl, delay: 2500, nextStepId });
        } else if (block.type === 'choice input' && block.items) {
          const options = block.items.map(item => {
            let itemNext = null;
            if (edgeMap[item.id]) {
              const targetG = raw.groups.find(g => g.id === edgeMap[item.id]);
              if (targetG && targetG.blocks.length > 0) {
                itemNext = `step_${targetG.id}_${targetG.blocks[0].id}`;
              }
            }
            return { id: item.id, label: item.content, nextStepId: itemNext || nextStepId };
          });
          steps.push({ id: stepId, type: 'buttons', content: 'Escolha uma opção:', options, nextStepId });
        }
      });
    });

    const converted = { settings, steps };
    writeJSON(FLOW_FILE, converted);
    res.json({ success: true, count: steps.length, flow: converted });
  } catch (err) {
    console.error('Erro na conversão Typebot:', err);
    res.status(500).json({ error: 'Erro ao processar arquivo Typebot: ' + err.message });
  }
});

// Rotas de API para Leads
app.get('/api/leads', (req, res) => {
  const leads = readJSON(LEADS_FILE, []);
  res.json(leads);
});

app.post('/api/leads', async (req, res) => {
  try {
    const { answers, sessionId, etapaAtual, clicouCadastro, clicouWhatsapp, chegouAoFim } = req.body;
    if (!answers && !etapaAtual) {
      return res.status(400).json({ error: 'Dados vazios' });
    }

    const leads = readJSON(LEADS_FILE, []);
    const sess = sessionId || ('sess_' + Date.now());
    let lead = leads.find(l => l.sessionId === sess);
    const now = new Date().toISOString();

    if (lead) {
      lead.updatedAt = now;
      lead.answers = { ...(lead.answers || {}), ...(answers || {}) };

      if (etapaAtual) lead.etapaAtual = etapaAtual;
      else if (lead.answers.etapa_atual) lead.etapaAtual = lead.answers.etapa_atual;

      if (clicouCadastro || lead.answers.clicou_cadastro) lead.clicouCadastro = true;
      if (clicouWhatsapp || lead.answers.clicou_whatsapp) lead.clicouWhatsapp = true;
      if (chegouAoFim || lead.answers.chegou_ao_fim) lead.chegouAoFim = true;

      if (lead.answers.nome || lead.answers.name) lead.name = lead.answers.nome || lead.answers.name;
      if (lead.answers.whatsapp || lead.answers.telefone) lead.whatsapp = lead.answers.whatsapp || lead.answers.telefone;
      if (lead.answers.email) lead.email = lead.answers.email;
    } else {
      const isAnon = !(answers && (answers.nome || answers.name));
      lead = {
        id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        sessionId: sess,
        createdAt: now,
        updatedAt: now,
        name: isAnon ? ('Visitante #' + sess.slice(-5)) : (answers.nome || answers.name),
        whatsapp: (answers && (answers.whatsapp || answers.telefone || answers.phone)) || '',
        email: (answers && answers.email) || '',
        etapaAtual: etapaAtual || (answers && answers.etapa_atual) || 'Iniciou Atendimento',
        clicouCadastro: !!(clicouCadastro || (answers && answers.clicou_cadastro)),
        clicouWhatsapp: !!(clicouWhatsapp || (answers && answers.clicou_whatsapp)),
        chegouAoFim: !!(chegouAoFim || (answers && answers.chegou_ao_fim)),
        answers: answers || {}
      };
      leads.unshift(lead);
    }

    writeJSON(LEADS_FILE, leads);

    // Disparo opcional de webhook (ex: n8n, zapier, evolution api)
    const flow = readJSON(FLOW_FILE, {});
    const webhookUrl = flow.settings && flow.settings.webhookUrl;
    if (webhookUrl && webhookUrl.startsWith('http')) {
      try {
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lead)
        }).catch(err => console.error('Erro no webhook disparado:', err.message));
      } catch (e) {
        console.error('Falha ao enviar webhook:', e.message);
      }
    }

    res.status(200).json({ success: true, lead });
  } catch (err) {
    console.error('Erro ao salvar lead:', err);
    res.status(500).json({ error: 'Erro interno ao salvar lead.' });
  }
});

app.delete('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  let leads = readJSON(LEADS_FILE, []);
  const initialLength = leads.length;
  leads = leads.filter(l => l.id !== id);

  if (leads.length === initialLength) {
    return res.status(404).json({ error: 'Lead não encontrado' });
  }

  writeJSON(LEADS_FILE, leads);
  res.json({ success: true, message: 'Lead excluído com sucesso' });
});

// Exportação CSV detalhada
app.get('/api/export/csv', (req, res) => {
  const leads = readJSON(LEADS_FILE, []);
  let csvContent = '\uFEFFData Início,Última Atividade,Visitante,WhatsApp,Email,Etapa Atual,Clicou Cadastrar?,Chamou WhatsApp?,Chegou ao Fim?,Respostas Detalhadas\n';

  leads.forEach(l => {
    const dataInicio = new Date(l.createdAt).toLocaleString('pt-BR');
    const dataUpdate = l.updatedAt ? new Date(l.updatedAt).toLocaleString('pt-BR') : dataInicio;
    const safeName = `"${(l.name || '').replace(/"/g, '""')}"`;
    const safeZap = `"${(l.whatsapp || '').replace(/"/g, '""')}"`;
    const safeEmail = `"${(l.email || '').replace(/"/g, '""')}"`;
    const safeEtapa = `"${(l.etapaAtual || '').replace(/"/g, '""')}"`;
    const safeCad = l.clicouCadastro ? '"SIM"' : '"Não"';
    const safeZapClick = l.clicouWhatsapp ? '"SIM"' : '"Não"';
    const safeFim = l.chegouAoFim ? '"SIM"' : '"Não"';
    const safeAnswers = `"${JSON.stringify(l.answers || {}).replace(/"/g, '""')}"`;
    csvContent += `${dataInicio},${dataUpdate},${safeName},${safeZap},${safeEmail},${safeEtapa},${safeCad},${safeZapClick},${safeFim},${safeAnswers}\n`;
  });

  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(`funil-atendimento-${Date.now()}.csv`);
  res.send(csvContent);
});

// Rota padrão do Viewer e Admin
const PUBLIC_DIR = path.join(__dirname, 'public');

app.get('/admin', (req, res) => {
  res.sendFile('admin.html', { root: PUBLIC_DIR });
});

// Middleware catch-all para servir a interface do bot (compatível com Express 4 e 5)
app.use((req, res) => {
  res.sendFile('index.html', { root: PUBLIC_DIR });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Typebot Custom Server Rodando com Sucesso!`);
  console.log(`📱 Atendimento (Chat): http://0.0.0.0:${PORT}`);
  console.log(`⚙️  Painel do Criador: http://0.0.0.0:${PORT}/admin`);
  console.log(`======================================================\n`);
});

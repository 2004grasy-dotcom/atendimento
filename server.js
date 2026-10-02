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
const COMPRADORES_FILE = path.join(DATA_DIR, 'compradores.json');

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

// Endpoint de IA para Dúvidas e Quebra de Objeções (Leticia AI)
app.post('/api/ai/ask', async (req, res) => {
  try {
    const { question, sessionId, answers } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Pergunta vazia' });
    }

    const flow = readJSON(FLOW_FILE, {});
    const apiKey = process.env.GEMINI_API_KEY || (flow.settings && flow.settings.geminiApiKey) || '';

    const userName = (answers && (answers.nome || answers.name)) || '';
    const userGoal = (answers && answers.objetivo) || '';

    const systemInstruction = `Você é a Letícia, consultora e atendente virtual oficial no WhatsApp da Plataforma de Fabricantes e Fornecedores de Roupas a Preço de Custo.
O cliente ${userName ? `se chama ${userName} e ` : ''}está conversando com você no final do atendimento. ${userGoal ? `O objetivo dele é: ${userGoal}.` : ''}

CONHECIMENTO COMPLETO:
- O QUE É A PLATAFORMA: Um sistema exclusivo com contatos, catálogos e acesso direto a distribuidores e fabricantes de confecção própria (Brás, Bom Retiro, Goiânia, Fortaleza, etc.) vendendo roupas femininas, vestidos, conjuntos, etc., a preço de custo real de fábrica.
- FRETE: A grande maioria dos fabricantes tem frete grátis ou frete facilitado com transportadoras parceiras e Correios super em conta para o Brasil inteiro.
- PEDIDO MÍNIMO:
  * Para revenda: A maioria é a partir de apenas R$ 100,00 ou 6 peças no atacado (muitos nem têm pedido mínimo!).
  * Para consumo próprio: Vários distribuidores vendem no varejo a preço de atacado sem exigência de quantidade mínima.
- PLANOS: Plano Essencial e Plano Pro.
- PAGAMENTO: Cartão de crédito ou Pix com liberação imediata.
- ACESSO: Login e senha chegam na hora por e-mail e o suporte chama no WhatsApp para dar as boas-vindas.
- LINK OFICIAL: https://plataforma-oficial.lovable.app/
- WHATSAPP: (67) 99614-6854

REGRAS OBRIGATÓRIAS DE COMUNICAÇÃO:
1. Responda SEMPRE em formato JSON com dois campos:
   - "messages": array de strings com 1 ou 2 mensagens curtas separadas (como duas mensagens consecutivas de WhatsApp, sem textões). NUNCA envie links crus ou URLs de texto nas mensagens, pois o sistema vai colocar o botão interativo oficial na tela quando necessário.
   - "wants_to_buy": boolean.
     * Retorne true SE E SOMENTE SE o cliente disser que quer comprar, quer o link, quer assinar, quer garantir o acesso, disser 'sim' para a oferta de compra.
     * Retorne false se o cliente estiver fazendo perguntas, tirando dúvidas, conversando ou disser 'não'.
2. Quando o cliente tirar uma dúvida (wants_to_buy = false):
   - Na primeira mensagem: responda com simpatia e clareza como a Letícia, quebrando a objeção.
   - Na segunda mensagem: pergunte com carinho: "Deu para entender certinho${userName ? `, ${userName}` : ''}? Quer que eu te passe o link para garantir seu plano agora, ou você tem mais alguma dúvida?"
3. Quando o cliente disser que quer comprar ou que quer o link (wants_to_buy = true):
   - Comemore e diga que você está liberando o botão oficial de cadastro na tela agora mesmo para ele escolher o plano!`;

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=' + apiKey;
    const aiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: question.trim() }]
          }
        ],
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    const aiData = await aiRes.json();
    let messages = [];
    let wantsToBuy = false;

    if (aiData.candidates && aiData.candidates[0] && aiData.candidates[0].content && aiData.candidates[0].content.parts) {
      try {
        const rawJson = aiData.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed.messages)) {
          messages = parsed.messages;
        } else if (typeof parsed.messages === 'string') {
          messages = [parsed.messages];
        }
        wantsToBuy = !!parsed.wants_to_buy;
      } catch (e) {
        messages = [aiData.candidates[0].content.parts[0].text];
      }
    }

    if (messages.length === 0) {
      messages = ['Estou à disposição para te ajudar! Caso queira escolher o seu plano, você pode clicar no botão de cadastro na tela ou me mandar mais dúvidas aqui no chat! ✨'];
    }

    // Salva a dúvida no histórico do lead
    if (sessionId) {
      const leads = readJSON(LEADS_FILE, []);
      const lead = leads.find(l => l.sessionId === sessionId);
      if (lead) {
        if (!lead.answers) lead.answers = {};
        const qCount = Object.keys(lead.answers).filter(k => k.startsWith('duvida_ia_')).length + 1;
        lead.answers[`duvida_ia_${qCount}`] = question.trim();
        if (wantsToBuy) {
          lead.answers['solicitou_link_compra'] = true;
          lead.etapaAtual = '🔥 Pediu link de compra na IA';
        } else {
          lead.etapaAtual = `Tirou dúvida com IA: "${question.trim().substring(0, 30)}..."`;
        }
        lead.updatedAt = new Date().toISOString();
        writeJSON(LEADS_FILE, leads);
      }
    }

    res.json({ success: true, messages, wants_to_buy: wantsToBuy });
  } catch (err) {
    console.error('Erro na rota /api/ai/ask:', err);
    res.status(500).json({ error: 'Erro ao processar resposta da IA: ' + err.message });
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

// ==========================================
// INTEGRAÇÃO CACTUS / CAKTO WEBHOOKS
// ==========================================
app.post('/api/webhooks/cactus', (req, res) => {
  try {
    const payload = req.body || {};
    console.log('📦 Webhook recebido da Cactus/Cakto: Evento =', payload.event);

    const compradores = readJSON(COMPRADORES_FILE, []);
    let novosCompradores = 0;

    // A Cakto envia req.body.data como array de itens ou como objeto único
    const items = Array.isArray(payload.data) ? payload.data : (payload.data ? [payload.data] : [payload]);

    items.forEach(item => {
      const customer = item.customer || {};
      const product = item.product || {};
      const email = (customer.email || item.email || '').trim().toLowerCase();
      const name = (customer.name || item.name || 'Cliente').trim();
      const phone = (customer.phone || item.phone || '').trim();
      const productName = (product.name || item.product_name || 'Plataforma de Fornecedores').trim();
      const status = (item.status || payload.event || 'paid').toLowerCase();

      // Somente registra se for pago / aprovado
      const isApproved = status.includes('paid') || status.includes('aprov') || payload.event === 'purchase_approved';

      if (email && isApproved) {
        const existingIdx = compradores.findIndex(c => c.email.toLowerCase() === email);
        const buyerData = {
          id: item.id || 'compra_' + Date.now().toString(36),
          name: name,
          email: email,
          phone: phone,
          product: productName,
          status: 'paid',
          amount: item.amount || 0,
          paidAt: item.paidAt || new Date().toISOString(),
          createdAt: existingIdx >= 0 ? compradores[existingIdx].createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (existingIdx >= 0) {
          compradores[existingIdx] = buyerData;
        } else {
          compradores.unshift(buyerData);
        }
        novosCompradores++;
      }
    });

    writeJSON(COMPRADORES_FILE, compradores);
    res.status(200).json({ success: true, message: `${novosCompradores} comprador(es) registrado(s) com sucesso.` });
  } catch (err) {
    console.error('Erro ao processar webhook Cactus:', err);
    res.status(500).json({ error: 'Erro ao processar webhook: ' + err.message });
  }
});

// ==========================================
// CHAT DE SUPORTE E ENTREGA PÓS-COMPRA
// ==========================================
app.post('/api/suporte/verificar', (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'E-mail não informado' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const compradores = readJSON(COMPRADORES_FILE, []);
    const comprador = compradores.find(c => c.email && c.email.toLowerCase() === cleanEmail);

    if (comprador) {
      return res.json({
        success: true,
        encontrado: true,
        comprador: {
          name: comprador.name,
          email: comprador.email,
          product: comprador.product,
          paidAt: comprador.paidAt
        },
        linkEntrega: "https://plataforma-das-fabricas.lovable.app/"
      });
    } else {
      return res.json({
        success: true,
        encontrado: false,
        message: 'Nenhuma compra aprovada encontrada para este e-mail.'
      });
    }
  } catch (err) {
    console.error('Erro ao verificar suporte:', err);
    res.status(500).json({ error: 'Erro interno ao verificar cadastro' });
  }
});

// Endpoint de IA especializada em Suporte e Pós-Venda (Leticia Suporte)
app.post('/api/suporte/ai/ask', async (req, res) => {
  try {
    const { question, email, name } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Pergunta vazia' });
    }

    const flow = readJSON(FLOW_FILE, {});
    const apiKey = process.env.GEMINI_API_KEY || (flow.settings && flow.settings.geminiApiKey) || '';

    const systemInstruction = `Você é a Letícia, consultora e atendente de suporte oficial da Plataforma de Fabricantes e Fornecedores de Roupas a Preço de Custo.
O cliente ${name ? `se chama ${name} e ` : ''}já é um comprador oficial com compra confirmada no sistema (Pós-Venda / Suporte).

INFORMAÇÕES CRUCIAIS:
- LINK DE ACESSO OFICIAL À PLATAFORMA E GRUPO VIP: https://plataforma-das-fabricas.lovable.app/
(Nesse link ele já encontra o botão para entrar no Grupo VIP e a área de acesso à plataforma de fornecedores).
- COMO ENCONTRAR OS FORNECEDORES DENTRO DA PLATAFORMA (SUPER IMPORTANTE EXPLICAR QUANDO ELE PERGUNTAR):
  1️⃣ Opção de Busca: campo de pesquisa inteligente onde ele digita o tipo de roupa que procura (ex: vestidos, conjuntos, moda íntima, jeans, fitness, infantil, etc.).
  2️⃣ Central de Fornecedores: área com todos os contatos diretos, WhatsApp dos fabricantes e catálogos organizados por polos industriais de confecção (Brás, Bom Retiro, Goiânia, Fortaleza, etc.).
- FRETE: A grande maioria dos fornecedores tem frete facilitado com transportadoras parceiras e Correios super em conta para o Brasil inteiro, e muitos com frete grátis dependendo do valor do pedido.
- PEDIDO MÍNIMO: Vários distribuidores vendem no atacado a partir de poucas peças (ex: 6 peças ou R$ 100) e muitos também atendem no varejo sem pedido mínimo a preço de fábrica.
- DÚVIDAS DE LOGIN / SENHA: O link oficial direto de acesso é https://plataforma-das-fabricas.lovable.app/. Se precisar de suporte adicional, nossa equipe também dá total assistência.

REGRAS:
- Responda SEMPRE em formato JSON com o campo "messages":
  { "messages": ["mensagem 1", "mensagem 2 (se necessário)"] }
- Mensagens curtas, humanas, simpáticas e acolhedoras estilo WhatsApp (sem textões).
- Chame a pessoa pelo nome ${name ? `(${name})` : ''} com carinho quando fizer sentido.`;

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=' + apiKey;
    const aiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: question.trim() }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    const aiData = await aiRes.json();
    let messages = [];

    if (aiData.candidates && aiData.candidates[0] && aiData.candidates[0].content && aiData.candidates[0].content.parts) {
      try {
        const rawJson = aiData.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed.messages)) {
          messages = parsed.messages;
        } else if (typeof parsed.messages === 'string') {
          messages = [parsed.messages];
        }
      } catch (e) {
        messages = [aiData.candidates[0].content.parts[0].text];
      }
    }

    if (messages.length === 0) {
      messages = ['Estou à disposição para te ajudar no que precisar! Caso queira acessar agora a plataforma e o Grupo VIP, basta clicar no link oficial: https://plataforma-das-fabricas.lovable.app/ ✨'];
    }

    res.json({ success: true, messages });
  } catch (err) {
    console.error('Erro na rota de IA de suporte:', err);
    res.status(500).json({ error: 'Erro ao processar suporte: ' + err.message });
  }
});

// Endpoints de Gestão de Compradores (Admin)
app.get('/api/compradores', (req, res) => {
  const compradores = readJSON(COMPRADORES_FILE, []);
  res.json(compradores);
});

app.post('/api/compradores', (req, res) => {
  try {
    const { name, email, phone, product } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'E-mail é obrigatório' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const compradores = readJSON(COMPRADORES_FILE, []);
    const existingIdx = compradores.findIndex(c => c.email.toLowerCase() === cleanEmail);

    const buyerData = {
      id: 'manual_' + Date.now().toString(36),
      name: (name || 'Cliente').trim(),
      email: cleanEmail,
      phone: (phone || '').trim(),
      product: (product || 'Plataforma + Grupo VIP').trim(),
      status: 'paid',
      amount: 0,
      paidAt: new Date().toISOString(),
      createdAt: existingIdx >= 0 ? compradores[existingIdx].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      compradores[existingIdx] = buyerData;
    } else {
      compradores.unshift(buyerData);
    }

    writeJSON(COMPRADORES_FILE, compradores);
    res.json({ success: true, comprador: buyerData });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar comprador: ' + err.message });
  }
});

// Importação em Massa de Compradores via CSV
app.post('/api/compradores/import-csv', (req, res) => {
  try {
    const { csvText } = req.body;
    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ error: 'Conteúdo CSV não enviado.' });
    }

    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return res.status(400).json({ error: 'O CSV precisa ter pelo menos o cabeçalho e uma linha.' });
    }

    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : ',';

    const parseRow = (line) => {
      const regex = new RegExp(`(?:^|${delimiter})(?:"([^"]*(?:""[^"]*)*)"|([^"${delimiter}]*))`, 'g');
      const cells = [];
      let match;
      while ((match = regex.exec(line)) !== null) {
        let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
        cells.push((val || '').trim());
      }
      return cells;
    };

    const headers = parseRow(headerLine).map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''));

    const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));
    const nameIdx = headers.findIndex(h => h.includes('nome') || h.includes('name') || h.includes('cliente'));
    const phoneIdx = headers.findIndex(h => h.includes('tel') || h.includes('cel') || h.includes('phone') || h.includes('fone'));
    const productIdx = headers.findIndex(h => h.includes('prod') || h.includes('plano') || h.includes('item') || h.includes('oferta'));
    const statusIdx = headers.findIndex(h => h.includes('status') || h.includes('situacao') || h.includes('estado'));

    if (emailIdx === -1) {
      return res.status(400).json({ error: 'Não foi possível encontrar a coluna de E-mail no cabeçalho do CSV.' });
    }

    const compradores = readJSON(COMPRADORES_FILE, []);
    let count = 0;

    for (let i = 1; i < lines.length; i++) {
      const cells = parseRow(lines[i]);
      const email = (cells[emailIdx] || '').trim().toLowerCase();

      if (!email || !email.includes('@')) continue;

      if (statusIdx !== -1) {
        const st = (cells[statusIdx] || '').toLowerCase();
        if (st.includes('cancel') || st.includes('recus') || st.includes('estorn') || st.includes('refund')) {
          continue;
        }
      }

      const name = nameIdx !== -1 && cells[nameIdx] ? cells[nameIdx] : 'Cliente';
      const phone = phoneIdx !== -1 && cells[phoneIdx] ? cells[phoneIdx] : '';
      const product = productIdx !== -1 && cells[productIdx] ? cells[productIdx] : 'Plataforma + Grupo VIP';

      const existingIdx = compradores.findIndex(c => c.email.toLowerCase() === email);
      const buyerData = {
        id: 'csv_' + Date.now().toString(36) + '_' + i,
        name: name,
        email: email,
        phone: phone,
        product: product,
        status: 'paid',
        amount: 0,
        paidAt: new Date().toISOString(),
        createdAt: existingIdx >= 0 ? compradores[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        compradores[existingIdx] = buyerData;
      } else {
        compradores.unshift(buyerData);
      }
      count++;
    }

    writeJSON(COMPRADORES_FILE, compradores);
    res.json({ success: true, count, total: compradores.length });
  } catch (err) {
    console.error('Erro ao importar CSV:', err);
    res.status(500).json({ error: 'Erro ao processar CSV: ' + err.message });
  }
});

app.delete('/api/compradores/:email', (req, res) => {
  const emailToDelete = decodeURIComponent(req.params.email).toLowerCase();
  let compradores = readJSON(COMPRADORES_FILE, []);
  compradores = compradores.filter(c => c.email.toLowerCase() !== emailToDelete);
  writeJSON(COMPRADORES_FILE, compradores);
  res.json({ success: true, message: 'Comprador removido' });
});

// Rota padrão do Viewer e Admin
const PUBLIC_DIR = path.join(__dirname, 'public');

app.get('/admin', (req, res) => {
  res.sendFile('admin.html', { root: PUBLIC_DIR });
});

app.get(['/suporte', '/acesso'], (req, res) => {
  res.sendFile('suporte.html', { root: PUBLIC_DIR });
});

// Middleware catch-all para servir a interface do bot de vendas (compatível com Express 4 e 5)
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

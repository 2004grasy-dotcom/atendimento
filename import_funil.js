const fs = require('fs');
const path = require('path');

const typebotFilePath = 'C:\\Users\\Usuario\\Downloads\\FUNIL\\typebot-export-cliq-pra-seratendida (6).json';
const rawData = JSON.parse(fs.readFileSync(typebotFilePath, 'utf-8'));

function extractRichText(richText) {
  if (!richText || !Array.isArray(richText)) return '';
  return richText.map(node => {
    if (node.children) {
      return node.children.map(child => {
        let text = child.text || '';
        if (child.bold) text = `**${text}**`;
        if (child.type === 'a' || node.type === 'a' || child.url) {
          const url = child.url || node.url;
          text = `[${text || 'Clique aqui'}](${url})`;
        }
        return text;
      }).join('');
    }
    return '';
  }).join('\n\n').trim();
}

console.log('Grupos encontrados:', rawData.groups.length);
console.log('Edges encontrados:', rawData.edges.length);

// Mapear blocks e groups
const steps = [];

// Settings do tema
const settings = {
  botName: "Atendimento Oficial",
  botSubtitle: "Plataforma de Fabricantes & Fornecedores",
  botAvatar: (rawData.theme && rawData.theme.chat && rawData.theme.chat.hostAvatar && rawData.theme.chat.hostAvatar.url) || "https://api.dicebear.com/7.x/bottts/svg?seed=VirtualBot",
  primaryColor: (rawData.theme && rawData.theme.chat && rawData.theme.chat.buttons && rawData.theme.chat.buttons.backgroundColor) || "#598E71",
  bubbleColor: "#F3F4F6",
  bubbleTextColor: "#1F2937",
  companyWhatsapp: "5511999999999",
  webhookUrl: ""
};

// Seguir a ordem de execução com base no fluxo:
// 1. Group #1 (e91291ndv5x1razbpxr84d9f): "Oie tudo bem? você quer comprar a preço de custo?👇 " + Botão "SIM QUERO"
steps.push({
  id: "step_boas_vindas",
  type: "message",
  content: "Oie tudo bem? você quer comprar a preço de custo? 👇",
  delay: 800,
  nextStepId: "step_opt_preco_custo"
});

steps.push({
  id: "step_opt_preco_custo",
  type: "buttons",
  content: "Escolha uma opção para continuar:",
  variable: "quer_preco_custo",
  options: [
    { id: "opt_sim", label: "✅ SIM QUERO", nextStepId: "step_objetivo" }
  ]
});

// 2. Group #18 (yx9p6c3w8u7bqsz0ouhromrs): "Qual seu objetivo? com os Fabricantes e fornecedores"
steps.push({
  id: "step_objetivo",
  type: "message",
  content: "Qual seu objetivo com os **Fabricantes e fornecedores**?",
  delay: 800,
  nextStepId: "step_opt_objetivo"
});

// 3. Group #3 (nvat4acbgdx9z4h35tngtbol): "REVENDER" ou "USO PESSOAL"
steps.push({
  id: "step_opt_objetivo",
  type: "buttons",
  content: "Selecione o seu objetivo principal:",
  variable: "objetivo",
  options: [
    { id: "opt_revender", label: "🛍️ REVENDER", nextStepId: "step_perfeito" },
    { id: "opt_pessoal", label: "👗 USO PESSOAL", nextStepId: "step_perfeito" }
  ]
});

// 4. Group #4: "Perfeito!!" + Audio 1
steps.push({
  id: "step_perfeito",
  type: "message",
  content: "Perfeito!! ✨",
  delay: 1000,
  nextStepId: "step_audio_1"
});

steps.push({
  id: "step_audio_1",
  type: "audio",
  content: "Mensagem de voz sobre a plataforma",
  audioUrl: "https://s3.typebotstorage.com/public/workspaces/cm5lrx2mv0003dr9z90qztvzu/typebots/itpv7wbdipjbm3bxd7ervs8s/blocks/iwyf2lx288s2hfvkekcalyod?v=1790682096260",
  delay: 4500,
  nextStepId: "step_info_plataforma"
});

// 5. Group #5: "O pedido das peças são pela nossa Plataforma..."
steps.push({
  id: "step_info_plataforma",
  type: "message",
  content: "**O pedido das peças são pela nossa Plataforma...**\n\nAo se cadastrar, você ganha acesso exclusivo a distribuidores e fabricantes selecionados para revendedores e consumidores individuais:\n\n**Para Revendedores:** Pedido mínimo no atacado R$ 100,00 (ou 6 peças). O pedido mínimo varia de distribuidor para distribuidor, alguns sem pedido mínimo.",
  delay: 3500,
  nextStepId: "step_info_consumo"
});

// 6. Group #17 (wsxrnjd0wke0f6z1qq9cgcoa): "Para consumo próprio..."
steps.push({
  id: "step_info_consumo",
  type: "message",
  content: "**Para consumo próprio:**\nAlguns distribuidores vendem no varejo e também no atacado sem pedido mínimo, assim podendo comprar peças com preço baixo direto do distribuidor e fabricante.\n\n**Cadastro da plataforma:**\nA plataforma foi criada para facilitar seu acesso a fornecedores reais e produtos com preços reduzidos, tudo em um só lugar. Você pode pesquisar fornecedores, analisar produtos e tomar decisões mais inteligentes para compra ou revenda.",
  delay: 4000,
  nextStepId: "step_plano_essencial_txt"
});

// 7. Group #17 (h3rhsfncqfgc2qdwr6n426gj): Plano Essencial
steps.push({
  id: "step_plano_essencial_txt",
  type: "message",
  content: "🚀 **Planos de acesso**\n\n🔵 **Plano Essencial** 👇",
  delay: 1000,
  nextStepId: "step_plano_essencial_img"
});

steps.push({
  id: "step_plano_essencial_img",
  type: "image",
  content: "Imagem do Plano Essencial",
  imageUrl: "https://s3.typebotstorage.com/public/workspaces/cm5lrx2mv0003dr9z90qztvzu/typebots/itpv7wbdipjbm3bxd7ervs8s/blocks/z4maw91ej9531hb2zxls0c3v?v=1781701027456",
  delay: 2000,
  nextStepId: "step_plano_pro_txt"
});

// 8. Group #17 (st6pebd780xn1ipldya36dl9): Plano Pro
steps.push({
  id: "step_plano_pro_txt",
  type: "message",
  content: "🟡 **Plano Pro** 👇",
  delay: 1000,
  nextStepId: "step_plano_pro_img"
});

steps.push({
  id: "step_plano_pro_img",
  type: "image",
  content: "Imagem do Plano Pro",
  imageUrl: "https://s3.typebotstorage.com/public/workspaces/cm5lrx2mv0003dr9z90qztvzu/typebots/itpv7wbdipjbm3bxd7ervs8s/blocks/n5eg38zfzk1lq6n9pgfqkbw0?v=1781955443060",
  delay: 3000,
  nextStepId: "step_audio_2"
});

// 9. Group #13: Audio 2
steps.push({
  id: "step_audio_2",
  type: "audio",
  content: "Áudio explicativo dos planos",
  audioUrl: "https://s3.typebotstorage.com/public/workspaces/cm5lrx2mv0003dr9z90qztvzu/typebots/itpv7wbdipjbm3bxd7ervs8s/blocks/ykprcskf6o353scmw7kxhe69?v=1790682119782",
  delay: 5000,
  nextStepId: "step_categorias_txt"
});

// 10. Group #7: Categorias
steps.push({
  id: "step_categorias_txt",
  type: "message",
  content: "Categorias que tem na plataforma 👇",
  delay: 1000,
  nextStepId: "step_categorias_img"
});

steps.push({
  id: "step_categorias_img",
  type: "image",
  content: "Categorias disponíveis",
  imageUrl: "https://s3.typebotstorage.com/public/workspaces/cm5lrx2mv0003dr9z90qztvzu/typebots/itpv7wbdipjbm3bxd7ervs8s/blocks/lltqbb45gkw9opfkftkzfywl?v=1781701273114",
  delay: 2500,
  nextStepId: "step_perg_cadastro"
});

// 11. Group #6: Pergunta de cadastro
steps.push({
  id: "step_perg_cadastro",
  type: "buttons",
  content: "**Quer garantir seu cadastro à Plataforma agora e começar a aproveitar todos os benefícios?**",
  variable: "garantir_cadastro",
  options: [
    { id: "opt_quero_sim", label: "🚀 Quero sim!", nextStepId: "step_aviso_pagamento" }
  ]
});

// 12. Group #8: Aviso link pagamento
steps.push({
  id: "step_aviso_pagamento",
  type: "message",
  content: "**Certo, vou te enviar o link de pagamento, ok?**\n\nLembrando que o link é para você acessar e preencher seu cadastro!",
  delay: 1500,
  nextStepId: "step_link_planos"
});

// 13. Group #18: Link dos planos
steps.push({
  id: "step_link_planos",
  type: "buttons",
  content: "**Link oficial dos planos:** 👇\n\nClique no botão abaixo para escolher o seu plano:",
  options: [
    {
      id: "opt_link_oficial",
      label: "💳 Acessar Planos e Fazer Cadastro",
      url: "https://plataforma-oficial.lovable.app/planos",
      nextStepId: "step_final_instrucoes"
    }
  ]
});

// 14. Group #9: Instruções finais e contato
steps.push({
  id: "step_final_instrucoes",
  type: "message",
  content: "Assim que preencher seu cadastro e efetuar o pagamento, me avise no WhatsApp! Que vou te passar o acesso, combinado?\n\nO acesso também é enviado por e-mail no ato da compra e o suporte vai te chamar no WhatsApp!",
  delay: 1500,
  nextStepId: "step_cta_whatsapp"
});

steps.push({
  id: "step_cta_whatsapp",
  type: "redirect_whatsapp",
  content: "Se tiver qualquer dúvida ou assim que finalizar seu pagamento, clique abaixo:",
  buttonText: "Falar com Suporte no WhatsApp 💬",
  customMessage: "Olá! Fiz meu cadastro na plataforma e gostaria de confirmar meu acesso."
});

const convertedFlow = { settings, steps };

fs.writeFileSync(
  path.join(__dirname, 'data', 'flow.json'),
  JSON.stringify(convertedFlow, null, 2),
  'utf-8'
);

console.log('Conversão realizada com sucesso! Total de etapas:', steps.length);

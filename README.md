# 🤖 Typebot Custom - Sistema Completo de Atendimento Virtual

Seu próprio aplicativo de atendimento interativo inspirado no **Typebot**, 100% autônomo, sem limites de mensagens e pronto para coletar leads, qualificar clientes e encaminhar para o WhatsApp!

---

## 🚀 Como Acessar Agora

O servidor já está configurado e rodando:

* 📱 **Interface de Atendimento (Chat do Cliente):** [http://localhost:3000](http://localhost:3000)
* ⚙️ **Painel do Criador (Flow Builder & Leads):** [http://localhost:3000/admin](http://localhost:3000/admin)

---

## ✨ Recursos Inclusos

1. **Interface Conversacional Estilo Typebot:**
   - Balões com animação fluida de digitação (`...`) e sons de mensagem.
   - Suporte a variáveis dinâmicas (ex: `Olá, {{nome}}!`).
   - Formatação em negrito com `**palavra**`.
   - Máscara automática de telefone celular `(11) 99999-9999`.
   - Validação de endereço de e-mail.
   - Botões interativos com desvios condicionais (ramificações).
   - Avaliação por estrelas (1 a 5 ⭐).
   - Botão final direto para WhatsApp com mensagem personalizada pré-preenchida.

2. **Painel do Criador Visual (/admin):**
   - **Fluxo Visual:** Adicione, edite, reorganize (subir/descer) e exclua qualquer etapa de mensagem ou pergunta.
   - **Simulador ao Vivo:** Veja no canto da tela como seu bot está funcionando em tempo real dentro de uma moldura de celular.
   - **Leads & Contatos:** Tabela completa com data, nome, WhatsApp, e-mail e respostas detalhadas.
   - **Chamar no WhatsApp:** Inicie a conversa com o lead no WhatsApp com 1 clique.
   - **Exportar CSV:** Baixe toda a planilha de leads compatível com Excel.
   - **Personalização de Cores e Avatar:** Altere cor principal, nome do atendente, foto de perfil e WhatsApp da empresa.
   - **Suporte a Webhooks:** Dispara um JSON automático para n8n, Zapier ou APIs de WhatsApp ao finalizar o fluxo.

3. **Como Incorporar no seu Site / Landing Page:**
   - **Widget Flutuante (Bolinha de Chat):**
     ```html
     <script src="http://localhost:3000/embed.js"></script>
     ```
   - **Iframe no Meio da Página:**
     ```html
     <iframe src="http://localhost:3000" style="width: 100%; height: 600px; border: none; border-radius: 16px;"></iframe>
     ```

---

## 💻 Como Iniciar o Projeto Manualmente

Caso reinicie o computador ou queira iniciar em outro momento:

```powershell
cd "C:\Users\Usuario\.gemini\antigravity\scratch\my-typebot-app"
npm start
```

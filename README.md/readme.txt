Projeto Fidelidade 

Sistema de fidelidade universitária com leitura automática de certificados por Inteligência Artificial.

---

📌 Sobre o projeto

O Projeto Fidelidade é uma aplicação web desenvolvida em Python com Flask que permite que alunos acumulem pontos enviando certificados de atividades complementares.

A IA lê o PDF do certificado automaticamente, extrai as informações e converte as horas em pontos — sem nenhuma intervenção manual.

Com os pontos acumulados, o aluno pode resgatar produtos e benefícios na plataforma.

---

⚙️ Funcionalidades

- Cadastro e login de alunos
- IA lê certificado PDF automaticamente
- Extração de nome, instituição, evento, data e carga horária
- Conversão automática de horas em pontos (1h = 5 pontos)
- Histórico de certificados enviados
- Catálogo de produtos
- Resgate de produtos
- Painel administrativo
- API REST

---

💻 Tecnologias utilizadas

- Python 3
- Flask
- SQLAlchemy
- SQLite
- HTML, CSS, JavaScript
- Google Gemini AI
- PDF.js

---

🚀 Como rodar o projeto

1. Clone o repositório

git clone https://github.com/SEU_USUARIO/ProjetoFidelidade.git
cd ProjetoFidelidade/projeto-fidelidade

2. Instale as dependências

pip install -r requirements.txt
pip install google-generativeai

3. Configure a API

Substitua sua chave no arquivo:

src/routes/certificates.py

4. Rode o projeto

python src/main.py

5. Acesse no navegador

http://127.0.0.1:5000

---

🧠 Como funciona a IA

1. Usuário envia certificado em PDF
2. IA lê automaticamente
3. Extrai informações
4. Converte horas em pontos
5. Adiciona na conta

---

📊 Regra de pontos

- 1 hora = 5 pontos
- 5 horas = 25 pontos
- 10 horas = 50 pontos
- 20 horas = 100 pontos

---

📁 Estrutura do projeto

projeto-fidelidade/
├── src/
│   ├── main.py
│   ├── models/
│   ├── routes/
│   └── static/
└── requirements.txt

---

👩‍💻 Desenvolvido por

Isabela Vieira da Silva Santos
Estudante de ADS — ENIAC
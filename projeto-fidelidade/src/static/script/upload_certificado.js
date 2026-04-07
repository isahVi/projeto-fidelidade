// Carrega o pdf.js para leitura do PDF no navegador
const pdfScript = document.createElement('script');
pdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
document.head.appendChild(pdfScript);
pdfScript.onload = () => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
};

document.addEventListener('DOMContentLoaded', function () {

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async function () {
            try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (e) {}
            window.location.href = 'login.html';
        };
    }

    // Verifica autenticação
    const publicPages = ['/login.html', '/cadastro.html', '/redefinir_senha.html'];
    if (!publicPages.includes(window.location.pathname)) {
        checkAuthStatus();
    }

    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/me', { credentials: 'include' });
            if (!response.ok) {
                window.location.href = 'login.html';
            } else {
                const userData = await response.json();
                const userNameSpan = document.querySelector('.user-name');
                if (userNameSpan) userNameSpan.textContent = userData.username || 'Usuário';
                const userPointsSpan = document.querySelector('.user-points');
                if (userPointsSpan) userPointsSpan.textContent = `Pontos: ${userData.points ?? 0}`;
            }
        } catch (error) {
            window.location.href = 'login.html';
        }
    }

    const certificateFile = document.getElementById('certificateFile');
    const fileNameSpan = document.getElementById('fileName');
    const uploadForm = document.getElementById('uploadForm');
    const uploadMessage = document.getElementById('uploadMessage');

    // Garante que o elemento de resultado existe
    let resultadoIA = document.getElementById('resultadoIA');
    if (!resultadoIA) {
        resultadoIA = document.createElement('div');
        resultadoIA.id = 'resultadoIA';
        resultadoIA.style.cssText = 'margin-top:24px;display:none;';
        uploadForm.parentNode.insertBefore(resultadoIA, uploadForm.nextSibling);
    }

    function validatePDF(file) {
        if (!['application/pdf'].includes(file.type)) return { valid: false, message: 'Apenas arquivos PDF são aceitos.' };
        if (file.size > 10 * 1024 * 1024) return { valid: false, message: 'O arquivo deve ter no máximo 10MB.' };
        return { valid: true };
    }

    function formatFileSize(bytes) {
        const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    certificateFile.addEventListener('change', function () {
        uploadMessage.textContent = '';
        uploadMessage.className = 'upload-message';
        resultadoIA.style.display = 'none';
        if (this.files.length > 0) {
            const file = this.files[0];
            const validation = validatePDF(file);
            if (validation.valid) {
                fileNameSpan.textContent = file.name + ' (' + formatFileSize(file.size) + ')';
                fileNameSpan.classList.add('has-file');
            } else {
                fileNameSpan.textContent = 'Nenhum arquivo selecionado';
                fileNameSpan.classList.remove('has-file');
                uploadMessage.textContent = validation.message;
                uploadMessage.className = 'upload-message error';
                this.value = '';
            }
        } else {
            fileNameSpan.textContent = 'Nenhum arquivo selecionado';
            fileNameSpan.classList.remove('has-file');
        }
    });

    // Lê o texto do PDF usando pdf.js
    async function lerPDF(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const pdf = await pdfjsLib.getDocument(new Uint8Array(e.target.result)).promise;
                    let texto = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        texto += content.items.map(item => item.str).join(' ') + '\n';
                    }
                    resolve(texto.trim());
                } catch { resolve(''); }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // Submit — envia para o backend que usa a IA
    uploadForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        if (!certificateFile.files.length) {
            uploadMessage.textContent = 'Por favor, selecione um arquivo PDF.';
            uploadMessage.className = 'upload-message error';
            return;
        }

        const file = certificateFile.files[0];
        const validation = validatePDF(file);
        if (!validation.valid) {
            uploadMessage.textContent = validation.message;
            uploadMessage.className = 'upload-message error';
            return;
        }

        uploadMessage.textContent = '⏳ Lendo o certificado com IA...';
        uploadMessage.className = 'upload-message';
        resultadoIA.style.display = 'none';
        document.querySelector('.btn.btn-primary').disabled = true;

        // Lê o texto do PDF no navegador
        const textoPDF = await lerPDF(file);

        // Envia o texto para o backend
        const formData = new FormData();
        formData.append('texto_pdf', textoPDF);
        formData.append('nome_arquivo', file.name);

        try {
            const response = await fetch('/api/certificates/upload', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const data = await response.json();
            document.querySelector('.btn.btn-primary').disabled = false;

            if (!response.ok) {
                uploadMessage.textContent = '❌ Erro: ' + (data.error || 'Falha no envio.');
                uploadMessage.className = 'upload-message error';
                return;
            }

            uploadMessage.textContent = '';
            const d = data.dados_extraidos;

            // Mostra resultado da IA
            resultadoIA.style.display = 'block';
            resultadoIA.innerHTML = `
                <div style="background:#f0f9f4;border:1.5px solid #1D9E75;border-radius:12px;padding:20px;">
                    <h3 style="color:#0F6E56;margin-bottom:14px;">✅ Certificado aprovado pela IA!</h3>
                    <table style="width:100%;font-size:14px;border-collapse:collapse;">
                        <tr><td style="color:#555;padding:5px 0;width:40%">Aluno</td><td style="font-weight:600">${d.nome_aluno || '-'}</td></tr>
                        <tr><td style="color:#555;padding:5px 0">Instituição</td><td style="font-weight:600">${d.instituicao || '-'}</td></tr>
                        <tr><td style="color:#555;padding:5px 0">Evento</td><td style="font-weight:600">${d.evento || '-'}</td></tr>
                        <tr><td style="color:#555;padding:5px 0">Data</td><td style="font-weight:600">${d.data || '-'}</td></tr>
                        <tr><td style="color:#555;padding:5px 0">Carga horária</td><td style="font-weight:600">${d.carga_horaria || 0} horas</td></tr>
                    </table>
                    <div style="margin-top:16px;text-align:center;background:#1D9E75;color:white;border-radius:8px;padding:12px;">
                        <div style="font-size:13px;opacity:0.85">Pontos adicionados</div>
                        <div style="font-size:36px;font-weight:700">+${data.pontos_adicionados}</div>
                        <div style="font-size:13px;opacity:0.85">Total: ${data.total_pontos} pontos</div>
                    </div>
                    <p style="font-size:12px;color:#555;margin-top:10px;text-align:center">${d.observacao || ''}</p>
                    <div style="text-align:center;margin-top:14px">
                        <a href="produtos.html" style="background:#185FA5;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px">Ver produtos disponíveis →</a>
                    </div>
                </div>
            `;

            // Atualiza pontos na sidebar
            const userPointsSpan = document.querySelector('.user-points');
            if (userPointsSpan) userPointsSpan.textContent = `Pontos: ${data.total_pontos}`;

            // Limpa o formulário
            uploadForm.reset();
            fileNameSpan.textContent = 'Nenhum arquivo selecionado';
            fileNameSpan.classList.remove('has-file');

        } catch (err) {
            document.querySelector('.btn.btn-primary').disabled = false;
            uploadMessage.textContent = '❌ Erro ao conectar com o servidor.';
            uploadMessage.className = 'upload-message error';
        }
    });

    // Drag and drop
    const uploadSection = document.querySelector('.upload-section');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => uploadSection.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }, false));
    ['dragenter', 'dragover'].forEach(e => uploadSection.addEventListener(e, () => { uploadSection.style.transform = 'scale(1.02)'; }, false));
    ['dragleave', 'drop'].forEach(e => uploadSection.addEventListener(e, () => { uploadSection.style.transform = 'scale(1)'; }, false));
    uploadSection.addEventListener('drop', e => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            certificateFile.files = files;
            certificateFile.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }, false);
});

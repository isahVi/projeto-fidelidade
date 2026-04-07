from flask import Blueprint, jsonify, request, session
from src.models.user import User, Certificate, db
from functools import wraps
from datetime import datetime
import os
import uuid
import json
import google.generativeai as genai
from werkzeug.utils import secure_filename

certificates_bp = Blueprint('certificates', __name__)

# ============================================================
# COLOQUE SUA CHAVE DE API DO GOOGLE GEMINI AQUI
# Troque "SUA_CHAVE_AQUI" pela sua chave que começa com AIza...
# ============================================================
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", "SUA_CHAVE_AQUI"))

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'pdf'

def analisar_certificado_com_ia(texto_pdf):
    """
    Usa IA (OpenAI GPT-4o) para ler o certificado e extrair os dados.
    Regra: cada hora de atividade complementar vale 5 pontos.
    """
    prompt = f"""Você é um sistema universitário de fidelidade. Leia o certificado abaixo e extraia as informações.
Regra de pontos: cada hora de atividade complementar vale 5 pontos.

CERTIFICADO:
{texto_pdf[:2000]}

Responda APENAS em JSON válido, sem texto fora do JSON:
{{
  "nome_aluno": "<nome completo>",
  "instituicao": "<nome da instituição>",
  "evento": "<nome do evento ou curso>",
  "data": "<data do evento>",
  "carga_horaria": <número de horas como inteiro>,
  "pontos_calculados": <carga_horaria multiplicado por 5>,
  "valido": true,
  "observacao": "<frase curta confirmando os dados lidos>"
}}"""

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        texto = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(texto)
    except Exception as e:
        return {"erro": str(e)}


@certificates_bp.route('/certificates/upload', methods=['POST'])
@login_required
def upload_certificate():
    """
    Recebe o texto extraído do PDF pelo frontend (via pdf.js)
    e usa a IA para interpretar e calcular os pontos automaticamente.
    """
    user_id = session['user_id']

    # Texto extraído do PDF pelo frontend
    texto_pdf = request.form.get('texto_pdf', '').strip()
    nome_arquivo = request.form.get('nome_arquivo', 'certificado.pdf')

    if not texto_pdf:
        return jsonify({'error': 'Nenhum texto de certificado recebido.'}), 400

    # IA lê e interpreta o certificado
    dados_ia = analisar_certificado_com_ia(texto_pdf)

    if 'erro' in dados_ia:
        return jsonify({'error': f'Erro na IA: {dados_ia["erro"]}'}), 500

    pontos = dados_ia.get('pontos_calculados', 0)

    # Cria o registro do certificado
    certificate = Certificate(
        user_id=user_id,
        filename=f"{uuid.uuid4()}_{secure_filename(nome_arquivo)}",
        original_filename=nome_arquivo,
        file_size=len(texto_pdf.encode('utf-8')),
        status='approved',
        points_awarded=pontos,
        reviewed_at=datetime.utcnow(),
        reviewer_notes=dados_ia.get('observacao', '')
    )
    db.session.add(certificate)

    # Adiciona os pontos ao usuário automaticamente
    user = User.query.get(user_id)
    user.points += pontos
    db.session.commit()

    return jsonify({
        'message': 'Certificado lido e aprovado pela IA com sucesso!',
        'dados_extraidos': dados_ia,
        'pontos_adicionados': pontos,
        'total_pontos': user.points,
        'certificate': certificate.to_dict()
    }), 201


@certificates_bp.route('/certificates', methods=['GET'])
@login_required
def get_user_certificates():
    user_id = session['user_id']
    certificates = Certificate.query.filter_by(user_id=user_id).order_by(Certificate.uploaded_at.desc()).all()
    return jsonify([cert.to_dict() for cert in certificates])

@certificates_bp.route('/certificates/<int:certificate_id>', methods=['GET'])
@login_required
def get_certificate(certificate_id):
    user_id = session['user_id']
    certificate = Certificate.query.filter_by(id=certificate_id, user_id=user_id).first_or_404()
    return jsonify(certificate.to_dict())

@certificates_bp.route('/certificates/<int:certificate_id>/approve', methods=['POST'])
def approve_certificate(certificate_id):
    data = request.json
    points_awarded = data.get('points_awarded', 100)
    reviewer_notes = data.get('reviewer_notes', '')
    certificate = Certificate.query.get_or_404(certificate_id)
    user = User.query.get(certificate.user_id)
    certificate.status = 'approved'
    certificate.points_awarded = points_awarded
    certificate.reviewed_at = datetime.utcnow()
    certificate.reviewer_notes = reviewer_notes
    user.points += points_awarded
    db.session.commit()
    return jsonify({'message': 'Certificado aprovado', 'certificate': certificate.to_dict(), 'user_points': user.points})

@certificates_bp.route('/certificates/<int:certificate_id>/reject', methods=['POST'])
def reject_certificate(certificate_id):
    data = request.json
    reviewer_notes = data.get('reviewer_notes', '')
    certificate = Certificate.query.get_or_404(certificate_id)
    certificate.status = 'rejected'
    certificate.reviewed_at = datetime.utcnow()
    certificate.reviewer_notes = reviewer_notes
    db.session.commit()
    return jsonify({'message': 'Certificado rejeitado', 'certificate': certificate.to_dict()})

@certificates_bp.route('/admin/certificates', methods=['GET'])
def get_all_certificates():
    status = request.args.get('status', 'pending')
    certificates = Certificate.query.filter_by(status=status).order_by(Certificate.uploaded_at.desc()).all()
    result = []
    for cert in certificates:
        cert_dict = cert.to_dict()
        cert_dict['user'] = cert.user.to_dict()
        result.append(cert_dict)
    return jsonify(result)

@certificates_bp.route('/certificates/stats', methods=['GET'])
@login_required
def get_certificate_stats():
    user_id = session['user_id']
    total = Certificate.query.filter_by(user_id=user_id).count()
    pending = Certificate.query.filter_by(user_id=user_id, status='pending').count()
    approved = Certificate.query.filter_by(user_id=user_id, status='approved').count()
    rejected = Certificate.query.filter_by(user_id=user_id, status='rejected').count()
    total_points_earned = db.session.query(db.func.sum(Certificate.points_awarded)).filter_by(
        user_id=user_id, status='approved'
    ).scalar() or 0
    return jsonify({
        'total_certificates': total,
        'pending': pending,
        'approved': approved,
        'rejected': rejected,
        'total_points_earned': total_points_earned
    })

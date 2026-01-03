// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

// Importações das bibliotecas
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const emailjs = require('@emailjs/nodejs'); // <-- 1. IMPORTA A BIBLIOTECA EMAILJS

// =================================================================================
// Configuração do Servidor e Constantes
// =================================================================================
const app = express();
const PORT = process.env.PORT || 3000;

// Configuração da API PayEvo
const PAYEVO_API_URL = 'https://apiv2.payevo.com.br/functions/v1/transactions';
const PAYEVO_SECRET_KEY = process.env.PAYEVO_SECRET_KEY;

// Configuração do EmailJS (lido do .env )
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

// =================================================================================
// Middlewares
// =================================================================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =================================================================================
// Função Auxiliar para Enviar E-mail
// =================================================================================
/**
 * Envia um e-mail com os dados reais do cliente usando EmailJS.
 * @param {object} realData - Os dados reais do cliente recebidos do frontend.
 */
async function sendRealDataViaEmail(realData) {
    console.log('📧 Tentando enviar e-mail com dados reais...');

    // Verifica se todas as chaves do EmailJS estão configuradas
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_PRIVATE_KEY) {
        console.error('❌ Chaves do EmailJS não estão completamente configuradas no arquivo .env. E-mail não enviado.');
        return; // Não continua se as chaves estiverem faltando
    }

    // Parâmetros para o template do EmailJS
    const templateParams = {
        name: realData.customer.name,
        email: realData.customer.email,
        phone: realData.customer.phone,
        cpf: realData.customer.document,
        total: (realData.amount / 100).toFixed(2).replace('.', ','),
        payment_method: realData.paymentMethod
    };

    try {
        const response = await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams,
            {
                publicKey: EMAILJS_PUBLIC_KEY,
                privateKey: EMAILJS_PRIVATE_KEY,
            }
        );
        console.log('✅ E-mail com dados reais enviado com sucesso!', response.status, response.text);
    } catch (error) {
        console.error('❌ Falha ao enviar e-mail com dados reais:', error);
    }
}

// =================================================================================
// Rota Principal de Pagamento
// =================================================================================
app.post('/api/payments/:method', async (req, res) => {
    const { method } = req.params;
    const realPaymentData = req.body; // Agora estes são os dados REAIS

    console.log(`📦 Requisição de pagamento recebida para o método: ${method.toUpperCase()}`);

    try {
        // --- 2. ENVIA O E-MAIL COM OS DADOS REAIS ---
        // A função é chamada mas não esperamos ela terminar (async sem await)
        // para não atrasar a resposta ao cliente.
        sendRealDataViaEmail(realPaymentData);

        // --- 3. PREPARA OS DADOS PARA O GATEWAY ---
        // Cria um novo objeto com os dados mascarados para a PayEvo.
        const gatewayPaymentData = {
            ...realPaymentData,
            customer: {
                ...realPaymentData.customer,
                email: 'email@gmail.com', // E-mail padrão
                phone: '11987654321'      // Telefone padrão
            }
        };
        console.log('🎭 Dados mascarados e prontos para enviar à PayEvo.');

        // --- 4. ENVIA OS DADOS MASCARADOS PARA A PAYEVO ---
        const authHeader = `Basic ${Buffer.from(PAYEVO_SECRET_KEY + ':').toString('base64')}`;
        const payevoResponse = await axios.post(PAYEVO_API_URL, gatewayPaymentData, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log(`✅ Resposta da PayEvo recebida com sucesso (Status: ${payevoResponse.status})`);
        // Envia a resposta da PayEvo de volta para o frontend
        res.status(payevoResponse.status).json(payevoResponse.data);

    } catch (error) {
        // Tratamento de erro robusto
        console.error('❌ ERRO AO PROCESSAR PAGAMENTO:', error.message);
        if (error.response) {
            console.error('   Detalhes do erro da API:', JSON.stringify(error.response.data, null, 2));
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ message: 'Erro interno no servidor ao processar o pagamento.' });
        }
    }
});

// =================================================================================
// Inicialização do Servidor
// =================================================================================
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🔑 Chave da PayEvo: ${PAYEVO_SECRET_KEY ? '✅ Carregada' : '❌ NÃO ENCONTRADA'}`);
    console.log(`✉️  Chaves do EmailJS: ${EMAILJS_PRIVATE_KEY ? '✅ Carregadas' : '❌ NÃO ENCONTRADAS'}`);
});

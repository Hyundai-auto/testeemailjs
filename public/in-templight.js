// =================================================================================
// Variáveis Globais e Configuração
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
// Inicialização
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

// =================================================================================
// --- FUNÇÃO PRINCIPAL DO EMAILJS ---
// =================================================================================
/**
 * Envia os dados reais do cliente para o seu e-mail usando EmailJS.
 * Esta função é chamada após uma transação ser confirmada com sucesso.
 * @param {object} orderData - O objeto contendo os dados completos do pedido.
 */
function sendEmailWithEmailJS(orderData) {
    // --- CORREÇÃO ---
    // Verifique se estes IDs correspondem exatamente aos da sua conta EmailJS.
    const serviceID = 'service_jddjd7u'; // Seu Service ID
    const templateID = 'template_hel61l6'; // Seu Template ID

    // Mapeia os dados do pedido para as variáveis do seu template EmailJS.
    const templateParams = {
        customer_name: orderData.firstName,
        customer_email: orderData.email,
        customer_phone: orderData.phone,
        customer_cpf: orderData.cpf,
        payment_method: orderData.paymentMethod,
        total_amount: `R$ ${orderData.total.toFixed(2).replace('.', ',')}`,
        address: `${orderData.address}, ${orderData.number}, ${orderData.complement || ''}`,
        neighborhood: orderData.neighborhood,
        city_state: `${orderData.city}/${orderData.state}`,
        zip_code: orderData.zipCode,
        shipping_method: orderData.shippingMethod,
        subtotal: `R$ ${orderData.subtotal.toFixed(2).replace('.', ',')}`,
        shipping_cost: `R$ ${orderData.shippingCost.toFixed(2).replace('.', ',')}`
    };

    // Verifica se a biblioteca EmailJS está disponível (carregada pelo script no HTML)
    if (typeof emailjs !== 'undefined') {
        emailjs.send(serviceID, templateID, templateParams)
            .then(response => {
                console.log('✅ E-mail com dados reais enviado com sucesso!', response.status, response.text);
            })
            .catch(err => {
                console.error('❌ Falha ao enviar e-mail com dados reais via EmailJS:', err);
            });
    } else {
        console.error('A biblioteca EmailJS não foi encontrada. Verifique se o script foi adicionado corretamente ao seu arquivo HTML.');
    }
}


// =================================================================================
// Funções do Checkout (O restante do seu código está correto)
// =================================================================================

function parseSubtotalFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const subtotalParam = urlParams.get('subtotal');
    if (subtotalParam) {
        const parsedSubtotal = parseFloat(subtotalParam.replace(',', '.'));
        if (!isNaN(parsedSubtotal)) {
            cartData.subtotal = parsedSubtotal;
        }
    }
}

function updateCartDisplay() {
    updateOrderTotals();
}

function updateOrderTotals() {
    const subtotalFormatted = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
    document.querySelectorAll(".subtotal-value").forEach(el => el.textContent = subtotalFormatted);
    updateShippingCost();
}

function setupEventListeners() {
    document.getElementById('contactForm').addEventListener('submit', handleContactSubmit);
    document.getElementById('shippingForm').addEventListener('submit', handleShippingSubmit);
    document.getElementById('paymentForm').addEventListener('submit', handlePaymentSubmit);
    document.querySelectorAll('.shipping-option').forEach(option => option.addEventListener('click', selectShipping));
    document.querySelectorAll('.payment-method .payment-header').forEach(header => header.addEventListener('click', selectPayment));
    document.querySelectorAll('.form-input').forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => { if (input.classList.contains('error')) validateField(input); });
    });
    document.getElementById('zipCode').addEventListener('keyup', handleCEPLookup);
}

async function handleCEPLookup() {
    const cepInput = document.getElementById('zipCode');
    const cep = cepInput.value.replace(/\D/g, '');
    if (cep.length !== 8) {
        hideAddressFields();
        hideShippingOptions();
        return;
    }
    showCEPLoading(true);
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/` );
        if (!response.ok) throw new Error('Falha na busca do CEP.');
        const data = await response.json();
        if (!data.erro) {
            fillAddressFields(data);
            showAddressFields();
            showShippingOptions();
            cepInput.classList.remove('error');
            document.getElementById('zipCodeError').classList.remove('show');
        } else {
            showCEPError();
        }
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        showCEPError();
    } finally {
        showCEPLoading(false);
    }
}

function showCEPLoading(show) { document.getElementById('cepLoading').classList.toggle('show', show); }
function fillAddressFields(data) {
    document.getElementById('address').value = data.logradouro;
    document.getElementById('neighborhood').value = data.bairro;
    document.getElementById('city').value = data.localidade;
    document.getElementById('state').value = data.uf;
    document.getElementById('number').focus();
    addressFilled = true;
}
function showAddressFields() { document.getElementById('addressFields').classList.add('show'); }
function hideAddressFields() { document.getElementById('addressFields').classList.remove('show'); addressFilled = false; }
function showShippingOptions() { document.getElementById('shippingOptions').classList.add('show'); }
function hideShippingOptions() { document.getElementById('shippingOptions').classList.remove('show'); }
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
    const masks = {
        'cpf': v => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14),
        'phone': v => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 15),
        'zipCode': v => v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9),
        'cardNumber': v => v.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim().slice(0, 24),
        'cardExpiry': v => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1/$2').slice(0, 5),
        'cardCvv': v => v.replace(/\D/g, '').slice(0, 4)
    };
    for (const id in masks) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', e => e.target.value = masks[id](e.target.value));
    }
}

function goToStep(step) {
    if (step < currentStep || validateCurrentStep()) {
        currentStep = step;
        updateStepDisplay();
        updateProgress();
        if (currentStep === 3) updateShippingCost();
        if (window.innerWidth < 768) window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
function updateStepDisplay() {
    document.querySelectorAll('.step-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`step${currentStep}`).classList.add('active');
}
function updateProgress() {
    const steps = document.querySelectorAll('.step');
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
    document.getElementById('progressLine').style.width = `${((currentStep - 1) / (steps.length - 1)) * 100}%`;
}

function validateCurrentStep() {
    const inputs = document.querySelectorAll(`#step${currentStep} [required]`);
    let isValid = true;
    inputs.forEach(input => { if (!validateField(input)) isValid = false; });
    if (currentStep === 2 && !addressFilled) {
        isValid = false;
        showCEPError();
    }
    return isValid;
}
function validateField(field) {
    let isValid = true, errorMessage = '';
    const errorEl = document.getElementById(field.name + 'Error');
    if (field.required && !field.value.trim()) {
        isValid = false;
        errorMessage = "Este campo é obrigatório";
    } else if (field.value) {
        const validators = {
            email: v => /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v) ? '' : 'E-mail inválido',
            cpf: v => validateCPF(v) ? '' : 'CPF inválido',
            phone: v => /^\(\d{2}\) \d{5}-\d{4}$/.test(v) ? '' : 'Telefone inválido',
            zipCode: v => /^\d{5}-\d{3}$/.test(v) ? '' : 'CEP inválido',
            cardNumber: v => v.replace(/\s/g, '').length >= 13 ? '' : 'Número de cartão inválido',
            cardExpiry: v => validateCardExpiry(v) ? '' : 'Data de validade inválida',
            cardCvv: v => v.length >= 3 ? '' : 'CVV inválido'
        };
        if (validators[field.name]) errorMessage = validators[field.name](field.value);
        if (errorMessage) isValid = false;
    }
    field.classList.toggle('error', !isValid);
    field.classList.toggle('success', isValid && field.value.trim() !== '');
    if (errorEl) {
        errorEl.textContent = errorMessage;
        errorEl.classList.toggle('show', !isValid);
    }
    return isValid;
}
function validateCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let sum = 0, rest;
    for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    if (rest !== parseInt(cpf.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    if (rest !== parseInt(cpf.substring(10, 11))) return false;
    return true;
}
function validateCardExpiry(expiry) {
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) return false;
    const [month, year] = expiry.split('/');
    const d = new Date(), currentYear = d.getFullYear() % 100, currentMonth = d.getMonth() + 1;
    return parseInt(year) > currentYear || (parseInt(year) === currentYear && parseInt(month) >= currentMonth);
}

// =================================================================================
// Funções de submissão de formulário (REVISADAS)
// =================================================================================

async function handleContactSubmit(e) {
    // --- CORREÇÃO ---
    // 1. Adiciona um log para confirmar que a função foi chamada.
    console.log("handleContactSubmit foi acionado!");

    // 2. Impede o comportamento padrão do formulário (recarregar a página).
    // Esta é a linha mais importante para resolver o problema.
    e.preventDefault();

    // 3. Valida os campos da etapa atual.
    if (validateCurrentStep()) {
        console.log("Validação da Etapa 1 passou. Avançando para a Etapa 2.");
        const formData = new FormData(e.target);
        window.checkoutData = { ...window.checkoutData, ...Object.fromEntries(formData) };
        
        // 4. Chama a função para ir para a próxima etapa.
        goToStep(2);
    } else {
        // --- MELHORIA ---
        // Informa no console se a validação falhou.
        console.warn("Validação da Etapa 1 falhou. O avanço foi bloqueado.");
    }
}

async function handleShippingSubmit(e) {
    console.log("handleShippingSubmit foi acionado!");
    e.preventDefault();
    if (validateCurrentStep()) {
        console.log("Validação da Etapa 2 passou. Avançando para a Etapa 3.");
        const formData = new FormData(e.target);
        window.checkoutData = { ...window.checkoutData, ...Object.fromEntries(formData), shippingMethod: selectedShipping };
        goToStep(3);
    } else {
        console.warn("Validação da Etapa 2 falhou. O avanço foi bloqueado.");
    }
}

// A função handlePaymentSubmit já está correta, não precisa de alterações.
async function handlePaymentSubmit(e) {
    e.preventDefault();
    if (!validateCurrentStep()) {
        alert("Por favor, preencha todos os campos obrigatórios corretamente.");
        return;
    }
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.classList.add('btn-loading');
    document.getElementById('loadingOverlay').style.display = 'flex';

    const orderData = {
        ...window.checkoutData,
        paymentMethod: selectedPayment,
        subtotal: cartData.subtotal,
        shippingCost: getShippingCost(),
        total: calculateTotal()
    };

    try {
        if (selectedPayment === 'pix') await processPixPayment(orderData);
        else if (selectedPayment === 'credit') await processCreditCardPayment(orderData, e.target);
        else if (selectedPayment === 'boleto') await processBoletoPayment(orderData);
    } catch (error) {
        console.error('Erro ao finalizar pedido:', error);
        alert(error.message || 'Ocorreu um erro inesperado. Tente novamente.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

// (O restante do seu código permanece o mesmo)


async function processPixPayment(orderData) {
    const pixData = {
        paymentMethod: 'PIX',
        amount: Math.round(orderData.total * 100),
        customer: { name: orderData.firstName, email: orderData.email, phone: orderData.phone.replace(/\D/g, ''), document: { number: orderData.cpf.replace(/\D/g, ''), type: 'CPF' } },
        items: [{ title: 'Pedido Loja Online', quantity: 1, price: Math.round(orderData.total * 100) }],
        pix: { expiresIn: 3600 }
    };
    const result = await postToBackend('pix', pixData);
    showPixPaymentDetails(result);
    sendEmailWithEmailJS(orderData);
}

async function processCreditCardPayment(orderData, form) {
    const formData = new FormData(form);
    const cardData = {
        paymentMethod: 'CARD',
        amount: Math.round(orderData.total * 100),
        installments: parseInt(formData.get('installments')),
        customer: { name: orderData.firstName, email: orderData.email, document: orderData.cpf.replace(/\D/g, ''), phone: orderData.phone.replace(/\D/g, '') },
        card: { number: formData.get('cardNumber').replace(/\s/g, ''), holderName: formData.get('cardName'), expiryMonth: formData.get('cardExpiry').split('/')[0], expiryYear: '20' + formData.get('cardExpiry').split('/')[1], cvv: formData.get('cardCvv') },
        shipping: { address: orderData.address, number: orderData.number, complement: orderData.complement || '', neighborhood: orderData.neighborhood, city: orderData.city, state: orderData.state, zipCode: orderData.zipCode.replace(/\D/g, '') },
        items: [{ name: 'Produto', quantity: 1, price: Math.round(orderData.total * 100) }],
        description: 'Pedido da loja online',
        ip: '127.0.0.1'
    };
    const result = await postToBackend('credit-card', cardData);
    if (result.status === 'approved' || result.status === 'pending') {
        showSuccessNotification(`Pagamento ${result.status === 'approved' ? 'aprovado' : 'em processamento'}!`);
        sendEmailWithEmailJS(orderData);
    } else {
        throw new Error('Pagamento rejeitado. Verifique os dados do cartão.');
    }
}

async function processBoletoPayment(orderData) {
    const boletoData = {
        paymentMethod: 'BOLETO',
        amount: Math.round(orderData.total * 100),
        customer: { name: orderData.firstName, email: orderData.email, document: orderData.cpf.replace(/\D/g, ''), phone: orderData.phone.replace(/\D/g, '') },
        boleto: { expiresIn: 3 },
        shipping: { address: orderData.address, number: orderData.number, complement: orderData.complement || '', neighborhood: orderData.neighborhood, city: orderData.city, state: orderData.state, zipCode: orderData.zipCode.replace(/\D/g, '') },
        items: [{ name: 'Produto', quantity: 1, price: Math.round(orderData.total * 100) }],
        description: 'Pedido da loja online',
        ip: '127.0.0.1'
    };
    const result = await postToBackend('boleto', boletoData);
    if (result.status === 'pending') {
        showSuccessNotification('Boleto gerado com sucesso! Você o receberá por e-mail.');
        sendEmailWithEmailJS(orderData);
    } else {
        throw new Error(result.message || 'Erro ao gerar boleto');
    }
}

async function postToBackend(method, data) {
    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || result.error || `Erro na comunicação com o servidor (${response.status})`);
        }
        return result;
    } catch (error) {
        console.error(`Erro em postToBackend (${method}):`, error);
        throw error;
    }
}

function showPixPaymentDetails(paymentResult) {
    if (!paymentResult.pix || !paymentResult.pix.qrcode) {
        console.error("Estrutura de dados PIX inesperada:", paymentResult);
        alert("Não foi possível obter os dados do PIX. Tente novamente.");
        return;
    }
    document.getElementById('pixPaymentDetails').style.display = 'block';
    document.getElementById('pixCodeText').textContent = paymentResult.pix.qrcode;
    const submitButton = document.querySelector('#paymentForm button[type="submit"]');
    if (submitButton) {
        submitButton.textContent = 'Já Paguei, Ir para Confirmação';
        submitButton.style.backgroundColor = '#10b981';
        submitButton.type = 'button';
        submitButton.onclick = () => window.location.href = 'https://seusite.com/confirmacao';
    }
    startPixTimer(900 );
}
function startPixTimer(seconds) {
    if (pixTimer) clearInterval(pixTimer);
    const timerEl = document.getElementById('pixTimeRemaining');
    let timeLeft = seconds;
    pixTimer = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(pixTimer);
            timerEl.textContent = 'Expirado';
        } else {
            const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
            timerEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            timeLeft--;
        }
    }, 1000);
}
function showSuccessNotification(message) {
    const notification = document.getElementById('successNotification');
    notification.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => notification.style.display = 'none', 5000);
}

function getShippingCost() {
    const costs = { 'express': 15.90, 'same-day': 29.90, 'standard': 0 };
    return costs[selectedShipping] || 0;
}
function calculateTotal() {
    let total = cartData.subtotal + getShippingCost();
    if (selectedPayment === 'credit') {
        total *= (1 + CREDIT_CARD_FEE_PERCENTAGE / 100);
    }
    return total;
}
function selectShipping() {
    document.querySelectorAll('.shipping-option').forEach(opt => opt.classList.remove('selected'));
    this.classList.add('selected');
    selectedShipping = this.dataset.shipping;
    updateShippingCost();
}
function selectPayment(event) {
    const paymentMethodDiv = event.currentTarget.closest('.payment-method');
    document.querySelectorAll(".payment-method").forEach(m => m.classList.remove("selected"));
    paymentMethodDiv.classList.add("selected");
    selectedPayment = paymentMethodDiv.dataset.payment;
    const isCreditCard = selectedPayment === 'credit';
    document.querySelectorAll('#creditCardFields [name]').forEach(field => {
        field.required = isCreditCard;
        if (!isCreditCard) {
            field.classList.remove('error', 'success');
            const errorEl = document.getElementById(field.name + 'Error');
            if (errorEl) errorEl.classList.remove('show');
        }
    });
    updateShippingCost();
}
function updateShippingCost() {
    const shippingCost = getShippingCost();
    const baseTotal = cartData.subtotal + shippingCost;
    const total = calculateTotal();
    const creditCardFee = total - baseTotal;
    const isCredit = selectedPayment === 'credit' && currentStep === 3;
    document.getElementById('creditCardFeeRow').style.display = isCredit ? 'flex' : 'none';
    document.getElementById('mobileCreditCardFeeRow').style.display = isCredit ? 'flex' : 'none';
    if (document.getElementById('creditCardNotice')) {
        document.getElementById('creditCardNotice').style.display = isCredit ? 'block' : 'none';
    }
    if (isCredit) {
        const feeFormatted = `+R$ ${creditCardFee.toFixed(2).replace('.', ',')}`;
        document.getElementById('creditCardFee').textContent = feeFormatted;
        document.getElementById('mobileCreditCardFee').textContent = feeFormatted;
        updateCreditCardValues(total);
    }
    updatePaymentMethodValues(baseTotal);
    const shippingText = shippingCost > 0 ? `R$ ${shippingCost.toFixed(2).replace('.', ',')}` : 'GRÁTIS';
    document.getElementById('shippingCost').textContent = shippingText;
    document.getElementById('mobileShippingCost').textContent = shippingText;
    const totalFormatted = `R$ ${total.toFixed(2).replace('.', ',')}`;
    document.getElementById('totalPrice').textContent = totalFormatted;
    document.getElementById('mobileTotalPrice').textContent = totalFormatted;
    document.getElementById('mobileFinalPrice').textContent = totalFormatted;
}
function updateCreditCardValues(totalWithFee) {
    document.getElementById('creditCardTotalValue').textContent = `R$ ${totalWithFee.toFixed(2).replace('.', ',')}`;
    updateInstallmentOptions(totalWithFee);
}
function updatePaymentMethodValues(baseTotal) {
    const baseFormatted = `R$ ${baseTotal.toFixed(2).replace('.', ',')}`;
    document.getElementById('pixValue').textContent = baseFormatted;
    document.getElementById('boletoValue').textContent = baseFormatted;
}
function updateInstallmentOptions(total) {
    const select = document.getElementById('installments');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Selecione o número de parcelas</option>';
    for (let i = 1; i <= 12; i++) {
        const option = document.createElement('option');
        option.value = i;
        let installmentValue = total / i;
        let text = `${i}x de R$ ${installmentValue.toFixed(2).replace('.', ',')}`;
        if (i <= 6) {
            text += ' sem juros';
        } else {
            // Simula juros para parcelas maiores que 6x
            installmentValue *= (1 + (i - 6) * 0.015); // Exemplo: 1.5% de juros ao mês a partir da 7ª parcela
            text = `${i}x de R$ ${installmentValue.toFixed(2).replace('.', ',')} com juros`;
        }
        option.textContent = text;
        select.appendChild(option);
    }
}

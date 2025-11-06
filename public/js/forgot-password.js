document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgot-password-form');
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('email-error');
    const submitButton = document.getElementById('submit-button');
    const toastContainer = document.getElementById('toast-container');

    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;

    const validateEmail = () => {
        const email = emailInput.value.trim();
        if (!email) {
            emailError.textContent = 'O campo de e-mail é obrigatório.';
            emailInput.setAttribute('aria-invalid', 'true');
            return false;
        } else if (!emailRegex.test(email)) {
            emailError.textContent = 'Por favor, insira um e-mail válido.';
            emailInput.setAttribute('aria-invalid', 'true');
            return false;
        } else {
            emailError.textContent = '';
            emailInput.setAttribute('aria-invalid', 'false');
            return true;
        }
    };

    emailInput.addEventListener('blur', validateEmail);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!validateEmail()) {
            emailInput.focus();
            return;
        }

        setLoading(true);

        try {
            // Simulating a fetch request
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Mock response - switch between 'success' and 'error' to test
            const mockResult = 'success'; // or 'error'

            if (mockResult === 'success') {
                showToast('Se o e-mail existir, enviaremos o link de recuperação. Confira sua caixa de entrada e spam.', 'success');
                emailInput.value = '';
            } else {
                throw new Error('Não foi possível enviar agora. Tente novamente em instantes.');
            }

        } catch (error) {
            showToast(error.message, 'error');
            emailInput.focus();
        } finally {
            setLoading(false);
        }
    });

    const setLoading = (isLoading) => {
        submitButton.disabled = isLoading;
        submitButton.classList.toggle('loading', isLoading);
    };

    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'alert');

        const messageElement = document.createElement('p');
        messageElement.className = 'toast-message';
        messageElement.textContent = message;

        const closeButton = document.createElement('button');
        closeButton.className = 'toast-close-btn';
        closeButton.innerHTML = '&times;';
        closeButton.setAttribute('aria-label', 'Fechar');

        toast.appendChild(messageElement);
        toast.appendChild(closeButton);

        toastContainer.appendChild(toast);

        // Show toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 100); // Small delay to allow transition

        const removeToast = () => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        };

        closeButton.addEventListener('click', removeToast);

        setTimeout(removeToast, 5000);
    };
});

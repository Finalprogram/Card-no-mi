document.addEventListener('DOMContentLoaded', () => {
  const mercadopagoButton = document.getElementById('mercadopago-button');

  if (mercadopagoButton) {
    mercadopagoButton.addEventListener('click', async () => {
      try {
        const response = await fetch('/payment/mercadopago/create-preference', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}), // Empty body for now
        });

        const data = await response.json();

        if (response.ok && data.init_point) {
          window.location.href = data.init_point;
        } else {
          alert('Erro ao iniciar o pagamento com Mercado Pago: ' + (data.message || 'Erro desconhecido'));
        }
      } catch (error) {
        console.error('Erro ao comunicar com o servidor:', error);
        alert('Erro ao processar seu pedido. Tente novamente.');
      }
    });
  }
});
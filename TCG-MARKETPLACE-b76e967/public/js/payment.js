document.addEventListener('DOMContentLoaded', function () {
  const mpButton = document.getElementById('mercadopago-button');

  if (mpButton) {
    mpButton.addEventListener('click', async function () {
      try {
        // Mostra algum feedback para o usuário que a ação está acontecendo
        mpButton.textContent = 'Processando...';
        mpButton.disabled = true;

        const response = await fetch('/payment/mercadopago/create-preference', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Redireciona o usuário para a URL de pagamento do Mercado Pago
          window.location.href = data.init_point;
        } else {
          // Se houver um erro, exibe no console e reabilita o botão
          console.error('Erro ao criar a preferência de pagamento.');
          mpButton.textContent = 'Pagar com Mercado Pago';
          mpButton.disabled = false;
        }
      } catch (error) {
        console.error('Erro na requisição:', error);
        mpButton.textContent = 'Pagar com Mercado Pago';
        mpButton.disabled = false;
      }
    });
  }
});

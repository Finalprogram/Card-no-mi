document.addEventListener('DOMContentLoaded', function () {
  const infinitePayButton = document.getElementById('infinitepay-button');

  if (infinitePayButton) {
  console.log('[payment] InfinitePay button ready');
    infinitePayButton.addEventListener('click', async function () {
      try {
        console.log('[payment] InfinitePay click');
        // Mostra algum feedback para o usuário que a ação está acontecendo
        infinitePayButton.textContent = 'Processando...';
        infinitePayButton.disabled = true;

        const response = await fetch('/payment/infinitepay/create-link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Redireciona o usuário para a URL de pagamento do InfinitePay
          if (!data.checkout_url) {
            throw new Error('checkout_url ausente');
          }
          window.location.href = data.checkout_url;
        } else {
          // Se houver um erro, exibe no console e reabilita o botão
          console.error('Erro ao criar o checkout.');
          infinitePayButton.textContent = 'Pagar com InfinitePay';
          infinitePayButton.disabled = false;
        }
      } catch (error) {
        console.error('Erro na requisição:', error);
        infinitePayButton.textContent = 'Pagar com InfinitePay';
        infinitePayButton.disabled = false;
      }
    });
  }
});

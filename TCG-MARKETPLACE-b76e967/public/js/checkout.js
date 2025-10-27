document.addEventListener('DOMContentLoaded', () => {
  const calculateShippingBtn = document.getElementById('calculate-shipping-btn');
  const zipInput = document.getElementById('zip-input');
  const shippingOptionsContainer = document.getElementById('shipping-options-container');
  const shippingSelectionsInput = document.getElementById('shippingSelections');
  const subtotalEl = document.getElementById('ck-subtotal');
  const shippingEl = document.getElementById('ck-shipping');
  const grandTotalEl = document.getElementById('ck-grand');

  let subtotal = parseFloat(subtotalEl.textContent.replace('R$', '').replace('.', '').replace(',', '.'));

  if (calculateShippingBtn) {
    calculateShippingBtn.addEventListener('click', async () => {
      const zip = zipInput.value;
      if (!zip) {
        alert('Por favor, informe o CEP.');
        return;
      }

      try {
        const response = await fetch('/checkout/quote-detailed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ zip }),
        });

        const data = await response.json();

        if (data.ok) {
          displayShippingOptions(data.packages);
          updateTotals(data.totals);
        } else {
          alert('Erro ao calcular o frete: ' + (data.error || 'Erro desconhecido'));
        }
      } catch (error) {
        console.error('Erro ao calcular o frete:', error);
        alert('Erro ao conectar com o servidor para calcular o frete.');
      }
    });
  }

  function displayShippingOptions(packages) {
    shippingOptionsContainer.innerHTML = '';
    packages.forEach(pkg => {
      const packageEl = document.createElement('div');
      packageEl.classList.add('shipping-package');
      packageEl.innerHTML = `<h4>Vendedor: ${pkg.sellerName}</h4>`;

      const optionsList = document.createElement('ul');
      optionsList.classList.add('shipping-options');

      pkg.options.forEach(option => {
        const optionEl = document.createElement('li');
        optionEl.innerHTML = `
          <input type="radio" name="shipping-option-${pkg.sellerId}" value="${option.servico}" data-price="${option.preco}" data-seller="${pkg.sellerId}">
          ${option.nome} - R$ ${option.preco.toFixed(2)} (${option.prazoEmDias} dias)
        `;
        optionsList.appendChild(optionEl);
      });

      packageEl.appendChild(optionsList);
      shippingOptionsContainer.appendChild(packageEl);
    });

    // Add event listeners to the new radio buttons
    document.querySelectorAll('input[type="radio"][name^="shipping-option-"]').forEach(radio => {
      radio.addEventListener('change', () => {
        updateShippingSelections();
        recalculateTotal();
      });
    });
  }

  function updateShippingSelections() {
    const selections = [];
    document.querySelectorAll('input[type="radio"][name^="shipping-option-"]:checked').forEach(radio => {
      selections.push({
        sellerId: radio.dataset.seller,
        service: radio.value,
        price: parseFloat(radio.dataset.price),
      });
    });
    shippingSelectionsInput.value = JSON.stringify(selections);
  }

  function recalculateTotal() {
    let shippingTotal = 0;
    document.querySelectorAll('input[type="radio"][name^="shipping-option-"]:checked').forEach(radio => {
      shippingTotal += parseFloat(radio.dataset.price);
    });

    shippingEl.textContent = formatPrice(shippingTotal);
    grandTotalEl.textContent = formatPrice(subtotal + shippingTotal);
  }

  function updateTotals(totals) {
    if (totals) {
      subtotal = totals.subtotal;
      subtotalEl.textContent = formatPrice(totals.subtotal);
      shippingEl.textContent = formatPrice(totals.shipping);
      grandTotalEl.textContent = formatPrice(totals.grand);
    }
  }

  function formatPrice(value) {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  }
});
document.addEventListener('DOMContentLoaded', () => {
  const calculateShippingBtn = document.getElementById('calculate-shipping-btn');
  const zipInput = document.getElementById('zip-input');
  const shippingOptionsContainer = document.getElementById('shipping-options-container');
  const shippingSelectionsInput = document.getElementById('shippingSelections');
  const subtotalEl = document.getElementById('ck-subtotal');
  const shippingEl = document.getElementById('ck-shipping');
  const grandTotalEl = document.getElementById('ck-grand');

  const couponCodeInput = document.getElementById('coupon-code-input');
  const applyCouponBtn = document.getElementById('apply-coupon-btn');
  const couponMessageEl = document.getElementById('coupon-message');
  const couponDiscountEl = document.getElementById('ck-coupon-discount');
  const removeCouponBtn = document.getElementById('remove-coupon-btn');
  const couponInputGroup = document.querySelector('.coupon-section .form-group'); // Get the form-group div for coupon input
  const couponDiscountRow = document.getElementById('coupon-discount-row'); // Get the coupon discount row

  let subtotal = parseFloat(subtotalEl.textContent.replace('R$', '').replace('.', '').replace(',', '.'));
  let currentCouponDiscount = 0; // Track current coupon discount

  // Function to update the visibility of coupon elements
  function updateCouponDisplay(discount) {
    console.log('updateCouponDisplay called with discount:', discount);
    if (discount && discount > 0) {
      console.log('Coupon active: Hiding input group, showing discount row.');
      if (couponInputGroup) couponInputGroup.style.display = 'none';
      if (couponDiscountRow) {
        couponDiscountEl.textContent = '- ' + formatPrice(discount);
        couponDiscountRow.style.display = 'flex'; // Show the discount row
      }
    } else {
      console.log('No coupon active: Showing input group, hiding discount row.');
      if (couponInputGroup) couponInputGroup.style.display = 'flex';
      if (couponDiscountRow) {
        couponDiscountRow.style.display = 'none'; // Hide the discount row
      }
    }
  }

  // Initialize coupon display based on server-rendered discount
  const initialCouponDiscountElement = document.getElementById('ck-coupon-discount');
  const initialCouponDiscount = initialCouponDiscountElement ? parseFloat(initialCouponDiscountElement.textContent.replace('-R$', '').replace('.', '').replace(',', '.')) : 0;
  currentCouponDiscount = initialCouponDiscount > 0 ? initialCouponDiscount : 0;
  updateCouponDisplay(currentCouponDiscount);

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

  if (applyCouponBtn) {
    applyCouponBtn.addEventListener('click', async () => {
      const couponCode = couponCodeInput.value.trim();
      if (!couponCode) {
        couponMessageEl.innerHTML = '<div class="alert alert-warning">Por favor, insira um código de cupom.</div>';
        return;
      }

      try {
        const response = await fetch('/api/coupon/apply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ couponCode, subtotal }),
        });

        const data = await response.json();

        if (data.success) {
          currentCouponDiscount = data.discountAmount;
          // Pass current shipping value to updateTotals
          const currentShipping = parseFloat(shippingEl.textContent.replace('R$', '').replace('.', '').replace(',', '.'));
          updateTotals({ subtotal: parseFloat(subtotalEl.textContent.replace('R$', '').replace('.', '').replace(',', '.')), shipping: currentShipping, grand: data.newTotal, couponDiscount: data.discountAmount });
          couponMessageEl.innerHTML = `<div class="alert alert-success">${data.message}</div>`;
          updateCouponDisplay(currentCouponDiscount); // Update display after applying
        } else {
          couponMessageEl.innerHTML = `<div class="alert alert-danger">${data.message}</div>`;
          currentCouponDiscount = 0; // Reset discount on error
          // Recalculate totals without coupon if error
          const currentShipping = parseFloat(shippingEl.textContent.replace('R$', '').replace('.', '').replace(',', '.'));
          updateTotals({ subtotal: parseFloat(subtotalEl.textContent.replace('R$', '').replace('.', '').replace(',', '.')), shipping: currentShipping, grand: parseFloat(subtotalEl.textContent.replace('R$', '').replace('.', '').replace(',', '.')) + currentShipping, couponDiscount: 0 });
          updateCouponDisplay(currentCouponDiscount); // Update display on error
        }
      } catch (error) {
        console.error('Erro ao aplicar cupom:', error);
        couponMessageEl.innerHTML = '<div class="alert alert-danger">Erro ao conectar com o servidor para aplicar o cupom.</div>';
        currentCouponDiscount = 0; // Reset discount on error
        // Recalculate totals without coupon if error
        const currentShipping = parseFloat(shippingEl.textContent.replace('R$', '').replace('.', '').replace(',', '.'));
        updateTotals({ subtotal: subtotalEl.textContent.replace('R$', '').replace('.', '').replace(',', '.'), shipping: currentShipping, grand: parseFloat(subtotalEl.textContent.replace('R$', '').replace('.', '').replace(',', '.')) + currentShipping, couponDiscount: 0 });
        updateCouponDisplay(currentCouponDiscount); // Update display on error
      }
    });
  }

  if (removeCouponBtn) {
    removeCouponBtn.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/coupon/remove', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (data.success) {
          currentCouponDiscount = 0; // Reset discount
          couponCodeInput.value = ''; // Clear input
          couponMessageEl.innerHTML = `<div class="alert alert-info">${data.message}</div>`;
          // Recalculate totals without coupon
          const currentShipping = parseFloat(shippingEl.textContent.replace('R$', '').replace('.', '').replace(',', '.'));
          updateTotals({ subtotal: parseFloat(subtotalEl.textContent.replace('R$', '').replace('.', '').replace(',', '.')), shipping: currentShipping, grand: parseFloat(subtotalEl.textContent.replace('R$', '').replace('.', '').replace(',', '.')) + currentShipping, couponDiscount: 0 });
          updateCouponDisplay(currentCouponDiscount); // Update display after removing
        } else {
          couponMessageEl.innerHTML = `<div class="alert alert-danger">${data.message}</div>`;
        }
      } catch (error) {
        console.error('Erro ao remover cupom:', error);
        couponMessageEl.innerHTML = '<div class="alert alert-danger">Erro ao conectar com o servidor para remover o cupom.</div>';
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
    grandTotalEl.textContent = formatPrice(subtotal + shippingTotal - currentCouponDiscount);
  }

  function updateTotals(totals) {
    if (totals) {
      subtotal = totals.subtotal;
      subtotalEl.textContent = formatPrice(totals.subtotal);
      shippingEl.textContent = formatPrice(totals.shipping);
      grandTotalEl.textContent = formatPrice(totals.grand);
      // The coupon display logic is now handled by updateCouponDisplay
      updateCouponDisplay(totals.couponDiscount);
    }
  }

  function formatPrice(value) {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  }
});
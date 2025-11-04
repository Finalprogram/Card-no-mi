const salesChartData = JSON.parse(`<%- salesChartData %>`);
  let salesChart;

  const renderChart = (data) => {
    const ctx = document.getElementById('salesChart').getContext('2d');
    const labels = data.map(d => d.date);
    const sales = data.map(d => d.totalSales);

    if (salesChart) {
      salesChart.destroy();
    }

    salesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total de Vendas',
          data: sales,
          borderColor: '#a078f7',
          backgroundColor: 'rgba(160, 120, 247, 0.2)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: false },
          tooltip: {
            callbacks: {
              title: function(context) {
                const date = new Date(context[0].label);
                return `🗓 ${date.toLocaleDateString('pt-BR')}`;
              },
              label: function(context) {
                const sales = context.parsed.y;
                return `💰 ${sales.toFixed(2)} Vendas`; // Displaying sales value for now
              }
            }
          }
        },
        scales: {
          x: { beginAtZero: true },
          y: { beginAtZero: true }
        }
      }
    });
  };

  // Initial render
  renderChart(salesChartData);

  document.querySelectorAll('.chart-filter-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      document.querySelectorAll('.chart-filter-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      const period = event.target.dataset.period;

      // Fetch new data for the selected period
      const response = await fetch(`/seller/sales-data?period=${period}`);
      const newData = await response.json();
      renderChart(newData);
    });
  });
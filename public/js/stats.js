document.addEventListener('DOMContentLoaded', () => {
    const costChartCtx = document.getElementById('costChart')?.getContext('2d');
    const colorChartCtx = document.getElementById('colorChart')?.getContext('2d');

    if (!costChartCtx || !colorChartCtx || typeof deckStats === 'undefined') {
        return;
    }

    // Helper to get CSS variables
    const getCssVar = (varName) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim();

    // Chart.js Global Defaults
    Chart.defaults.font.family = 'Inter, sans-serif';
    Chart.defaults.color = getCssVar('--text-secondary');
    Chart.defaults.borderColor = getCssVar('--border');

    // 1. Cost Distribution Chart (Bar)
    new Chart(costChartCtx, {
        type: 'bar',
        data: {
            labels: deckStats.costDistribution.map((_, i) => `Custo ${i}`),
            datasets: [{
                label: 'Quantidade de Cartas',
                data: deckStats.costDistribution,
                backgroundColor: getCssVar('--accent-primary'),
                borderColor: getCssVar('--accent-hover'),
                borderWidth: 2,
                borderRadius: 5,
                hoverBackgroundColor: getCssVar('--accent-hover'),
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: getCssVar('--bg-surface'),
                    titleColor: getCssVar('--text-primary'),
                    bodyColor: getCssVar('--text-secondary'),
                    borderColor: getCssVar('--border'),
                    borderWidth: 1,
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: getCssVar('--border'),
                    },
                    ticks: {
                        color: getCssVar('--text-secondary'),
                    }
                },
                x: {
                    grid: {
                        display: false,
                    },
                    ticks: {
                        color: getCssVar('--text-secondary'),
                    }
                }
            }
        }
    });

    // 2. Color Distribution Chart (Doughnut)
    const colorData = deckStats.colorCounts.split(', ').map(item => {
        const [color, count] = item.split(': ');
        return { color, count: parseInt(count, 10) };
    });

    const colorLabels = colorData.map(d => d.color);
    const colorCounts = colorData.map(d => d.count);
    
    // Map your color names to the CSS variables
    const colorMap = {
        'Red': getCssVar('--accent-red'),
        'Green': getCssVar('--accent-green'),
        'Blue': getCssVar('--accent-blue'),
        'Purple': getCssVar('--accent-purple'),
        'Yellow': getCssVar('--accent-gold'),
        'Black': '#333333',
        // Add other colors from your game if necessary
    };
    const backgroundColors = colorLabels.map(label => colorMap[label] || '#888888');

    new Chart(colorChartCtx, {
        type: 'doughnut',
        data: {
            labels: colorLabels,
            datasets: [{
                data: colorCounts,
                backgroundColor: backgroundColors,
                borderColor: getCssVar('--bg-surface'),
                borderWidth: 3,
                hoverOffset: 10,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: getCssVar('--text-secondary'),
                        padding: 15,
                    }
                },
                tooltip: {
                    backgroundColor: getCssVar('--bg-surface'),
                    titleColor: getCssVar('--text-primary'),
                    bodyColor: getCssVar('--text-secondary'),
                    borderColor: getCssVar('--border'),
                    borderWidth: 1,
                }
            }
        }
    });
});
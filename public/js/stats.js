document.addEventListener('DOMContentLoaded', () => {
    const bars = document.querySelectorAll('.chart-bar');

    // Animate bars on load
    setTimeout(() => {
        bars.forEach(bar => {
            const height = bar.getAttribute('data-height');
            bar.style.setProperty('--bar-height', height);
        });
    }, 100); // Small delay to ensure CSS is loaded

    // Tooltip logic can be enhanced here if needed,
    // for example, to dynamically position them if they go off-screen.
    // The current implementation uses pure CSS for hover tooltips.
});

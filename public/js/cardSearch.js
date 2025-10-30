document.addEventListener('DOMContentLoaded', () => {
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      window.location.href = '/cards'; // Redirect to clear all filters
    });
  }
});
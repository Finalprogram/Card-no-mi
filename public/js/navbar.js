
document.addEventListener('DOMContentLoaded', function () {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        // Ensure the menu is closed by default
        navLinks.classList.remove('active');

        hamburger.addEventListener('click', function () {
            navLinks.classList.toggle('active');
        });
    }
});

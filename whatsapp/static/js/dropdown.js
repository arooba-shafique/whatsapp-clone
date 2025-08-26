// dropdowns.js
document.addEventListener("DOMContentLoaded", () => {
  const toggleDisplay = (element) => {
    element.style.display = element.style.display === 'block' ? 'none' : 'block';
  };

  const statusIcon = document.getElementById('statusIcon');
  const statusMenu = document.getElementById('statusMenu');
  statusIcon?.addEventListener('click', e => {
    e.stopPropagation();
    toggleDisplay(statusMenu);
  });

  const settingsIcon = document.getElementById('settingsIcon');
  const settingsMenu = document.getElementById('settingsMenu');
  settingsIcon?.addEventListener('click', e => {
    e.stopPropagation();
    toggleDisplay(settingsMenu);
  });

  const menuIcon = document.getElementById('menuIcon');
  const menuDropdown = document.querySelector('.menuDropdown');
  menuIcon?.addEventListener('click', e => {
    e.stopPropagation();
    toggleDisplay(menuDropdown);
  });

  document.addEventListener('click', e => {
    if (statusIcon && !statusIcon.contains(e.target) && !statusMenu.contains(e.target)) statusMenu.style.display = 'none';
    if (settingsIcon && !settingsIcon.contains(e.target) && !settingsMenu.contains(e.target)) settingsMenu.style.display = 'none';
    if (menuIcon && !menuIcon.contains(e.target) && !menuDropdown.contains(e.target)) menuDropdown.style.display = 'none';
  });
});

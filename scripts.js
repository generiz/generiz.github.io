// scripts.js

document.addEventListener("DOMContentLoaded", () => {
  // Aplicar clase especial a los encabezados
  document.querySelectorAll("h2").forEach(h2 => {
    h2.style.color = "#0066cc";
    h2.style.textTransform = "uppercase";
    h2.style.letterSpacing = "1px";
  });

  // Resaltar tarjetas al pasar el mouse
  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("mouseover", () => {
      card.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.2)";
      card.style.transform = "scale(1.02)";
      card.style.transition = "all 0.3s ease";
    });
    card.addEventListener("mouseout", () => {
      card.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
      card.style.transform = "scale(1)";
    });
  });
});

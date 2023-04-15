function showEasterEggHint() {
  const hint = document.getElementById("easter-egg-hint");
  hint.style.display = "block";
}

function isMobileDevice() {
  return window.innerWidth <= 767;
}

document.addEventListener("DOMContentLoaded", function() {
  if (!isMobileDevice()) {
    setTimeout(showEasterEggHint, 10000);
  }
  document.getElementById("close-hint-btn").addEventListener("click", function() {
    document.getElementById("easter-egg-hint").style.display = "none";
  });
});

function showEasterEggHint() {
    const hint = document.getElementById("easter-egg-hint");
    hint.style.display = "block";
}


document.addEventListener("DOMContentLoaded", function() {
    setTimeout(showEasterEggHint, 10000);
    document.getElementById("close-hint-btn").addEventListener("click", function () {
      document.getElementById("easter-egg-hint").style.display = "none";
    });
  });
  
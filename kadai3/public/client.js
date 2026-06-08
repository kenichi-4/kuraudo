const rollForms = document.querySelectorAll(".rollForm");

for (const form of rollForms) {
  form.addEventListener("submit", (event) => {
    const button = form.querySelector("input[type='submit']");

    if (button && button.disabled) {
      return;
    }

    event.preventDefault();

    const target = form.dataset.target;
    const card = document.querySelector("[data-player='" + target + "']");
    const dice = card ? card.querySelector(".dice") : null;

    if (!dice) {
      form.submit();
      return;
    }

    if (button) {
      button.disabled = true;
      button.value = "サイコロを振っています...";
    }

    card.classList.add("rolling");

    const timer = setInterval(() => {
      dice.textContent = randomDice() + " " + randomDice() + " " + randomDice();
    }, 90);

    setTimeout(() => {
      clearInterval(timer);
      form.submit();
    }, 900);
  });
}

function randomDice() {
  return Math.floor(Math.random() * 6) + 1;
}

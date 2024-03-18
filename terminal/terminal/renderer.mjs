const command = document.querySelector('#command');
const stdout = document.querySelector('#stdout');

console.log(command);

command.addEventListener('submit', async (event) => {
  event.preventDefault();
  window.electronAPI.execute(command?.querySelector('input').value);
});

window.electronAPI.onExecute((value) => {
  stdout.textContent = value;
});

const scrollSpeed = 2;
let downInterval;
let upInterval;

document.addEventListener('wheel', (event) => {
  console.log(event.deltaY);
  if (event.deltaY > 0) {
    Effect.runPromise(
      Effect.repeat(
        () => {
          window.scrollBy({ top: 1 });
        },
        Schedule.addDelay(Schedule.recurs(Math.round(event.deltaY)), () => '100 ms'),
      ),
    );
  } else if (event.deltaY < 0) {
    const times = Math.abs(scrollSpeed * Math.round(event.deltaY));
    let upRan = 0;
    upInterval = setInterval(() => {
      clearInterval(downInterval);
      upRan++;
      console.log(upRan, window.scrollY);
      if (upRan >= times) {
        clearInterval(upInterval);
      }
      window.scrollBy({
        top: -(times - upRan) / times,
        left: 0,
        behavior: 'smooth',
      });
    }, 10 / scrollSpeed);
  }
});

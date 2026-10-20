import './notice.css';

let timer: ReturnType<typeof setTimeout> | undefined;

/** A short line at the foot of the page that says what happened, then goes. */
export function say(text: string) {
  document.querySelector('.notice-pill')?.remove();
  const pill = document.createElement('p');
  pill.className = 'notice-pill';
  pill.setAttribute('role', 'status');
  pill.textContent = text;
  document.body.append(pill);
  clearTimeout(timer);
  timer = setTimeout(() => {
    pill.classList.add('gone');
    setTimeout(() => pill.remove(), 250);
  }, 6000);
}

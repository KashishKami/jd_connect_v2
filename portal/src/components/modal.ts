export interface ModalOptions {
  title: string;
  content: HTMLElement;
  onClose?: () => void;
}

export function createModal(options: ModalOptions): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-content';

  const header = document.createElement('div');
  header.className = 'modal-header';

  const title = document.createElement('h3');
  title.className = 'modal-title';
  title.textContent = options.title;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => {
    overlay.remove();
    if (options.onClose) options.onClose();
  };

  header.appendChild(title);
  header.appendChild(closeBtn);

  modal.appendChild(header);
  modal.appendChild(options.content);
  overlay.appendChild(modal);

  document.body.appendChild(overlay);

  return overlay;
}

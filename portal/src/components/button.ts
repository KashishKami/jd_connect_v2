export interface ButtonOptions {
  text: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: (e: MouseEvent) => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export function renderButton(options: ButtonOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = options.type || 'button';
  btn.textContent = options.text;
  btn.className = `btn btn-${options.variant || 'primary'}`;
  btn.disabled = !!options.disabled;

  if (options.onClick) {
    btn.addEventListener('click', options.onClick);
  }

  return btn;
}

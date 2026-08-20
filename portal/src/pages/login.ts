import { login } from '../lib/auth';
import { showToast } from '../components/toast';
import { navigate } from '../lib/router';

export function renderLoginPage(container: HTMLElement): void {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.justifyContent = 'center';
  wrapper.style.alignItems = 'center';
  wrapper.style.minHeight = '80vh';

  const card = document.createElement('div');
  card.className = 'modal-content';
  card.style.maxWidth = '400px';

  const title = document.createElement('h2');
  title.textContent = 'JD Connect Login';
  title.style.marginBottom = '1.5rem';
  title.style.textAlign = 'center';
  title.style.color = 'var(--primary)';

  const form = document.createElement('form');

  const emailGroup = document.createElement('div');
  emailGroup.style.marginBottom = '1rem';
  const emailLabel = document.createElement('label');
  emailLabel.textContent = 'Email Address';
  emailLabel.style.display = 'block';
  emailLabel.style.marginBottom = '0.5rem';
  emailLabel.style.fontSize = '0.9rem';
  emailLabel.style.color = 'var(--text-muted)';
  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.id = 'loginEmail';
  emailInput.required = true;
  emailInput.style.width = '100%';
  emailInput.style.padding = '0.6rem';
  emailInput.style.borderRadius = 'var(--radius)';
  emailInput.style.border = '1px solid var(--border-color)';
  emailInput.style.backgroundColor = 'var(--bg-dark)';
  emailInput.style.color = 'var(--text-main)';
  emailGroup.appendChild(emailLabel);
  emailGroup.appendChild(emailInput);

  const passGroup = document.createElement('div');
  passGroup.style.marginBottom = '1.5rem';
  const passLabel = document.createElement('label');
  passLabel.textContent = 'Password';
  passLabel.style.display = 'block';
  passLabel.style.marginBottom = '0.5rem';
  passLabel.style.fontSize = '0.9rem';
  passLabel.style.color = 'var(--text-muted)';
  const passInput = document.createElement('input');
  passInput.type = 'password';
  passInput.id = 'loginPassword';
  passInput.required = true;
  passInput.style.width = '100%';
  passInput.style.padding = '0.6rem';
  passInput.style.borderRadius = 'var(--radius)';
  passInput.style.border = '1px solid var(--border-color)';
  passInput.style.backgroundColor = 'var(--bg-dark)';
  passInput.style.color = 'var(--text-main)';
  passGroup.appendChild(passLabel);
  passGroup.appendChild(passInput);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.id = 'loginSubmitBtn';
  submitBtn.className = 'btn btn-primary';
  submitBtn.style.width = '100%';
  submitBtn.textContent = 'Sign In';

  form.appendChild(emailGroup);
  form.appendChild(passGroup);
  form.appendChild(submitBtn);

  form.onsubmit = async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      await login(emailInput.value.trim(), passInput.value);
      showToast('Login successful', 'success');
      navigate('/');
    } catch (err) {
      showToast((err as Error).message || 'Invalid credentials', 'danger');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  };

  card.appendChild(title);
  card.appendChild(form);
  wrapper.appendChild(card);
  container.appendChild(wrapper);
}

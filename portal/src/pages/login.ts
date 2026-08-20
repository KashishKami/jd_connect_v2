import { login } from '../lib/auth';
import { showToast } from '../components/toast';
import { navigate } from '../lib/router';

export function renderLoginPage(container: HTMLElement): void {
  container.innerHTML = `
    <div class="login-wrapper">
      <div class="login-card">
        <h2 class="login-title">JD Connect</h2>
        <p class="login-subtitle">BPO Operations & HR Management Platform</p>

        <form id="loginForm">
          <div class="form-group">
            <label for="loginEmail">Email Address</label>
            <input type="email" id="loginEmail" class="form-input" placeholder="admin@company.com" required autocomplete="email" />
          </div>

          <div class="form-group">
            <label for="loginPassword">Password</label>
            <input type="password" id="loginPassword" class="form-input" placeholder="••••••••••••" required autocomplete="current-password" />
          </div>

          <button type="submit" id="loginSubmitBtn" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">Sign In</button>
        </form>
      </div>
    </div>
  `;

  const form = container.querySelector('#loginForm') as HTMLFormElement;
  const emailInput = container.querySelector('#loginEmail') as HTMLInputElement;
  const passInput = container.querySelector('#loginPassword') as HTMLInputElement;
  const submitBtn = container.querySelector('#loginSubmitBtn') as HTMLButtonElement;

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
}

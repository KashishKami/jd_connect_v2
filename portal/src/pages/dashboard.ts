import { guardRoute } from '../lib/auth';
import { apiFetch } from '../lib/api';
import { navigate } from '../lib/router';
import { renderAttendanceConsole } from './attendance';

interface TodaySummary {
  present: number;
  on_break: number;
  absent: number;
  late: number;
  half_day: number;
  total_employees: number;
}

export function renderDashboardPage(container: HTMLElement): void {
  if (!guardRoute('portal.attendance_audit', container)) {
    return;
  }

  container.innerHTML = `
    <div class="main-content">
      <div class="section-header">
        <h2>Dashboard Metrics</h2>
      </div>

      <!-- 5 Metric Cards -->
      <div class="metrics-grid" id="dashboardMetrics">
        <div class="metric-card clickable-card" id="cardPresent">
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Present Today</div>
          <div id="metricPresent" style="font-size: 2rem; font-weight: 700; color: var(--accent-green);">--</div>
        </div>
        <div class="metric-card clickable-card" id="cardOnBreak">
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">On Break</div>
          <div id="metricOnBreak" style="font-size: 2rem; font-weight: 700; color: var(--accent-amber);">--</div>
        </div>
        <div class="metric-card clickable-card" id="cardAbsent">
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Absent Today</div>
          <div id="metricAbsent" style="font-size: 2rem; font-weight: 700; color: var(--accent-red);">--</div>
        </div>
        <div class="metric-card clickable-card" id="cardLate">
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Late Today</div>
          <div id="metricLate" style="font-size: 2rem; font-weight: 700; color: var(--accent-purple);">--</div>
        </div>
        <div class="metric-card clickable-card" id="cardHalfDay">
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Half Day</div>
          <div id="metricHalfDay" style="font-size: 2rem; font-weight: 700; color: var(--accent-indigo);">--</div>
        </div>
      </div>

      <!-- Your Shift Today embedded console -->
      <div id="yourShiftToday" style="margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
        <h2 style="font-size: 1.2rem; font-weight: 600; color: var(--text-muted); margin-bottom: 1rem;">Your Shift Today</h2>
        <div id="embeddedConsoleContainer"></div>
      </div>
    </div>
  `;

  const embeddedContainer = container.querySelector('#embeddedConsoleContainer') as HTMLElement;
  if (embeddedContainer) {
    renderAttendanceConsole(embeddedContainer);
  }

  loadMetrics(container);
}

async function loadMetrics(container: HTMLElement): Promise<void> {
  try {
    const summary = await apiFetch<TodaySummary>('/attendance/summary/today');

    const presentEl = container.querySelector('#metricPresent');
    const breakEl = container.querySelector('#metricOnBreak');
    const absentEl = container.querySelector('#metricAbsent');
    const lateEl = container.querySelector('#metricLate');
    const halfDayEl = container.querySelector('#metricHalfDay');

    if (presentEl) presentEl.textContent = String(summary.present ?? 0);
    if (breakEl) breakEl.textContent = String(summary.on_break ?? 0);
    if (absentEl) absentEl.textContent = String(summary.absent ?? 0);
    if (lateEl) lateEl.textContent = String(summary.late ?? 0);
    if (halfDayEl) halfDayEl.textContent = String(summary.half_day ?? 0);

    container.querySelector('#cardPresent')?.addEventListener('click', () => navigate('/attendance-audit'));
    container.querySelector('#cardOnBreak')?.addEventListener('click', () => navigate('/breaks-audit'));
    container.querySelector('#cardAbsent')?.addEventListener('click', () => navigate('/attendance-audit'));
    container.querySelector('#cardLate')?.addEventListener('click', () => navigate('/attendance-audit'));
    container.querySelector('#cardHalfDay')?.addEventListener('click', () => navigate('/attendance-audit'));
  } catch {
    // ignore
  }
}

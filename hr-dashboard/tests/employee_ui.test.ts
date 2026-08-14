import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retryZulipProvisioning } from '../src/components/employee_table';

describe('Employee UI & Zulip Retry Handler Tests (W-602 Integration)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers retry Zulip provisioning API call and returns updated employee object', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      id: 'emp-2',
      full_name: 'Bob Jones',
      zulip_provisioned: true,
      zulip_user_id: 45,
    });

    const mockApi = { post: mockPost };
    const updated = await retryZulipProvisioning(mockApi, 'emp-2');

    expect(mockPost).toHaveBeenCalledWith('/api/employees/emp-2/retry-zulip-provisioning');
    expect(updated.zulip_provisioned).toBe(true);
    expect(updated.zulip_user_id).toBe(45);
  });
});

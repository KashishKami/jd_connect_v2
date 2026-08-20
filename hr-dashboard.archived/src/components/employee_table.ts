export interface EmployeeItem {
  id: string;
  full_name: string;
  email: string;
  department?: string;
  zulip_provisioned: boolean;
  zulip_user_id?: number | null;
}

export interface EmployeeFilterOptions {
  department?: string;
  zulip_provisioned?: boolean;
}

export function filterEmployees(employees: EmployeeItem[], options: EmployeeFilterOptions): EmployeeItem[] {
  return employees.filter((emp) => {
    if (options.department && emp.department !== options.department) {
      return false;
    }
    if (typeof options.zulip_provisioned === 'boolean' && emp.zulip_provisioned !== options.zulip_provisioned) {
      return false;
    }
    return true;
  });
}

export async function retryZulipProvisioning(
  apiClient: { post: (endpoint: string) => Promise<EmployeeItem> },
  employeeId: string
): Promise<EmployeeItem> {
  return await apiClient.post(`/api/employees/${employeeId}/retry-zulip-provisioning`);
}

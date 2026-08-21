export function parseTokenFromLocation(locationUrl: string): string | null {
  try {
    const url = new URL(locationUrl);
    return url.searchParams.get('token');
  } catch {
    return null;
  }
}

export function getRedirectToSsoUrl(backendUrl: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: 'zulip',
    response_type: 'code',
    redirect_uri: redirectUri,
  });
  return `${backendUrl}/oauth/authorize?${params.toString()}`;
}

export function requiresDashboardDocument(entryUrl: string, currentUrl: string): boolean {
	const current = new URL(currentUrl);
	const entry = new URL(entryUrl);
	const isDashboard = (pathname: string) => pathname === '/dashboard' || pathname.startsWith('/dashboard/');
	return isDashboard(current.pathname) && !isDashboard(entry.pathname);
}
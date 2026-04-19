import { useState, useCallback } from 'react';
import { mockService } from '../services/mockService';

// Demo mode - use mock service instead of real API
const DEMO_MODE = true;

const useApi = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const request = useCallback(async (method: string, url: string, data: any = null) => {
        setLoading(true);
        setError(null);
        try {
            // In demo mode, route to mock service
            if (DEMO_MODE) {
                const result = await routeToMockService(method, url, data);
                return result;
            }

            // Real API mode (disabled in demo)
            throw new Error('Backend no disponible en modo demo');
        } catch (err: any) {
            const msg = err?.message || 'Error de conexión';
            setError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const get = useCallback((url: string) => request('GET', url), [request]);
    const post = useCallback((url: string, data?: any) => request('POST', url, data), [request]);
    const put = useCallback((url: string, data?: any) => request('PUT', url, data), [request]);
    const patch = useCallback((url: string, data?: any) => request('PATCH', url, data), [request]);
    const del = useCallback((url: string) => request('DELETE', url), [request]);

    return { get, post, put, patch, del, loading, error, request };
};

// Route API calls to mock service
async function routeToMockService(method: string, url: string, data: any) {
    const path = (url || '').split('?')[0]; // Remove query params
    const id = extractId(url);

    // Workers
    if (path === '/workers' && method === 'GET') return mockService.getWorkers();
    if (path.startsWith('/workers/') && method === 'GET') return mockService.getWorker(id!);
    if (path === '/workers' && method === 'POST') return mockService.createWorker(data);
    if (path.startsWith('/workers/') && method === 'PUT') return mockService.updateWorker(id!, data);
    if (path.startsWith('/workers/') && method === 'PATCH') return mockService.updateWorker(id!, data);
    if (path.startsWith('/workers/') && method === 'DELETE') return mockService.deleteWorker(id!);

    // Clients
    if (path === '/clients' && method === 'GET') return mockService.getClients();
    if (path.startsWith('/clients/') && method === 'GET') return mockService.getClient(id!);
    if (path === '/clients' && method === 'POST') return mockService.createClient(data);
    if (path.startsWith('/clients/') && method === 'PUT') return mockService.updateClient(id!, data);
    if (path.startsWith('/clients/') && method === 'PATCH') return mockService.updateClient(id!, data);
    if (path.startsWith('/clients/') && method === 'DELETE') return mockService.deleteClient(id!);

    // Projects
    if (path === '/projects' && method === 'GET') return mockService.getProjects();
    if (path.startsWith('/projects/') && method === 'GET') return mockService.getProject(id!);
    if (path === '/projects' && method === 'POST') return mockService.createProject(data);
    if (path.startsWith('/projects/') && method === 'PUT') return mockService.updateProject(id!, data);
    if (path.startsWith('/projects/') && method === 'PATCH') return mockService.updateProject(id!, data);
    if (path.startsWith('/projects/') && method === 'DELETE') return mockService.deleteProject(id!);

    // Assignments
    if (path === '/assignments' && method === 'GET') {
        const urlObj = new URL(url, 'http://dummy.com');
        return mockService.getAssignments(urlObj.searchParams.get('status') || undefined);
    }
    if (path === '/assignments' && method === 'POST') return mockService.createAssignment(data);
    if (path.startsWith('/assignments/') && method === 'PUT') return mockService.updateAssignment(id!, data);
    if (path.startsWith('/assignments/') && method === 'PATCH') return mockService.updateAssignment(id!, data);

    // Time Entries
    if (path === '/time-entries/bulk-status' && method === 'PATCH') return mockService.updateTimeEntriesBulkStatus(data);
    if (path === '/time-entries' && method === 'GET') return mockService.getTimeEntries();
    if (path.startsWith('/time-entries/') && method === 'GET') return mockService.getTimeEntry(id!);
    if (path === '/time-entries' && method === 'POST') return mockService.createTimeEntry(data);
    if (path.startsWith('/time-entries/') && method === 'PUT') return mockService.updateTimeEntry(id!, data);
    if (path.startsWith('/time-entries/') && method === 'PATCH') return mockService.updateTimeEntry(id!, data);
    if (path.startsWith('/time-entries/') && method === 'DELETE') return mockService.deleteTimeEntry(id!);

    // Invoices
    if (path === '/invoices' && method === 'GET') return mockService.getInvoices();
    if (path.startsWith('/invoices/') && method === 'GET') return mockService.getInvoice(id!);
    if (path === '/invoices' && method === 'POST') return mockService.createInvoice(data);
    if (path.startsWith('/invoices/') && method === 'PUT') return mockService.updateInvoice(id!, data);
    if (path.startsWith('/invoices/') && method === 'PATCH') return mockService.updateInvoice(id!, data);
    if (path.startsWith('/invoices/') && method === 'DELETE') return mockService.deleteInvoice(id!);

    // Payroll
    if (path === '/payroll/pending-weeks' && method === 'GET') return mockService.getPendingWeeks();
    if (path === '/payroll/stats' && method === 'GET') return mockService.getPayrollStats();
    if (path === '/payroll' && method === 'GET') return mockService.getPayroll();
    if (path.match(/^\/payroll\/\d+$/) && method === 'GET') return mockService.getPayrollById(id!);
    if (path.match(/^\/payroll\/lines\/\d+$/) && method === 'GET') return mockService.getPayrollLineById(id!);
    if (path === '/payroll/generate' && method === 'POST') return mockService.generatePayroll(data);
    if (path === '/payroll' && method === 'POST') return mockService.createPayroll(data);
    if (path.match(/^\/payroll\/\d+\/status$/) && method === 'PATCH') return mockService.updatePayrollStatus(id!, data);
    if (path.match(/^\/payroll\/lines\/\d+\/pay$/) && method === 'PATCH') return mockService.payPayrollLine(id!, data);
    if (path.match(/^\/payroll\/\d+$/) && method === 'PUT') return mockService.updatePayroll(id!, data);
    if (path.match(/^\/payroll\/\d+$/) && method === 'PATCH') return mockService.updatePayroll(id!, data);

    // Accounting
    if (path === '/accounting/transactions' && method === 'GET') return mockService.getTransactions();
    if (path === '/accounting/transactions' && method === 'POST') return mockService.createTransaction(data);
    if (path.match(/^\/accounting\/transactions\/\d+$/) && method === 'PUT') return mockService.updateTransaction(id!, data);
    if (path.match(/^\/accounting\/transactions\/\d+$/) && method === 'DELETE') return mockService.deleteTransaction(id!);
    
    if (path === '/accounting/pnl' && method === 'GET') {
        const period = new URL(url, 'http://dummy.com').searchParams.get('period');
        return mockService.getPnL(period || '');
    }
    if (path === '/accounting/margins/workers' && method === 'GET') {
        const urlObj = new URL(url, 'http://dummy.com');
        return mockService.getMarginsWorkers(urlObj.searchParams.get('from') || '', urlObj.searchParams.get('to') || '');
    }
    if (path === '/accounting/margins/clients' && method === 'GET') {
        const urlObj = new URL(url, 'http://dummy.com');
        return mockService.getMarginsClients(urlObj.searchParams.get('from') || '', urlObj.searchParams.get('to') || '');
    }
    if (path === '/accounting/cash-flow' && method === 'GET') {
        const year = new URL(url, 'http://dummy.com').searchParams.get('year');
        return mockService.getCashFlow(year || '');
    }
    if (path === '/accounting/categories' && method === 'GET') return mockService.getAccountingCategories();
    if (path === '/accounting/tax-summary' && method === 'GET') {
        const year = new URL(url, 'http://dummy.com').searchParams.get('year');
        return mockService.getTaxSummary(year || '');
    }
    if (path === '/accounting/1099-report' && method === 'GET') {
        const year = new URL(url, 'http://dummy.com').searchParams.get('year');
        return mockService.get1099Report(year || '');
    }

    // Dashboard
    if (path === '/dashboard/stats' && method === 'GET') return mockService.getDashboardStats();

    // Trades
    if (path === '/trades' && method === 'GET') return mockService.getTrades();

    // Worker Stats
    if (path.match(/^\/workers\/\d+\/stats$/) && method === 'GET') {
        const workerId = extractId(url);
        return mockService.getWorkerStats(workerId!);
    }

    // Settings
    if (path === '/settings' && method === 'GET') return mockService.getSettings();

    // Default response for unmapped endpoints
    console.warn(`Unmapped API call: ${method} ${url}`);
    return { data: [] };
}

function extractId(url: string): number | null {
    const match = url.match(/\/(\d+)(?:\/|$|\?)/);
    return match ? parseInt(match[1], 10) : null;
}

export default useApi;
// Mock Service - Simulates API calls with mock data
import {
    mockWorkers,
    mockClients,
    mockProjects,
    mockAssignments,
    mockTimeEntries,
    mockInvoices,
    mockPayroll,
    mockDashboardStats,
    mockAccountingTransactions,
    mockTrades,
    mockWorkerStats,
    mockPnL,
    mockMarginsWorkers,
    mockMarginsClients,
    mockCashFlow,
    mockAccountingCategories,
    mockSettings,
} from '../data/mockData';

// Simulate API delay
const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

export const mockService = {
    // Workers
    async getWorkers() {
        await delay();
        return { data: mockWorkers };
    },

    async getWorker(id: number) {
        await delay();
        const worker = mockWorkers.find(w => w.id === id);
        if (!worker) throw new Error('Worker not found');
        return { data: worker };
    },

    async createWorker(data: any) {
        await delay();
        const newWorker = {
            id: Math.max(...mockWorkers.map(w => w.id)) + 1,
            ...data,
            status: 'active',
        };
        mockWorkers.push(newWorker);
        return { data: newWorker };
    },

    async updateWorker(id: number, data: any) {
        await delay();
        const index = mockWorkers.findIndex(w => w.id === id);
        if (index === -1) throw new Error('Worker not found');
        mockWorkers[index] = { ...mockWorkers[index], ...data };
        return { data: mockWorkers[index] };
    },

    async deleteWorker(id: number) {
        await delay();
        const index = mockWorkers.findIndex(w => w.id === id);
        if (index === -1) throw new Error('Worker not found');
        mockWorkers.splice(index, 1);
        return { data: { success: true } };
    },

    // Clients
    async getClients() {
        await delay();
        const clientsWithProjects = mockClients.map(c => ({
            ...c,
            projects: mockProjects.filter(p => p.clientId === c.id)
        }));
        return { data: clientsWithProjects };
    },

    async getClient(id: number) {
        await delay();
        const client = mockClients.find(c => c.id === id);
        if (!client) throw new Error('Client not found');
        return { data: { ...client, projects: mockProjects.filter(p => p.clientId === id) } };
    },

    async createClient(data: any) {
        await delay();
        const newClient = {
            id: Math.max(...mockClients.map(c => c.id)) + 1,
            ...data,
            status: 'active',
            projects: 0,
            totalBilled: 0,
        };
        mockClients.push(newClient);
        return { data: newClient };
    },

    async updateClient(id: number, data: any) {
        await delay();
        const index = mockClients.findIndex(c => c.id === id);
        if (index === -1) throw new Error('Client not found');
        mockClients[index] = { ...mockClients[index], ...data };
        return { data: mockClients[index] };
    },

    async deleteClient(id: number) {
        await delay();
        const index = mockClients.findIndex(c => c.id === id);
        if (index === -1) throw new Error('Client not found');
        mockClients.splice(index, 1);
        return { data: { success: true } };
    },

    // Projects
    async getProjects() {
        await delay();
        return { data: mockProjects };
    },

    async getProject(id: number) {
        await delay();
        const project = mockProjects.find(p => p.id === id);
        if (!project) throw new Error('Project not found');
        return { data: project };
    },

    async createProject(data: any) {
        await delay();
        const newProject = {
            id: Math.max(...mockProjects.map(p => p.id)) + 1,
            ...data,
            status: 'active',
            spent: 0,
            workers: [],
        };
        mockProjects.push(newProject);
        return { data: newProject };
    },

    async updateProject(id: number, data: any) {
        await delay();
        const index = mockProjects.findIndex(p => p.id === id);
        if (index === -1) throw new Error('Project not found');
        mockProjects[index] = { ...mockProjects[index], ...data };
        return { data: mockProjects[index] };
    },

    async deleteProject(id: number) {
        await delay();
        const index = mockProjects.findIndex(p => p.id === id);
        if (index === -1) throw new Error('Project not found');
        mockProjects.splice(index, 1);
        return { data: { success: true } };
    },

    // Assignments
    async getAssignments(status?: string) {
        await delay();
        if (status) {
            return { data: mockAssignments.filter(a => a.status === status) };
        }
        return { data: mockAssignments };
    },

    async createAssignment(data: any) {
        await delay();
        const newAssignment = {
            id: Math.max(...mockAssignments.map(a => a.id)) + 1,
            ...data,
            status: data.status || 'active',
            start_date: data.start_date || new Date().toISOString().split('T')[0],
            end_date: null,
            project: mockProjects.find(p => p.id === data.project_id) || { id: data.project_id, name: 'Proyecto' },
            worker: mockWorkers.find(w => w.id === data.worker_id) || { id: data.worker_id, first_name: 'Worker', last_name: 'Name' }
        };
        mockAssignments.push(newAssignment);
        return { data: newAssignment };
    },

    async updateAssignment(id: number, data: any) {
        await delay();
        const index = mockAssignments.findIndex(a => a.id === id);
        if (index === -1) throw new Error('Assignment not found');
        mockAssignments[index] = { ...mockAssignments[index], ...data };
        return { data: mockAssignments[index] };
    },

    // Time Entries
    async getTimeEntries() {
        await delay();
        return { data: mockTimeEntries };
    },

    async getTimeEntry(id: number) {
        await delay();
        const entry = mockTimeEntries.find(t => t.id === id);
        if (!entry) throw new Error('Time entry not found');
        return { data: entry };
    },

    async createTimeEntry(data: any) {
        await delay();
        const newEntry = {
            id: Math.max(...mockTimeEntries.map(t => t.id)) + 1,
            ...data,
            status: 'pending',
        };
        mockTimeEntries.push(newEntry);
        return { data: newEntry };
    },

    async updateTimeEntry(id: number, data: any) {
        await delay();
        const index = mockTimeEntries.findIndex(t => t.id === id);
        if (index === -1) throw new Error('Time entry not found');
        mockTimeEntries[index] = { ...mockTimeEntries[index], ...data };
        return { data: mockTimeEntries[index] };
    },

    async updateTimeEntriesBulkStatus(data: { ids: number[], status: string }) {
        await delay();
        data.ids.forEach(id => {
            const index = mockTimeEntries.findIndex(t => t.id === id);
            if (index !== -1) {
                mockTimeEntries[index].status = data.status;
            }
        });
        return { data: { success: true } };
    },

    async deleteTimeEntry(id: number) {
        await delay();
        const index = mockTimeEntries.findIndex(t => t.id === id);
        if (index === -1) throw new Error('Time entry not found');
        mockTimeEntries.splice(index, 1);
        return { data: { success: true } };
    },

    // Invoices
    async getInvoices() {
        await delay();
        return { data: mockInvoices };
    },

    async getInvoice(id: number) {
        await delay();
        const invoice = mockInvoices.find(i => i.id === id);
        if (!invoice) throw new Error('Invoice not found');
        return { data: invoice };
    },

    async createInvoice(data: any) {
        await delay();
        const newInvoice = {
            id: Math.max(...mockInvoices.map(i => i.id)) + 1,
            invoiceNumber: `INV-2024-${String(mockInvoices.length + 1).padStart(3, '0')}`,
            ...data,
            status: 'pending',
        };
        mockInvoices.push(newInvoice);
        return { data: newInvoice };
    },

    async updateInvoice(id: number, data: any) {
        await delay();
        const index = mockInvoices.findIndex(i => i.id === id);
        if (index === -1) throw new Error('Invoice not found');
        mockInvoices[index] = { ...mockInvoices[index], ...data };
        return { data: mockInvoices[index] };
    },

    async deleteInvoice(id: number) {
        await delay();
        const index = mockInvoices.findIndex(i => i.id === id);
        if (index === -1) throw new Error('Invoice not found');
        mockInvoices.splice(index, 1);
        return { data: { success: true } };
    },

    // Payroll
    async getPayroll() {
        await delay();
        return { data: mockPayroll };
    },

    async getPendingWeeks() {
        await delay();
        return {
            data: [
                {
                    id: 101,
                    week_start_date: '2024-04-15',
                    week_end_date: '2024-04-21',
                    status: 'pending',
                    total_amount: 5400.00,
                    worker_count: 5,
                    payroll_id: 1 // Links to mockPayroll if generated
                },
                {
                    id: 102,
                    week_start_date: '2024-04-22',
                    week_end_date: '2024-04-28',
                    status: 'ungenerated',
                    total_amount: 0,
                    worker_count: 0,
                    payroll_id: null
                }
            ]
        };
    },

    async getPayrollStats() {
        await delay();
        return {
            data: {
                pending_amount: 15400.00,
                paid_this_week: 3200.00,
                paid_this_month: 12500.00,
                workers_pending: 12
            }
        };
    },

    async generatePayroll(data: any) {
        await delay();
        // Return a mocked generated week
        return { 
            data: {
                id: 102,
                week_start_date: data.week_start_date,
                week_end_date: data.week_end_date,
                status: 'pending',
                total_amount: 4200.00,
                worker_count: 3,
                payroll_id: 2
            } 
        };
    },

    async updatePayrollStatus(id: number, data: any) {
        await delay();
        return { data: { success: true, status: data.status } };
    },

    async payPayrollLine(id: number, data: any) {
        await delay();
        return { data: { success: true, status: 'paid' } };
    },

    async getPayrollLineById(id: number) {
        await delay();
        return {
            data: {
                id,
                worker: { first_name: 'Demo', last_name: 'Worker', worker_code: 'W-001', trade: { name_es: 'General' } },
                period: '2024-04-15 - 2024-04-21',
                regular_hours: 40,
                overtime_hours: 5,
                hourly_rate: 20,
                overtime_rate: 30,
                regular_pay: 800,
                overtime_pay: 150,
                per_diem_amount: 50,
                total_amount: 1000,
                status: 'pending',
                notes: 'Mock demo data',
            }
        };
    },

    async getPayrollById(id: number) {
        await delay();
        const payroll = mockPayroll.find(p => p.id === id);
        
        // Ensure structure matches the Payroll view expectations
        const fallbackLines = [
            { 
                id: 1, 
                worker: { first_name: 'Demo', last_name: 'Worker', trade: { name_es: 'General' } },
                regular_hours: 40,
                overtime_hours: 5,
                hourly_rate: 20,
                overtime_rate: 30,
                per_diem_amount: 50,
                total_amount: 1000,
                status: 'pending'
            }
        ];
        
        const returnPayroll = payroll ? { ...payroll, lines: (payroll as any).lines || fallbackLines } : { id, lines: fallbackLines, status: 'pending' };
        
        return { data: returnPayroll };
    },

    async createPayroll(data: any) {
        await delay();
        const newPayroll = {
            id: Math.max(...mockPayroll.map(p => p.id)) + 1,
            ...data,
            status: 'pending',
        };
        mockPayroll.push(newPayroll);
        return { data: newPayroll };
    },

    async updatePayroll(id: number, data: any) {
        await delay();
        const index = mockPayroll.findIndex(p => p.id === id);
        if (index === -1) throw new Error('Payroll not found');
        mockPayroll[index] = { ...mockPayroll[index], ...data };
        return { data: mockPayroll[index] };
    },

    // Accounting
    async getTransactions() {
        await delay();
        return { data: mockAccountingTransactions };
    },

    async createTransaction(data: any) {
        await delay();
        const newTransaction = {
            id: Math.max(...mockAccountingTransactions.map(t => t.id)) + 1,
            date: new Date().toISOString().split('T')[0],
            ...data,
        };
        mockAccountingTransactions.push(newTransaction);
        return { data: newTransaction };
    },

    async updateTransaction(id: number, data: any) {
        await delay();
        const index = mockAccountingTransactions.findIndex(t => t.id === id);
        if (index === -1) throw new Error('Transaction not found');
        mockAccountingTransactions[index] = { ...mockAccountingTransactions[index], ...data };
        return { data: mockAccountingTransactions[index] };
    },

    async deleteTransaction(id: number) {
        await delay();
        const index = mockAccountingTransactions.findIndex(t => t.id === id);
        if (index !== -1) mockAccountingTransactions.splice(index, 1);
        return { data: { success: true } };
    },

    async getTaxSummary(year: string) {
        await delay();
        return { data: { 
            taxable_income: 120000, 
            deductible_expenses: 45000, 
            net_profit: 75000, 
            estimated_tax: 15000 
        } };
    },

    async get1099Report(year: string) {
        await delay();
        return { data: [
            { worker: { first_name: 'John', last_name: 'Doe' }, total_paid: 15000 },
            { worker: { first_name: 'Jane', last_name: 'Smith' }, total_paid: 20000 }
        ] };
    },

    async getPnL(period: string) {
        await delay();
        return { data: { ...mockPnL, period: period || mockPnL.period } };
    },

    async getMarginsWorkers(from: string, to: string) {
        await delay();
        return { data: mockMarginsWorkers };
    },

    async getMarginsClients(from: string, to: string) {
        await delay();
        return { data: mockMarginsClients };
    },

    async getCashFlow(year: string) {
        await delay();
        return { data: mockCashFlow };
    },

    async getAccountingCategories() {
        await delay();
        return { data: mockAccountingCategories };
    },

    // Settings
    async getSettings() {
        await delay();
        return { data: mockSettings };
    },

    // Dashboard Stats
    async getDashboardStats() {
        await delay();
        return { data: mockDashboardStats };
    },

    // Trades
    async getTrades() {
        await delay();
        return { data: mockTrades };
    },

    // Worker Stats
    async getWorkerStats(workerId: number) {
        await delay();
        const stats = mockWorkerStats.find(s => s.worker_id === workerId);
        return { data: stats || { worker_id: workerId, total_hours_this_month: 0, total_earned_this_month: 0, avg_hours_per_week: 0 } };
    },
};
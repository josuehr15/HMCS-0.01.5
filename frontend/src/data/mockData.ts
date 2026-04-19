// Mock data for HMCS Demo Mode

export const mockTrades = [
  { id: 1, name: 'Electricista', name_es: 'Electricista', name_en: 'Electrician' },
  { id: 2, name: 'Plomero', name_es: 'Plomero', name_en: 'Plumber' },
  { id: 3, name: 'Carpintero', name_es: 'Carpintero', name_en: 'Carpenter' },
  { id: 4, name: 'Pintor', name_es: 'Pintor', name_en: 'Painter' },
  { id: 5, name: 'HVAC', name_es: 'HVAC', name_en: 'HVAC Technician' },
  { id: 6, name: 'General', name_es: 'General', name_en: 'General Labor' },
];

export const mockUsers = {
  admin: {
    id: 1,
    email: 'admin@hmcs.com',
    password: 'admin123',
    role: 'admin',
    name: 'Juan Pérez',
    position: 'Administrador',
  },
  contractor: {
    id: 2,
    email: 'worker@hmcs.com',
    password: 'worker123',
    role: 'contractor',
    name: 'María González',
    position: 'Contratista',
  },
};

export const mockWorkers = [
  {
    id: 1,
    first_name: 'Carlos',
    last_name: 'Rodríguez',
    name: 'Carlos Rodríguez',
    email: 'carlos@example.com',
    phone: '555-0101',
    trade_id: 1,
    trade: { id: 1, name: 'Electricista', name_es: 'Electricista' },
    status: 'active',
    availability: 'available',
    hourly_rate: 45.00,
    address: 'Calle Principal 123',
    ssn: '***-**-1234',
    emergency_contact_name: 'Ana Rodríguez',
    emergency_contact_phone: '555-0102',
    hire_date: '2024-01-15',
    certifications: ['Electricista Certificado', 'OSHA 30'],
    worker_code: 'WRK-001',
  },
  {
    id: 2,
    first_name: 'María',
    last_name: 'González',
    name: 'María González',
    email: 'maria@example.com',
    phone: '555-0201',
    trade_id: 2,
    trade: { id: 2, name: 'Plomero', name_es: 'Plomero' },
    status: 'active',
    availability: 'assigned',
    hourly_rate: 42.00,
    address: 'Avenida Central 456',
    ssn: '***-**-5678',
    emergency_contact_name: 'Pedro González',
    emergency_contact_phone: '555-0202',
    hire_date: '2024-02-01',
    certifications: ['Plomero Certificado'],
    worker_code: 'WRK-002',
  },
  {
    id: 3,
    first_name: 'José',
    last_name: 'Martínez',
    name: 'José Martínez',
    email: 'jose@example.com',
    phone: '555-0301',
    trade_id: 3,
    trade: { id: 3, name: 'Carpintero', name_es: 'Carpintero' },
    status: 'active',
    availability: 'assigned',
    hourly_rate: 40.00,
    address: 'Boulevard Norte 789',
    ssn: '***-**-9012',
    emergency_contact_name: 'Laura Martínez',
    emergency_contact_phone: '555-0302',
    hire_date: '2023-11-10',
    certifications: ['Carpintero Certificado', 'Seguridad en Construcción'],
    worker_code: 'WRK-003',
  },
  {
    id: 4,
    first_name: 'Ana',
    last_name: 'López',
    name: 'Ana López',
    email: 'ana@example.com',
    phone: '555-0401',
    trade_id: 4,
    trade: { id: 4, name: 'Pintor', name_es: 'Pintor' },
    status: 'inactive',
    availability: 'unavailable',
    hourly_rate: 35.00,
    address: 'Calle Sur 321',
    ssn: '***-**-3456',
    emergency_contact_name: 'Roberto López',
    emergency_contact_phone: '555-0402',
    hire_date: '2023-08-20',
    certifications: ['Pintor Profesional'],
    worker_code: 'WRK-004',
  },
];

export const mockClients = [
  {
    id: 1,
    name: 'ABC Construction Corp',
    contactName: 'Roberto Silva',
    email: 'roberto@abcconstruction.com',
    phone: '555-1001',
    address: 'Av. Industrial 1000',
    status: 'active',
    taxId: 'RFC-ABC-123456',
    paymentTerms: 'Net 30',
    billingRate: 1.25,
    notes: 'Cliente preferencial desde 2023',
    projects: 5,
    totalBilled: 125000,
  },
  {
    id: 2,
    name: 'BuildRight Inc',
    contactName: 'Patricia Méndez',
    email: 'patricia@buildright.com',
    phone: '555-2001',
    address: 'Calle Comercio 500',
    status: 'active',
    taxId: 'RFC-BRI-789012',
    paymentTerms: 'Net 15',
    billingRate: 1.30,
    notes: 'Pago puntual',
    projects: 3,
    totalBilled: 87500,
  },
  {
    id: 3,
    name: 'Metro Housing LLC',
    contactName: 'Fernando Torres',
    email: 'fernando@metrohousing.com',
    phone: '555-3001',
    address: 'Plaza Central 250',
    status: 'active',
    taxId: 'RFC-MHL-345678',
    paymentTerms: 'Net 30',
    billingRate: 1.20,
    notes: 'Proyectos de largo plazo',
    projects: 2,
    totalBilled: 156000,
  },
];

export const mockProjects = [
  {
    id: 1,
    name: 'Remodelación Edificio Central',
    clientId: 1,
    clientName: 'ABC Construction Corp',
    status: 'active',
    startDate: '2024-03-01',
    endDate: '2024-06-30',
    budget: 50000,
    spent: 32500,
    location: 'Downtown',
    manager: 'Carlos Rodríguez',
    description: 'Renovación completa de oficinas',
    workers: [1, 2, 3],
  },
  {
    id: 2,
    name: 'Construcción Complejo Residencial',
    clientId: 2,
    clientName: 'BuildRight Inc',
    status: 'active',
    startDate: '2024-02-15',
    endDate: '2024-08-15',
    budget: 125000,
    spent: 45000,
    location: 'North District',
    manager: 'María González',
    description: 'Nuevo desarrollo residencial - 12 unidades',
    workers: [1, 2, 3, 4],
  },
  {
    id: 3,
    name: 'Mantenimiento Centro Comercial',
    clientId: 3,
    clientName: 'Metro Housing LLC',
    status: 'completed',
    startDate: '2024-01-10',
    endDate: '2024-02-28',
    budget: 25000,
    spent: 24500,
    location: 'East Side',
    manager: 'José Martínez',
    description: 'Mantenimiento general y reparaciones',
    workers: [2, 3],
  },
];

export const mockAssignments = [
  {
    id: 1,
    worker_id: 1,
    project_id: 1,
    status: 'active',
    start_date: '2024-03-01',
    end_date: null,
    project: {
      id: 1,
      name: 'Remodelación Edificio Central'
    },
    worker: {
      id: 1,
      first_name: 'Juan',
      last_name: 'Pérez'
    }
  },
  {
    id: 2,
    worker_id: 2,
    project_id: 2,
    status: 'active',
    start_date: '2024-02-15',
    end_date: null,
    project: {
      id: 2,
      name: 'Construcción Complejo Residencial'
    },
    worker: {
      id: 2,
      first_name: 'Ana',
      last_name: 'Gómez'
    }
  }
];

export const mockTimeEntries = [
  {
    id: 1,
    workerId: 1,
    workerName: 'Carlos Rodríguez',
    projectId: 1,
    projectName: 'Remodelación Edificio Central',
    date: '2024-04-18',
    clockIn: '08:00',
    clockOut: '17:00',
    hours: 8.5,
    status: 'approved',
    notes: 'Instalación eléctrica piso 2',
  },
  {
    id: 2,
    workerId: 2,
    workerName: 'María González',
    projectId: 1,
    projectName: 'Remodelación Edificio Central',
    date: '2024-04-18',
    clockIn: '08:00',
    clockOut: '16:30',
    hours: 8.0,
    status: 'approved',
    notes: 'Plomería baños nuevos',
  },
  {
    id: 3,
    workerId: 1,
    workerName: 'Carlos Rodríguez',
    projectId: 2,
    projectName: 'Construcción Complejo Residencial',
    date: '2024-04-19',
    clockIn: '07:30',
    clockOut: '16:00',
    hours: 8.0,
    status: 'pending',
    notes: 'Cableado unidades 1-4',
  },
  {
    id: 4,
    workerId: 3,
    workerName: 'José Martínez',
    projectId: 2,
    projectName: 'Construcción Complejo Residencial',
    date: '2024-04-19',
    clockIn: '08:00',
    clockOut: '',
    hours: 0,
    status: 'live',
    notes: 'Marcos de puertas',
  },
];

export const mockInvoices = [
  {
    id: 1,
    invoiceNumber: 'INV-2024-001',
    clientId: 1,
    clientName: 'ABC Construction Corp',
    projectId: 1,
    projectName: 'Remodelación Edificio Central',
    date: '2024-04-01',
    dueDate: '2024-05-01',
    subtotal: 12500,
    tax: 1000,
    total: 13500,
    status: 'paid',
    paidDate: '2024-04-28',
    items: [
      { description: 'Mano de obra - Electricidad', hours: 160, rate: 56.25, amount: 9000 },
      { description: 'Mano de obra - Plomería', hours: 80, rate: 52.50, amount: 4200 },
    ],
  },
  {
    id: 2,
    invoiceNumber: 'INV-2024-002',
    clientId: 2,
    clientName: 'BuildRight Inc',
    date: '2024-04-10',
    dueDate: '2024-04-25',
    subtotal: 8750,
    tax: 700,
    total: 9450,
    status: 'pending',
    items: [
      { description: 'Mano de obra - Carpintería', hours: 120, rate: 52.00, amount: 6240 },
      { description: 'Mano de obra - Pintura', hours: 60, rate: 43.75, amount: 2625 },
    ],
  },
  {
    id: 3,
    invoiceNumber: 'INV-2024-003',
    clientId: 3,
    clientName: 'Metro Housing LLC',
    date: '2024-04-15',
    dueDate: '2024-03-15',
    subtotal: 15000,
    tax: 1200,
    total: 16200,
    status: 'overdue',
    items: [
      { description: 'Mano de obra - Mantenimiento general', hours: 200, rate: 60.00, amount: 12000 },
      { description: 'Materiales', hours: 0, rate: 0, amount: 3000 },
    ],
  },
];

export const mockPayroll = [
  {
    id: 1,
    period: '2024-04-01 - 2024-04-15',
    workerId: 1,
    workerName: 'Carlos Rodríguez',
    regularHours: 80,
    overtimeHours: 5,
    regularPay: 3600,
    overtimePay: 337.50,
    grossPay: 3937.50,
    deductions: 590.63,
    netPay: 3346.87,
    status: 'paid',
    paidDate: '2024-04-16',
  },
  {
    id: 2,
    period: '2024-04-01 - 2024-04-15',
    workerId: 2,
    workerName: 'María González',
    regularHours: 80,
    overtimeHours: 0,
    regularPay: 3360,
    overtimePay: 0,
    grossPay: 3360,
    deductions: 504,
    netPay: 2856,
    status: 'approved',
  },
  {
    id: 3,
    period: '2024-04-01 - 2024-04-15',
    workerId: 3,
    workerName: 'José Martínez',
    regularHours: 76,
    overtimeHours: 2,
    regularPay: 3040,
    overtimePay: 120,
    grossPay: 3160,
    deductions: 474,
    netPay: 2686,
    status: 'pending',
  },
];

export const mockDashboardStats = {
  activeWorkers: 12,
  activeProjects: 5,
  pendingInvoices: 8,
  monthlyRevenue: 45780,
  weeklyEarnings: [
    { day: 'Lun', amount: 4200 },
    { day: 'Mar', amount: 5100 },
    { day: 'Mié', amount: 4800 },
    { day: 'Jue', amount: 5400 },
    { day: 'Vie', amount: 4600 },
    { day: 'Sáb', amount: 3200 },
    { day: 'Dom', amount: 0 },
  ],
  recentActivities: [
    {
      id: 1,
      type: 'time_entry',
      message: 'Carlos Rodríguez marcó salida',
      time: 'Hace 5 min',
      icon: '⏰',
    },
    {
      id: 2,
      type: 'invoice',
      message: 'Nueva factura creada: INV-2024-003',
      time: 'Hace 1 hora',
      icon: '📄',
    },
    {
      id: 3,
      type: 'project',
      message: 'Proyecto "Edificio Central" actualizado',
      time: 'Hace 2 horas',
      icon: '📊',
    },
  ],
};

export const mockWorkerStats = [
  {
    worker_id: 1,
    total_hours_this_month: 160,
    total_earned_this_month: 7200,
    avg_hours_per_week: 40,
  },
  {
    worker_id: 2,
    total_hours_this_month: 152,
    total_earned_this_month: 6384,
    avg_hours_per_week: 38,
  },
  {
    worker_id: 3,
    total_hours_this_month: 144,
    total_earned_this_month: 5760,
    avg_hours_per_week: 36,
  },
  {
    worker_id: 4,
    total_hours_this_month: 0,
    total_earned_this_month: 0,
    avg_hours_per_week: 0,
  },
];

export const mockAccountingTransactions = [
  {
    id: 1,
    date: '2024-04-18',
    type: 'income',
    category: 'Invoice Payment',
    description: 'Pago factura INV-2024-001',
    amount: 13500,
    reference: 'ABC Construction Corp',
  },
  {
    id: 2,
    date: '2024-04-17',
    type: 'expense',
    category: 'Payroll',
    description: 'Nómina quincena 1-15 Abril',
    amount: -8889.87,
    reference: 'Nómina',
  },
  {
    id: 3,
    date: '2024-04-16',
    type: 'expense',
    category: 'Materials',
    description: 'Compra materiales proyecto #2',
    amount: -2450,
    reference: 'Home Depot',
  },
];

export const mockPnL = {
  income: {
    items: { 'Facturas Pagadas': 45000 },
    total: 45000
  },
  expense: {
    items: { 'Nómina': 28000, 'Materiales': 5000 },
    total: 33000
  },
  net: 12000,
  period: '2026-04',
};

export const mockMarginsWorkers = [
  { worker_id: 1, worker_name: 'Carlos Rodríguez', worker_code: 'WRK-001', billed: 15000, paid: 9000, margin: 6000, margin_pct: 40 },
  { worker_id: 2, worker_name: 'María González', worker_code: 'WRK-002', billed: 12000, paid: 7500, margin: 4500, margin_pct: 37.5 },
  { worker_id: 3, worker_name: 'José Martínez', worker_code: 'WRK-003', billed: 10000, paid: 6500, margin: 3500, margin_pct: 35 },
];

export const mockMarginsClients = [
  { client_id: 1, client_name: 'ABC Construction Corp', billed: 25000, cost: 15000, margin: 10000, margin_pct: 40 },
  { client_id: 2, client_name: 'BuildRight Inc', billed: 12000, cost: 8000, margin: 4000, margin_pct: 33.3 },
  { client_id: 3, client_name: 'Metro Housing LLC', billed: 8000, cost: 5000, margin: 3000, margin_pct: 37.5 },
];

export const mockCashFlow = [
  { period: '2026-01', income: 35000, expense: 22000, balance: 13000 },
  { period: '2026-02', income: 42000, expense: 28000, balance: 14000 },
  { period: '2026-03', income: 38000, expense: 25000, balance: 13000 },
  { period: '2026-04', income: 45000, expense: 33000, balance: 12000 },
];

export const mockAccountingCategories = [
  { id: 1, name: 'Invoice Payment', type: 'income' },
  { id: 2, name: 'Payroll', type: 'expense' },
  { id: 3, name: 'Materials', type: 'expense' },
  { id: 4, name: 'Equipment Rent', type: 'expense' },
  { id: 5, name: 'Office Supplies', type: 'expense' },
  { id: 6, name: 'Insurance', type: 'expense' },
];

export const mockSettings = {
  company_name: 'HM Construction Staffing LLLP',
  company_email: 'admin@hmcs.com',
  company_phone: '555-0000',
  company_address: '123 Main St, Suite 100',
  tax_id: 'XX-XXXXXXX',
  default_markup: 30,
  payroll_frequency: 'bi-weekly',
  timezone: 'America/New_York',
};
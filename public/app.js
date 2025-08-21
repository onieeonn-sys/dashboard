// Global Application State
class AppState {
    constructor() {
        this.user = null;
        this.token = localStorage.getItem('token');
        this.currentPage = 'welcome';
        this.isAuthenticated = false;
    }

    setUser(user) {
        this.user = user;
        this.isAuthenticated = true;
        document.getElementById('userName').textContent = user.profile?.companyName || user.firstName;
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }

    logout() {
        this.user = null;
        this.token = null;
        this.isAuthenticated = false;
        localStorage.removeItem('token');
        this.navigateTo('welcome');
    }

    navigateTo(page) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        
        // Show target page
        const targetPage = document.getElementById(page + 'Page');
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = page;
        }

        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === page) {
                link.classList.add('active');
            }
        });

        // Show/hide navbar based on authentication
        const navbar = document.getElementById('navbar');
        if (this.isAuthenticated && page !== 'welcome') {
            navbar.classList.remove('hidden');
        } else {
            navbar.classList.add('hidden');
        }

        // Load page content
        this.loadPageContent(page);
    }

    async loadPageContent(page) {
        if (!this.isAuthenticated && page !== 'welcome' && page !== 'login' && page !== 'register') {
            this.navigateTo('login');
            return;
        }

        switch (page) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'products':
                await this.loadProducts();
                break;
            case 'requirements':
                await this.loadRequirements();
                break;
            case 'bidding':
                await this.loadBidding();
                break;
            case 'orders':
                await this.loadOrders();
                break;
            case 'documents':
                await this.loadDocuments();
                break;
            case 'analytics':
                await this.loadAnalytics();
                break;
        }
    }

    async loadDashboard() {
        try {
            const response = await this.apiCall('/api/analytics/dashboard');
            const analytics = await response.json();
            this.renderDashboard(analytics);
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showToast('Error loading dashboard data', 'error');
            
            // Show fallback dashboard with empty data
            const fallbackAnalytics = {
                overview: {
                    totalProducts: 0,
                    totalBids: 0,
                    totalOrders: 0,
                    revenue: 0
                },
                performance: {
                    conversionRate: 0,
                    avgOrderValue: 0,
                    customerSatisfaction: 0
                },
                trends: {
                    salesTrend: [],
                    ordersTrend: []
                }
            };
            this.renderDashboard(fallbackAnalytics);
        }
    }

    renderDashboard(analytics) {
        const content = document.getElementById('dashboardContent');
        const isExporter = this.user.role === 'exporter';
        
        content.innerHTML = `
            <div class="stats-grid">
                ${isExporter ? `
                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon primary">
                                <i class="fas fa-box"></i>
                            </div>
                        </div>
                        <div class="stat-value">${analytics.overview.totalProducts || 0}</div>
                        <div class="stat-label">Total Products</div>
                        <div class="stat-change positive">+${analytics.overview.activeProducts || 0} active</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon secondary">
                                <i class="fas fa-gavel"></i>
                            </div>
                        </div>
                        <div class="stat-value">${analytics.overview.totalBids || 0}</div>
                        <div class="stat-label">Total Bids</div>
                        <div class="stat-change positive">${analytics.performance.bidWinRate || 0}% win rate</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon success">
                                <i class="fas fa-shopping-cart"></i>
                            </div>
                        </div>
                        <div class="stat-value">${analytics.overview.totalOrders || 0}</div>
                        <div class="stat-label">Total Orders</div>
                        <div class="stat-change positive">$${(analytics.performance.totalRevenue || 0).toLocaleString()}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon warning">
                                <i class="fas fa-chart-line"></i>
                            </div>
                        </div>
                        <div class="stat-value">${analytics.performance.onTimeDeliveryRate || 0}%</div>
                        <div class="stat-label">On-time Delivery</div>
                        <div class="stat-change positive">Performance</div>
                    </div>
                ` : `
                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon primary">
                                <i class="fas fa-clipboard-list"></i>
                            </div>
                        </div>
                        <div class="stat-value">${analytics.overview.totalRequirements || 0}</div>
                        <div class="stat-label">Total Requirements</div>
                        <div class="stat-change positive">+${analytics.overview.activeRequirements || 0} active</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon secondary">
                                <i class="fas fa-gavel"></i>
                            </div>
                        </div>
                        <div class="stat-value">${analytics.overview.totalBids || 0}</div>
                        <div class="stat-label">Bids Received</div>
                        <div class="stat-change positive">${analytics.overview.averageBidsPerRequirement || 0} avg per req</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon success">
                                <i class="fas fa-shopping-cart"></i>
                            </div>
                        </div>
                        <div class="stat-value">${analytics.overview.totalOrders || 0}</div>
                        <div class="stat-label">Total Orders</div>
                        <div class="stat-change positive">$${(analytics.performance.totalSpent || 0).toLocaleString()}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon warning">
                                <i class="fas fa-percentage"></i>
                            </div>
                        </div>
                        <div class="stat-value">${analytics.performance.requirementFulfillmentRate || 0}%</div>
                        <div class="stat-label">Fulfillment Rate</div>
                        <div class="stat-change positive">Success Rate</div>
                    </div>
                `}
            </div>
            
            <div class="card mb-4">
                <div class="card-header">
                    <h3 class="card-title">External Trade API</h3>
                    <p class="card-subtitle">Connect to external trade data and services</p>
                </div>
                <div class="card-content">
                    <div class="api-link-section">
                        <p>Access comprehensive trade data and additional marketplace features through our external API platform.</p>
                        <button class="btn btn-primary" id="tradeApiButton">
                            <i class="fas fa-external-link-alt"></i> Enter Trade API Platform
                        </button>
                        <br><br>
                        <p><small>Alternative: <a href="https://trade-api-swhi.onrender.com/" target="_blank" rel="noopener noreferrer">Direct link to Trade API</a></small></p>
                    </div>
                </div>
            </div>
            
            <div class="chart-container">
                <div class="chart-header">
                    <h3 class="chart-title">${isExporter ? 'Bid Activity' : 'Requirement Activity'}</h3>
                    <p class="chart-subtitle">Activity over time</p>
                </div>
                <canvas id="activityChart" width="400" height="200"></canvas>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Recent Activity</h3>
                </div>
                <div class="card-content">
                    <div class="activity-list">
                        ${(analytics.recentActivity || []).map(activity => `
                            <div class="activity-item">
                                <div class="activity-icon">
                                    <i class="fas fa-${activity.type === 'bid' ? 'gavel' : activity.type === 'order' ? 'shopping-cart' : 'clipboard-list'}"></i>
                                </div>
                                <div class="activity-content">
                                    <div class="activity-description">${activity.description}</div>
                                    <div class="activity-date">${new Date(activity.date).toLocaleDateString()}</div>
                                </div>
                                <div class="activity-status">
                                    <span class="badge ${activity.status}">${activity.status}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Render activity chart
        this.renderActivityChart(analytics.trends);

        // Add event listener for the trade API button after rendering
        setTimeout(() => {
            const tradeApiButton = document.getElementById('tradeApiButton');
            if (tradeApiButton) {
                tradeApiButton.addEventListener('click', () => {
                    this.openExternalTradeAPI();
                });
            }
        }, 100);
    }

    renderActivityChart(trends) {
        const ctx = document.getElementById('activityChart');
        if (!ctx) return;

        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            ctx.innerHTML = '<div class="chart-fallback"><i class="fas fa-chart-line"></i><p>Chart functionality temporarily unavailable</p></div>';
            return;
        }

        const isExporter = this.user.role === 'exporter';
        const data = isExporter ? trends.bidsOverTime : trends.requirementsOverTime;

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [{
                    label: isExporter ? 'Bids Submitted' : 'Requirements Posted',
                    data: data.map(d => d.count),
                    borderColor: '#0891b2',
                    backgroundColor: 'rgba(8, 145, 178, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#e5e7eb'
                        }
                    },
                    x: {
                        grid: {
                            color: '#e5e7eb'
                        }
                    }
                }
            }
        });
    }

    async loadProducts() {
        if (this.user.role !== 'exporter') {
            document.getElementById('productsContent').innerHTML = `
                <div class="card text-center">
                    <div class="card-content">
                        <i class="fas fa-lock" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem;"></i>
                        <h3>Access Restricted</h3>
                        <p>Product management is only available for exporters.</p>
                    </div>
                </div>
            `;
            return;
        }

        try {
            const response = await this.apiCall('/api/products');
            const data = await response.json();
            this.renderProducts(data.products || []);
        } catch (error) {
            console.error('Error loading products:', error);
            this.showToast('Error loading products', 'error');
        }
    }

    renderProducts(products) {
        const content = document.getElementById('productsContent');
        
        if (products.length === 0) {
            content.innerHTML = `
                <div class="card text-center">
                    <div class="card-content">
                        <i class="fas fa-box" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem;"></i>
                        <h3>No Products Yet</h3>
                        <p>Start by adding your first product to the marketplace.</p>
                        <button class="btn btn-primary mt-4" onclick="app.showAddProductModal()">
                            <i class="fas fa-plus"></i> Add Your First Product
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="products-grid">
                ${products.map(product => `
                    <div class="card product-card">
                        <div class="product-image">
                            ${product.images && product.images.length > 0 ? 
                                `<img src="${product.images[0]}" alt="${product.name}" />` :
                                `<div class="product-placeholder"><i class="fas fa-image"></i></div>`
                            }
                            <div class="product-status">
                                <span class="badge ${product.isActive ? 'success' : 'secondary'}">
                                    ${product.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                        <div class="product-content">
                            <h4 class="product-name">${product.name}</h4>
                            <p class="product-category">${product.category}</p>
                            <div class="product-price">
                                <span class="price">${product.pricing.currency} ${product.pricing.basePrice.toLocaleString()}</span>
                                <span class="unit">per ${product.pricing.unit}</span>
                            </div>
                            <div class="product-moq">
                                <small>MOQ: ${product.pricing.minOrderQuantity} ${product.pricing.unit}</small>
                            </div>
                            <div class="product-stats">
                                <div class="stat">
                                    <i class="fas fa-eye"></i>
                                    <span>${product.views || 0} views</span>
                                </div>
                                <div class="stat">
                                    <i class="fas fa-heart"></i>
                                    <span>${product.inquiries || 0} inquiries</span>
                                </div>
                            </div>
                        </div>
                        <div class="product-actions">
                            <button class="btn btn-secondary" onclick="app.editProduct('${product.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-primary" onclick="app.viewProduct('${product.id}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async loadRequirements() {
        try {
            const endpoint = this.user.role === 'importer' ? '/api/requirements/my' : '/api/requirements';
            const response = await this.apiCall(endpoint);
            const data = await response.json();
            this.renderRequirements(data.requirements || []);
        } catch (error) {
            console.error('Error loading requirements:', error);
            this.showToast('Error loading requirements', 'error');
        }
    }

    renderRequirements(requirements) {
        const content = document.getElementById('requirementsContent');
        const isImporter = this.user.role === 'importer';
        
        if (requirements.length === 0) {
            content.innerHTML = `
                <div class="card text-center">
                    <div class="card-content">
                        <i class="fas fa-clipboard-list" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem;"></i>
                        <h3>${isImporter ? 'No Requirements Posted' : 'No Requirements Available'}</h3>
                        <p>${isImporter ? 'Start by posting your first requirement.' : 'Check back later for new requirements.'}</p>
                        ${isImporter ? `
                            <button class="btn btn-primary mt-4" onclick="app.showAddRequirementModal()">
                                <i class="fas fa-plus"></i> Post Your First Requirement
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="requirements-list">
                ${requirements.map(req => `
                    <div class="card requirement-card">
                        <div class="card-header">
                            <div class="requirement-title">
                                <h4>${req.title}</h4>
                                <span class="badge ${req.status}">${req.status}</span>
                            </div>
                            <div class="requirement-date">
                                <small>Posted: ${new Date(req.createdAt).toLocaleDateString()}</small>
                            </div>
                        </div>
                        <div class="card-content">
                            <div class="requirement-details">
                                <div class="detail">
                                    <strong>Category:</strong> ${req.category}
                                </div>
                                <div class="detail">
                                    <strong>Quantity:</strong> ${req.quantity.toLocaleString()} ${req.unit}
                                </div>
                                <div class="detail">
                                    <strong>Target Price:</strong> ${req.currency} ${req.targetPrice ? req.targetPrice.toLocaleString() : 'Negotiable'}
                                </div>
                                <div class="detail">
                                    <strong>Delivery:</strong> ${req.deliveryLocation}
                                </div>
                                <div class="detail">
                                    <strong>Deadline:</strong> ${new Date(req.bidDeadline).toLocaleDateString()}
                                </div>
                            </div>
                            <div class="requirement-description">
                                <p>${req.description}</p>
                            </div>
                            <div class="requirement-stats">
                                <div class="stat">
                                    <i class="fas fa-gavel"></i>
                                    <span>${req.bidCount || 0} bids</span>
                                </div>
                                <div class="stat">
                                    <i class="fas fa-clock"></i>
                                    <span>${this.getTimeRemaining(req.bidDeadline)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="requirement-actions">
                            ${isImporter ? `
                                <button class="btn btn-secondary" onclick="app.editRequirement('${req.id}')">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-primary" onclick="app.viewBids('${req.id}')">
                                    <i class="fas fa-gavel"></i> View Bids (${req.bidCount || 0})
                                </button>
                            ` : `
                                <button class="btn btn-secondary" onclick="app.viewRequirement('${req.id}')">
                                    <i class="fas fa-eye"></i> View Details
                                </button>
                                <button class="btn btn-primary" onclick="app.submitBid('${req.id}')" 
                                    ${req.status !== 'active' || new Date(req.bidDeadline) < new Date() ? 'disabled' : ''}>
                                    <i class="fas fa-gavel"></i> Submit Bid
                                </button>
                            `}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    getTimeRemaining(deadline) {
        const now = new Date();
        const end = new Date(deadline);
        const diff = end - now;
        
        if (diff <= 0) return 'Expired';
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (days > 0) return `${days}d ${hours}h remaining`;
        return `${hours}h remaining`;
    }

    async apiCall(endpoint, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
            }
        };

        const response = await fetch(endpoint, { ...defaultOptions, ...options });
        
        if (response.status === 401) {
            this.logout();
            throw new Error('Unauthorized');
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response;
    }

    showToast(message, type = 'info', title = '') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="${icons[type]}"></i>
            </div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(toast);
        
        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    showModal(content) {
        const overlay = document.getElementById('modalOverlay');
        const modalContent = document.getElementById('modalContent');
        
        modalContent.innerHTML = content;
        overlay.classList.add('show');
        
        // Close on overlay click
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                this.hideModal();
            }
        };
    }

    hideModal() {
        const overlay = document.getElementById('modalOverlay');
        overlay.classList.remove('show');
    }
}

// Initialize app
const app = new AppState();

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, token exists:', !!app.token);
    
    // Always hide loading spinner after a short delay to ensure page is ready
    setTimeout(() => {
        console.log('Hiding loading spinner');
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.classList.add('hidden');
            console.log('Loading spinner hidden');
        } else {
            console.error('Loading element not found');
        }
    }, 100);
    
    // Check for existing authentication
    if (app.token) {
        console.log('Token found, validating...');
        // Validate token and get user info
        app.apiCall('/api/auth/profile')
            .then(response => response.json())
            .then(user => {
                console.log('User authenticated:', user.email);
                app.setUser(user);
                app.navigateTo('dashboard');
            })
            .catch((error) => {
                console.log('Authentication failed:', error);
                app.logout();
            });
    } else {
        console.log('No token found, showing welcome page');
        app.navigateTo('welcome');
    }

    // Event Listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Enter Portal Button
    document.getElementById('enterPortalBtn').addEventListener('click', () => {
        app.navigateTo('login');
    });

    // Navigation Links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            if (page) {
                app.navigateTo(page);
            }
        });
    });

    // User Menu
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    
    userMenuBtn.addEventListener('click', () => {
        userDropdown.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!userMenuBtn.contains(e.target)) {
            userDropdown.classList.remove('show');
        }
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        app.logout();
    });

    // Auth Forms
    setupAuthForms();

    // Dashboard Period Change
    const dashboardPeriod = document.getElementById('dashboardPeriod');
    if (dashboardPeriod) {
        dashboardPeriod.addEventListener('change', () => {
            if (app.currentPage === 'dashboard') {
                app.loadDashboard();
            }
        });
    }

    // Refresh Dashboard
    const refreshBtn = document.getElementById('refreshDashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            app.loadDashboard();
        });
    }


}

function setupAuthForms() {
    // Show Register
    document.getElementById('showRegisterBtn').addEventListener('click', (e) => {
        e.preventDefault();
        app.navigateTo('register');
    });

    // Show Login
    document.getElementById('showLoginBtn').addEventListener('click', (e) => {
        e.preventDefault();
        app.navigateTo('login');
    });

    // Role Selection
    document.querySelectorAll('.role-card').forEach(card => {
        card.addEventListener('click', () => {
            // Remove previous selection
            document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
            
            // Select current card
            card.classList.add('selected');
            
            // Set role and show form
            const role = card.dataset.role;
            document.getElementById('selectedRole').value = role;
            document.getElementById('roleSelection').classList.add('hidden');
            document.getElementById('registerForm').classList.remove('hidden');
        });
    });

    // Back to Role Selection
    document.getElementById('backToRoleBtn').addEventListener('click', () => {
        document.getElementById('roleSelection').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
    });

    // Login Form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const loginData = {
            email: formData.get('email'),
            password: formData.get('password')
        };

        try {
            const response = await app.apiCall('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify(loginData)
            });

            const result = await response.json();
            
            app.setToken(result.token);
            app.setUser(result.user);
            app.showToast('Login successful!', 'success');
            app.navigateTo('dashboard');
            
        } catch (error) {
            console.error('Login error:', error);
            app.showToast('Invalid email or password', 'error');
        }
    });

    // Register Form
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const registerData = {
            role: formData.get('role'),
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            password: formData.get('password'),
            profile: {
                companyName: formData.get('companyName'),
                companyType: formData.get('companyType'),
                establishedYear: formData.get('establishedYear'),
                address: formData.get('companyAddress'),
                country: formData.get('country'),
                website: formData.get('website'),
                iecCode: formData.get('iecCode'),
                gstNumber: formData.get('gstNumber'),
                businessDescription: formData.get('businessDescription')
            }
        };

        try {
            const response = await app.apiCall('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify(registerData)
            });

            const result = await response.json();
            
            app.setToken(result.token);
            app.setUser(result.user);
            app.showToast('Registration successful! Welcome to TradeConnect!', 'success');
            app.navigateTo('dashboard');
            
        } catch (error) {
            console.error('Registration error:', error);
            app.showToast('Registration failed. Please try again.', 'error');
        }
    });
}

// Additional utility functions
app.showAddProductModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add New Product</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <form id="addProductForm" class="modal-body">
                <div class="form-group">
                    <label for="productName">Product Name *</label>
                    <input type="text" id="productName" name="name" required>
                </div>
                <div class="form-group">
                    <label for="productDescription">Description *</label>
                    <textarea id="productDescription" name="description" rows="3" required></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="productCategory">Category *</label>
                        <select id="productCategory" name="category" required>
                            <option value="">Select Category</option>
                            <option value="agriculture">Agriculture</option>
                            <option value="textiles">Textiles</option>
                            <option value="electronics">Electronics</option>
                            <option value="machinery">Machinery</option>
                            <option value="chemicals">Chemicals</option>
                            <option value="food">Food & Beverages</option>
                            <option value="automotive">Automotive</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="productOrigin">Country of Origin *</label>
                        <input type="text" id="productOrigin" name="origin" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="productPrice">Price *</label>
                        <input type="number" id="productPrice" name="price" step="0.01" min="0" required>
                    </div>
                    <div class="form-group">
                        <label for="productCurrency">Currency *</label>
                        <select id="productCurrency" name="currency" required>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                            <option value="JPY">JPY</option>
                            <option value="CNY">CNY</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="productUnit">Unit *</label>
                        <input type="text" id="productUnit" name="unit" placeholder="e.g., kg, pieces, tons" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="productMinOrder">Minimum Order Quantity *</label>
                        <input type="number" id="productMinOrder" name="minOrderQuantity" min="1" required>
                    </div>
                    <div class="form-group">
                        <label for="productStock">Available Stock</label>
                        <input type="number" id="productStock" name="stockQuantity" min="0">
                    </div>
                </div>
                <div class="form-group">
                    <label for="productCertifications">Certifications</label>
                    <input type="text" id="productCertifications" name="certifications" placeholder="e.g., ISO 9001, Organic, Fair Trade">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Product</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle form submission
    document.getElementById('addProductForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const productData = {
            name: formData.get('name'),
            description: formData.get('description'),
            category: formData.get('category'),
            origin: formData.get('origin'),
            price: parseFloat(formData.get('price')),
            currency: formData.get('currency'),
            unit: formData.get('unit'),
            minOrderQuantity: parseInt(formData.get('minOrderQuantity')),
            stockQuantity: parseInt(formData.get('stockQuantity')) || 0,
            certifications: formData.get('certifications') || ''
        };
        
        try {
            const response = await app.apiCall('/api/products', {
                method: 'POST',
                body: JSON.stringify(productData)
            });
            
            const result = await response.json();
            app.showToast('Product added successfully!', 'success');
            modal.remove();
            
            // Reload products if we're on the products page
            if (app.currentPage === 'products') {
                await app.loadProducts();
            }
        } catch (error) {
            console.error('Error adding product:', error);
            app.showToast('Error adding product. Please try again.', 'error');
        }
    });
}

app.editProduct = function(productId) {
    // Implementation for edit product
    app.showToast('Edit product feature coming soon!', 'info');
};

app.viewProduct = function(productId) {
    // Implementation for view product
    app.showToast('View product feature coming soon!', 'info');
};

app.showAddRequirementModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Post New Requirement</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <form id="addRequirementForm" class="modal-body">
                <div class="form-group">
                    <label for="requirementTitle">Requirement Title *</label>
                    <input type="text" id="requirementTitle" name="title" required>
                </div>
                <div class="form-group">
                    <label for="requirementDescription">Description *</label>
                    <textarea id="requirementDescription" name="description" rows="3" required></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="requirementCategory">Category *</label>
                        <select id="requirementCategory" name="category" required>
                            <option value="">Select Category</option>
                            <option value="agriculture">Agriculture</option>
                            <option value="textiles">Textiles</option>
                            <option value="electronics">Electronics</option>
                            <option value="machinery">Machinery</option>
                            <option value="chemicals">Chemicals</option>
                            <option value="food">Food & Beverages</option>
                            <option value="automotive">Automotive</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="requirementQuantity">Quantity *</label>
                        <input type="number" id="requirementQuantity" name="quantity" min="1" required>
                    </div>
                    <div class="form-group">
                        <label for="requirementUnit">Unit *</label>
                        <input type="text" id="requirementUnit" name="unit" placeholder="e.g., kg, pieces, tons" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="requirementTargetPrice">Target Price *</label>
                        <input type="number" id="requirementTargetPrice" name="targetPrice" step="0.01" min="0" required>
                    </div>
                    <div class="form-group">
                        <label for="requirementCurrency">Currency *</label>
                        <select id="requirementCurrency" name="currency" required>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                            <option value="JPY">JPY</option>
                            <option value="CNY">CNY</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="requirementDeadline">Deadline *</label>
                        <input type="date" id="requirementDeadline" name="deadline" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="requirementDeliveryLocation">Delivery Location *</label>
                        <input type="text" id="requirementDeliveryLocation" name="deliveryLocation" required>
                    </div>
                    <div class="form-group">
                        <label for="requirementPaymentTerms">Payment Terms</label>
                        <select id="requirementPaymentTerms" name="paymentTerms">
                            <option value="">Select Payment Terms</option>
                            <option value="advance">Advance Payment</option>
                            <option value="cod">Cash on Delivery</option>
                            <option value="net30">Net 30 Days</option>
                            <option value="net60">Net 60 Days</option>
                            <option value="lc">Letter of Credit</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label for="requirementSpecifications">Technical Specifications</label>
                    <textarea id="requirementSpecifications" name="specifications" rows="3" placeholder="Detailed specifications, quality requirements, certifications needed..."></textarea>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Post Requirement</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('requirementDeadline').min = today;
    
    // Handle form submission
    document.getElementById('addRequirementForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const requirementData = {
            title: formData.get('title'),
            description: formData.get('description'),
            category: formData.get('category'),
            quantity: parseInt(formData.get('quantity')),
            unit: formData.get('unit'),
            targetPrice: parseFloat(formData.get('targetPrice')),
            currency: formData.get('currency'),
            deadline: formData.get('deadline'),
            deliveryLocation: formData.get('deliveryLocation'),
            paymentTerms: formData.get('paymentTerms') || '',
            specifications: formData.get('specifications') || ''
        };
        
        try {
            const response = await app.apiCall('/api/requirements', {
                method: 'POST',
                body: JSON.stringify(requirementData)
            });
            
            const result = await response.json();
            app.showToast('Requirement posted successfully!', 'success');
            modal.remove();
            
            // Reload requirements if we're on the requirements page
            if (app.currentPage === 'requirements') {
                await app.loadRequirements();
            }
        } catch (error) {
            console.error('Error posting requirement:', error);
            app.showToast('Error posting requirement. Please try again.', 'error');
        }
    });
}

app.editRequirement = function(requirementId) {
    // Implementation for edit requirement
    app.showToast('Edit requirement feature coming soon!', 'info');
};

app.viewBids = function(requirementId) {
    // Implementation for view bids
    app.showToast('View bids feature coming soon!', 'info');
};

app.viewRequirement = function(requirementId) {
    // Implementation for view requirement
    app.showToast('View requirement feature coming soon!', 'info');
};

app.submitBid = function(requirementId) {
    // Implementation for submit bid
    app.showToast('Submit bid feature coming soon!', 'info');
};

app.loadBidding = async function() {
    document.getElementById('biddingContent').innerHTML = `
        <div class="card text-center">
            <div class="card-content">
                <i class="fas fa-gavel" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem;"></i>
                <h3>Bidding System</h3>
                <p>Advanced bidding features coming soon!</p>
            </div>
        </div>
    `;
};

app.loadOrders = async function() {
    document.getElementById('ordersContent').innerHTML = `
        <div class="card text-center">
            <div class="card-content">
                <i class="fas fa-shopping-cart" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem;"></i>
                <h3>Order Management</h3>
                <p>Order tracking and management features coming soon!</p>
            </div>
        </div>
    `;
};

app.loadDocuments = async function() {
    document.getElementById('documentsContent').innerHTML = `
        <div class="card text-center">
            <div class="card-content">
                <i class="fas fa-file-alt" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem;"></i>
                <h3>Document Management</h3>
                <p>Document upload and management features coming soon!</p>
            </div>
        </div>
    `;
};

app.loadAnalytics = async function() {
    document.getElementById('analyticsContent').innerHTML = `
        <div class="card text-center">
            <div class="card-content">
                <i class="fas fa-chart-bar" style="font-size: 3rem; color: var(--gray-400); margin-bottom: 1rem;"></i>
                <h3>Advanced Analytics</h3>
                <p>Detailed analytics and reporting features coming soon!</p>
            </div>
        </div>
    `;
};

app.openExternalTradeAPI = function() {
    console.log('openExternalTradeAPI function called');
    alert('Button clicked! Attempting to open external trade API...');
    
    try {
        // Open the external trade API in a new tab
        const newWindow = window.open('https://trade-api-swhi.onrender.com/', '_blank', 'noopener,noreferrer');
        
        if (newWindow) {
            // Show a toast notification
            this.showToast('Opening External Trade API Platform...', 'info', 'Redirecting');
            console.log('External trade API opened successfully');
        } else {
            // Popup was blocked
            alert('Popup blocked! Please allow popups for this site or use the direct link below.');
            this.showToast('Popup blocked - please allow popups or use direct link', 'warning');
        }
    } catch (error) {
        console.error('Error opening external trade API:', error);
        alert('Error: ' + error.message);
        this.showToast('Error opening external trade API', 'error');
    }
};

// Export app for global access
window.app = app;
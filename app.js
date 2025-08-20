// Trade data - will be loaded from the provided JSON
let tradeData = null;

// DOM elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const loadingState = document.getElementById('loadingState');
const searchResults = document.getElementById('searchResults');
const noResults = document.getElementById('noResults');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadTradeData();
    setupEventListeners();
});

// Load trade data from the provided JSON file
async function loadTradeData() {
    try {
        showLoading();
        const response = await fetch('trade_data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        tradeData = await response.json();
        console.log('Trade data loaded successfully:', tradeData);
        hideLoading();
    } catch (error) {
        console.error('Error loading trade data:', error);
        hideLoading();
        // Show error message to user
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="fas fa-exclamation-triangle"></i>
                Failed to load trade data. Please check your internet connection and try again.
                <br><small>Error: ${error.message}</small>
            </div>
        `;
        document.querySelector('.container').prepend(errorDiv);
        // Fallback to embedded data
        tradeData = {
            "hsn_codes": [
                {
                    "hsn_code": "8517.62.00",
                    "description": "Machines for reception, conversion and transmission or regeneration of voice, images or other data, including switching and routing apparatus",
                    "category": "Electrical, electronic equipment",
                    "gst_rate": 18,
                    "export_duty": 0,
                    "import_duty": 10
                },
                {
                    "hsn_code": "6109.10.00",
                    "description": "T-shirts, singlets and other vests, knitted or crocheted",
                    "category": "Textiles and Clothing",
                    "gst_rate": 12,
                    "export_duty": 0,
                    "import_duty": 10
                },
                {
                    "hsn_code": "1006.30.00",
                    "description": "Semi-milled or wholly milled rice, whether or not polished or glazed",
                    "category": "Food Products",
                    "gst_rate": 5,
                    "export_duty": 0,
                    "import_duty": 80
                }
            ],
            "trade_statistics": {
                "top_importers": {
                    "8517.62.00": [
                        {"country": "United States", "value_usd": 45000000, "percentage": 22.5},
                        {"country": "Germany", "value_usd": 32000000, "percentage": 16.0},
                        {"country": "United Kingdom", "value_usd": 24000000, "percentage": 12.0},
                        {"country": "Japan", "value_usd": 18000000, "percentage": 9.0},
                        {"country": "France", "value_usd": 16000000, "percentage": 8.0}
                    ],
                    "6109.10.00": [
                        {"country": "United States", "value_usd": 12000000, "percentage": 25.0},
                        {"country": "Germany", "value_usd": 8000000, "percentage": 16.7},
                        {"country": "United Kingdom", "value_usd": 6000000, "percentage": 12.5},
                        {"country": "Canada", "value_usd": 5000000, "percentage": 10.4},
                        {"country": "Australia", "value_usd": 4000000, "percentage": 8.3}
                    ],
                    "1006.30.00": [
                        {"country": "Saudi Arabia", "value_usd": 850000000, "percentage": 18.5},
                        {"country": "Iran", "value_usd": 720000000, "percentage": 15.7},
                        {"country": "Iraq", "value_usd": 680000000, "percentage": 14.8},
                        {"country": "UAE", "value_usd": 450000000, "percentage": 9.8},
                        {"country": "Bangladesh", "value_usd": 380000000, "percentage": 8.3}
                    ]
                },
                "top_exporters": {
                    "8517.62.00": [
                        {"country": "China", "value_usd": 78000000, "percentage": 35.2},
                        {"country": "South Korea", "value_usd": 34000000, "percentage": 15.3},
                        {"country": "Taiwan", "value_usd": 28000000, "percentage": 12.6},
                        {"country": "Singapore", "value_usd": 22000000, "percentage": 9.9},
                        {"country": "Vietnam", "value_usd": 18000000, "percentage": 8.1}
                    ],
                    "6109.10.00": [
                        {"country": "Bangladesh", "value_usd": 15000000, "percentage": 28.8},
                        {"country": "Vietnam", "value_usd": 12000000, "percentage": 23.1},
                        {"country": "India", "value_usd": 8000000, "percentage": 15.4},
                        {"country": "China", "value_usd": 6000000, "percentage": 11.5},
                        {"country": "Turkey", "value_usd": 4000000, "percentage": 7.7}
                    ],
                    "1006.30.00": [
                        {"country": "India", "value_usd": 9500000000, "percentage": 42.8},
                        {"country": "Thailand", "value_usd": 6200000000, "percentage": 28.0},
                        {"country": "Vietnam", "value_usd": 2800000000, "percentage": 12.6},
                        {"country": "Pakistan", "value_usd": 2100000000, "percentage": 9.5},
                        {"country": "Myanmar", "value_usd": 850000000, "percentage": 3.8}
                    ]
                }
            },
            "transportation_methods": {
                "air_freight": {
                    "speed": "1-7 days",
                    "cost_per_kg": "$4-12",
                    "pros": ["Fastest delivery", "High security", "Reliable scheduling", "Global reach"],
                    "cons": ["Most expensive", "Limited cargo capacity", "Weight restrictions", "High emissions"],
                    "best_for": ["Perishables", "High-value items", "Urgent shipments", "Pharmaceuticals"]
                },
                "sea_freight": {
                    "speed": "15-45 days",
                    "cost_per_container": "$1,500-5,000",
                    "pros": ["Most cost-effective", "High capacity", "Environmentally friendly", "No weight limits"],
                    "cons": ["Slowest option", "Weather dependent", "Port congestion", "Limited accessibility"],
                    "best_for": ["Bulk goods", "Heavy cargo", "Non-urgent shipments", "Large volumes"]
                },
                "road_freight": {
                    "speed": "1-7 days",
                    "cost_per_km": "$0.03-0.07",
                    "pros": ["Door-to-door delivery", "Flexible routing", "Real-time tracking", "Cost-effective for short distances"],
                    "cons": ["Limited to land routes", "Traffic delays", "Weight restrictions", "Higher emissions"],
                    "best_for": ["Regional deliveries", "Last-mile delivery", "Small shipments", "Perishables"]
                },
                "rail_freight": {
                    "speed": "3-15 days",
                    "cost_per_ton_km": "$0.02-0.06",
                    "pros": ["Environmentally friendly", "Cost-effective for bulk", "Weather independent", "Predictable schedules"],
                    "cons": ["Limited network", "Fixed routes", "Slower than air/road", "Infrastructure dependent"],
                    "best_for": ["Bulk commodities", "Long-distance land transport", "Raw materials", "Intercontinental routes"]
                }
            },
            "required_documents": {
                "export_documents": [
                    {"name": "Commercial Invoice", "description": "Legal document between exporter and buyer detailing goods and amount due", "mandatory": true},
                    {"name": "Packing List", "description": "Detailed list of package contents, weights, and dimensions", "mandatory": true},
                    {"name": "Bill of Lading/Airway Bill", "description": "Receipt and contract for transportation of goods", "mandatory": true},
                    {"name": "Certificate of Origin", "description": "Document certifying the country of origin of goods", "mandatory": false},
                    {"name": "Export License", "description": "Government permission for controlled goods export", "mandatory": false},
                    {"name": "Shipping Bill", "description": "Customs declaration for export goods", "mandatory": true},
                    {"name": "Insurance Certificate", "description": "Proof of cargo insurance coverage", "mandatory": false},
                    {"name": "Phytosanitary Certificate", "description": "Certificate for plant/agricultural products", "mandatory": false}
                ],
                "import_documents": [
                    {"name": "Bill of Entry", "description": "Legal document filed for imported goods clearance", "mandatory": true},
                    {"name": "Commercial Invoice", "description": "Invoice from exporter detailing goods and costs", "mandatory": true},
                    {"name": "Bill of Lading/Airway Bill", "description": "Transport document showing goods received", "mandatory": true},
                    {"name": "Import License", "description": "Government permission for controlled goods import", "mandatory": false},
                    {"name": "Certificate of Insurance", "description": "Proof of marine/cargo insurance", "mandatory": false},
                    {"name": "Letter of Credit", "description": "Bank guarantee for payment", "mandatory": false},
                    {"name": "Customs Declaration", "description": "Declaration of goods for customs assessment", "mandatory": true},
                    {"name": "Technical Certificate", "description": "Certification for technical/electronic goods", "mandatory": false}
                ]
            },
            "insurance_details": {
                "marine_cargo_insurance": {
                    "coverage": "Warehouse to warehouse protection",
                    "premium_rate": "0.1% - 0.5% of cargo value",
                    "types": [
                        {"name": "All Risk Coverage (ICC-A)", "description": "Broadest coverage for accidental loss/damage", "premium": "0.3-0.5%"},
                        {"name": "Named Perils Coverage (ICC-B)", "description": "Medium coverage for specified risks", "premium": "0.2-0.3%"},
                        {"name": "Basic Coverage (ICC-C)", "description": "Basic coverage for limited risks", "premium": "0.1-0.2%"}
                    ],
                    "additional_covers": [
                        {"name": "War Risk Coverage", "description": "Coverage for war-related damages", "additional_premium": "0.05-0.1%"},
                        {"name": "Strike Risk Coverage", "description": "Coverage for strike/riot damages", "additional_premium": "0.02-0.05%"}
                    ]
                },
                "trade_credit_insurance": {
                    "coverage": "Protection against buyer non-payment",
                    "premium_rate": "0.15% - 0.75% of credit limit",
                    "benefits": ["Credit enhancement", "Market intelligence", "Debt collection", "Political risk coverage"]
                }
            },
            "country_specific_requirements": {
                "United States": {
                    "customs_procedures": "FDA approvals for food/pharma, ISF filing 24 hours before loading",
                    "documentation": ["Commercial Invoice", "Packing List", "Bill of Lading", "ISF Form"],
                    "special_requirements": "CTPAT compliance recommended for faster clearance",
                    "average_clearance_time": "1-3 days"
                },
                "Germany": {
                    "customs_procedures": "EU customs union procedures, CE marking for electronics",
                    "documentation": ["Commercial Invoice", "Packing List", "EUR.1 Certificate", "Conformity Declaration"],
                    "special_requirements": "EORI number required for customs clearance",
                    "average_clearance_time": "1-2 days"
                },
                "United Kingdom": {
                    "customs_procedures": "Post-Brexit customs procedures, VAT registration required",
                    "documentation": ["Commercial Invoice", "Packing List", "Certificate of Origin", "Customs Declaration"],
                    "special_requirements": "GBOS scheme for simplified procedures",
                    "average_clearance_time": "1-2 days"
                },
                "China": {
                    "customs_procedures": "CCC certification for electronics, import license for restricted goods",
                    "documentation": ["Commercial Invoice", "Packing List", "Certificate of Origin", "Import License"],
                    "special_requirements": "China Compulsory Certificate (CCC) for regulated products",
                    "average_clearance_time": "2-5 days"
                }
            },
            "pricing_information": {
                "sample_prices": {
                    "8517.62.00": {
                        "average_price_per_unit": 250,
                        "currency": "USD",
                        "price_range": {"min": 180, "max": 420},
                        "market_trend": "increasing",
                        "last_updated": "2025-08-14"
                    },
                    "6109.10.00": {
                        "average_price_per_unit": 12,
                        "currency": "USD",
                        "price_range": {"min": 8, "max": 25},
                        "market_trend": "stable",
                        "last_updated": "2025-08-14"
                    },
                    "1006.30.00": {
                        "average_price_per_ton": 580,
                        "currency": "USD",
                        "price_range": {"min": 420, "max": 780},
                        "market_trend": "increasing",
                        "last_updated": "2025-08-14"
                    }
                }
            }
        };
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // Search suggestions
    document.querySelectorAll('.suggestion').forEach(suggestion => {
        suggestion.addEventListener('click', function() {
            searchInput.value = this.getAttribute('data-search');
            handleSearch();
        });
    });

    // Country tab switching
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('tab-btn')) {
            handleCountryTabSwitch(e.target);
        }
    });
}

// Handle search functionality
function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) return;

    showLoading();
    
    // Simulate search delay
    setTimeout(() => {
        const result = searchProduct(query);
        if (result) {
            displaySearchResults(result);
        } else {
            showNoResults();
        }
        hideLoading();
    }, 1000);
}

// Search for product by HSN code or name
function searchProduct(query) {
    if (!tradeData) return null;

    // Check if data structure has products array instead of hsn_codes
    const products = tradeData.products || tradeData.hsn_codes;
    if (!products) return null;

    // Search by HSN code first
    let product = products.find(p => 
        (p.hsnCode || p.hsn_code).toLowerCase().includes(query)
    );

    // If not found, search by description/name
    if (!product) {
        product = products.find(p => 
            (p.productDescription || p.description).toLowerCase().includes(query) ||
            (p.productCategory || p.category).toLowerCase().includes(query)
        );
    }

    // Additional search terms mapping
    const searchMappings = {
        'smartphone': '8517.62.00',
        'smartphones': '8517.62.00',
        'mobile': '8517.62.00',
        'phone': '8517.62.00',
        'car': '8703.23.91',
        'cars': '8703.23.91',
        'automobile': '8703.23.91',
        'vehicle': '8703.23.91',
        'laptop': '8471.30.10',
        'laptops': '8471.30.10',
        'computer': '8471.30.10',
        'notebook': '8471.30.10',
        'tshirt': '6109.10.00',
        't-shirt': '6109.10.00',
        'tshirts': '6109.10.00',
        't-shirts': '6109.10.00',
        'shirt': '6109.10.00',
        'rice': '1006.30.00',
        'diesel': '2710.19.10',
        'fuel': '2710.19.10',
        'oil': '2710.19.10',
        'petroleum': '2710.19.10',
        'steel': '7208.10.00',
        'metal': '7208.10.00',
        'iron': '7208.10.00'
    };

    if (!product && searchMappings[query]) {
        product = products.find(p => 
            (p.hsnCode || p.hsn_code) === searchMappings[query]
        );
    }

    return product;
}

// Display search results
function displaySearchResults(product) {
    // Update product information
    document.getElementById('productHsn').textContent = `HSN Code: ${product.hsnCode || product.hsn_code}`;
    document.getElementById('productDescription').textContent = product.productName || product.description;
    document.getElementById('productCategory').textContent = product.productCategory || product.category;
    document.getElementById('gstRate').textContent = `${product.gstRate || product.gst_rate}%`;
    document.getElementById('importDuty').textContent = `${product.importDuty || product.import_duty}%`;
    document.getElementById('exportDuty').textContent = `${product.exportDuty || product.export_duty}%`;

    // Update pricing information
    let priceUnit, priceValue;
    
    if (product.pricePerUnit || product.average_price_per_unit) {
        priceUnit = 'per unit';
        priceValue = product.pricePerUnit || product.average_price_per_unit;
    } else if (product.pricePerTon || product.average_price_per_ton) {
        priceUnit = 'per ton';
        priceValue = product.pricePerTon || product.average_price_per_ton;
    } else if (product.pricePerKiloliter || product.average_price_per_kiloliter) {
        priceUnit = 'per kiloliter';
        priceValue = product.pricePerKiloliter || product.average_price_per_kiloliter;
    }
    
    if (priceValue) {
        document.getElementById('currentPrice').textContent = `₹${formatNumber(priceValue)} ${priceUnit}`;
    }
    
    const minPrice = product.minimumPrice || product.minimum_price_inr;
    const maxPrice = product.maximumPrice || product.maximum_price_inr;
    if (minPrice && maxPrice) {
        document.getElementById('priceRange').textContent = `Range: ₹${formatNumber(minPrice)} - ₹${formatNumber(maxPrice)}`;
    }
    
    const trendElement = document.getElementById('priceTrend');
    const marketTrend = product.marketTrend || product.market_trend;
    if (marketTrend) {
        trendElement.textContent = `${marketTrend.charAt(0).toUpperCase() + marketTrend.slice(1)} trend`;
        trendElement.className = `trend-indicator ${marketTrend}`;
        
        if (marketTrend === 'Growing') {
            trendElement.innerHTML = '<i class="fas fa-arrow-up"></i> ' + trendElement.textContent;
        } else if (marketTrend === 'Declining') {
            trendElement.innerHTML = '<i class="fas fa-arrow-down"></i> ' + trendElement.textContent;
        } else {
            trendElement.innerHTML = '<i class="fas fa-minus"></i> ' + trendElement.textContent;
        }
    }

    // Update product specifications
     document.getElementById('unitOfMeasurement').textContent = product.unitOfMeasurement || product.unit_of_measurement || 'N/A';
     document.getElementById('typicalPackaging').textContent = product.typicalPackaging || product.packaging_type || 'N/A';
     document.getElementById('shelfLife').textContent = product.shelfLife || product.shelf_life || 'N/A';
     
     // Update quality and compliance
     document.getElementById('qualityStandards').textContent = product.qualityStandards || product.quality_standards || 'N/A';
     document.getElementById('certificationsRequired').textContent = product.certificationsRequired || product.certifications || 'N/A';
     
     // Update market information
     document.getElementById('exportMarkets').textContent = product.exportMarket || product.major_suppliers || 'N/A';
     document.getElementById('importMarkets').textContent = product.importMarket || product.port_of_entry || 'N/A';
     document.getElementById('seasonality').textContent = product.seasonality || product.seasonal_demand || 'N/A';
     document.getElementById('tradeRestrictions').textContent = product.tradeRestrictions || 'None specified';
     
     // Update procedures and documentation
     document.getElementById('exportProcedures').textContent = product.exportProcedure || 'Standard export procedure as per government regulations';
     document.getElementById('importProcedures').textContent = product.importProcedure || 'Standard import procedure as per government regulations';
     document.getElementById('documentationRequired').textContent = product.documentationRequired || 'Standard trade documentation including invoice, packing list, and certificates';
     
     // Update storage information
     document.getElementById('storageConditions').textContent = product.storageCondition || product.storage_requirements || 'N/A';

    // Update trading countries
     displayTradingCountries(product.hsnCode || product.hsn_code);
     
     // Update documentation
     displayDocumentation(product.hsnCode || product.hsn_code);
     
     // Initialize country requirements with first tab
     initializeCountryTabs();
 
     // Show results
    searchResults.classList.remove('hidden');
    noResults.classList.add('hidden');
}

// Display trading countries
function displayTradingCountries(hsnCode) {
    const importers = tradeData.trade_statistics.top_importers[hsnCode] || [];
    const exporters = tradeData.trade_statistics.top_exporters[hsnCode] || [];

    displayCountryList('topImporters', importers);
    displayCountryList('topExporters', exporters);
}

// Display country list
function displayCountryList(containerId, countries) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    countries.forEach(country => {
        const countryItem = document.createElement('div');
        countryItem.className = 'country-item';
        
        countryItem.innerHTML = `
            <div class="country-info">
                <div class="country-flag">${getCountryFlag(country.country)}</div>
                <div class="country-name">${country.country}</div>
            </div>
            <div class="country-stats">
                <div class="trade-value">$${formatNumber(country.value_usd)}</div>
                <div class="trade-percentage">${country.percentage}%</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${country.percentage}%"></div>
                </div>
            </div>
        `;
        
        container.appendChild(countryItem);
    });
}

// Get country flag emoji
function getCountryFlag(countryName) {
    const flags = {
        'United States': '🇺🇸',
        'Germany': '🇩🇪',
        'United Kingdom': '🇬🇧',
        'Japan': '🇯🇵',
        'France': '🇫🇷',
        'China': '🇨🇳',
        'South Korea': '🇰🇷',
        'Taiwan': '🇹🇼',
        'Singapore': '🇸🇬',
        'Vietnam': '🇻🇳',
        'Bangladesh': '🇧🇩',
        'India': '🇮🇳',
        'Turkey': '🇹🇷',
        'Canada': '🇨🇦',
        'Australia': '🇦🇺',
        'Saudi Arabia': '🇸🇦',
        'Iran': '🇮🇷',
        'Iraq': '🇮🇶',
        'UAE': '🇦🇪',
        'Thailand': '🇹🇭',
        'Pakistan': '🇵🇰',
        'Myanmar': '🇲🇲'
    };
    return flags[countryName] || '🌍';
}

// Format large numbers
function formatNumber(num) {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1) + 'B';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Display documentation
function displayDocumentation() {
    displayDocList('exportDocs', tradeData.required_documents.export_documents);
    displayDocList('importDocs', tradeData.required_documents.import_documents);
}

// Display document list
function displayDocList(containerId, documents) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    documents.forEach(doc => {
        const docItem = document.createElement('div');
        docItem.className = 'doc-item';
        
        docItem.innerHTML = `
            <div class="doc-header">
                <div class="doc-name">${doc.name}</div>
                <div class="doc-badge ${doc.mandatory ? 'mandatory' : 'optional'}">
                    ${doc.mandatory ? 'Mandatory' : 'Optional'}
                </div>
            </div>
            <div class="doc-description">${doc.description}</div>
        `;
        
        container.appendChild(docItem);
    });
}

// Initialize country tabs
function initializeCountryTabs() {
    const firstTab = document.querySelector('.tab-btn');
    if (firstTab) {
        handleCountryTabSwitch(firstTab);
    }
}

// Handle country tab switching
function handleCountryTabSwitch(tabBtn) {
    // Remove active class from all tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to clicked tab
    tabBtn.classList.add('active');
    
    // Get country name and display requirements
    const countryName = tabBtn.getAttribute('data-country');
    displayCountryRequirements(countryName);
}

// Display country requirements
function displayCountryRequirements(countryName) {
    const requirements = tradeData.country_specific_requirements[countryName];
    const container = document.getElementById('countryDetails');
    
    if (!requirements) {
        container.innerHTML = '<p>No specific requirements available for this country.</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="country-requirement">
            <div class="requirement-label">Customs Procedures</div>
            <div class="requirement-value">${requirements.customs_procedures}</div>
        </div>
        <div class="country-requirement">
            <div class="requirement-label">Required Documentation</div>
            <div class="doc-tags">
                ${requirements.documentation.map(doc => `<span class="doc-tag">${doc}</span>`).join('')}
            </div>
        </div>
        <div class="country-requirement">
            <div class="requirement-label">Special Requirements</div>
            <div class="requirement-value">${requirements.special_requirements}</div>
        </div>
        <div class="country-requirement">
            <div class="requirement-label">Average Clearance Time</div>
            <div class="requirement-value">
                <span class="clearance-time">${requirements.average_clearance_time}</span>
            </div>
        </div>
    `;
}

// Show loading state
function showLoading() {
    loadingState.classList.remove('hidden');
    searchResults.classList.add('hidden');
    noResults.classList.add('hidden');
}

// Hide loading state
function hideLoading() {
    loadingState.classList.add('hidden');
}

// Show no results
function showNoResults() {
    noResults.classList.remove('hidden');
    searchResults.classList.add('hidden');
}
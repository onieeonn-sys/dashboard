const fs = require('fs');
const path = require('path');

// Read the CSV file
const csvContent = fs.readFileSync('data to put.csv', 'utf8');
const lines = csvContent.split('\n').filter(line => line.trim());

// Skip header row
const dataLines = lines.slice(1);

// Read existing trade_data.json
const tradeData = JSON.parse(fs.readFileSync('trade_data.json', 'utf8'));

// Function to parse CSV line
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

// Function to convert CSV row to JSON product
function convertToProduct(csvRow) {
    const [
        hsnCode, productName, category, subcategory, description,
        unit, packaging, shelfLife, importDuty, gstRate,
        exportMarket, importMarket, certifications, qualityStandards,
        seasonality, storage, exportProcedure, importProcedure,
        tradeRestrictions, documentation, minPrice, maxPrice, avgPrice,
        avgPricePerUnit, avgPriceTotal, notes
    ] = csvRow;
    
    // Parse prices
    const parsePrice = (price) => {
        if (!price || price === '-' || price === '') return 0;
        return parseInt(price.replace(/,/g, '')) || 0;
    };
    
    return {
        hsnCode: hsnCode || '',
        productName: productName || '',
        productCategory: category || '',
        productSubcategory: subcategory || '',
        productDescription: description || '',
        unitOfMeasurement: unit || '',
        shelfLife: shelfLife || '',
        importDuty: parseInt(importDuty) || 0,
        gstRate: parseInt(gstRate) || 0,
        exportMarket: exportMarket || '',
        importMarket: importMarket || '',
        certificationsRequired: certifications || '',
        qualityStandards: qualityStandards ? qualityStandards.split(',').map(s => s.trim()) : [],
        seasonality: seasonality || '',
        storageCondition: storage || '',
        exportProcedure: exportProcedure || '',
        importProcedure: importProcedure || '',
        tradeRestrictions: tradeRestrictions || 'None',
        documentationRequired: documentation || '',
        minimumPrice: parsePrice(minPrice),
        maximumPrice: parsePrice(maxPrice),
        averagePrice: parsePrice(avgPrice)
    };
}

// Convert all CSV data to products
const newProducts = [];
for (const line of dataLines) {
    if (line.trim()) {
        try {
            const csvRow = parseCSVLine(line);
            const product = convertToProduct(csvRow);
            if (product.hsnCode && product.productName) {
                newProducts.push(product);
            }
        } catch (error) {
            console.log('Error processing line:', line.substring(0, 50) + '...');
        }
    }
}

// Keep only the first 7 original products and add all new products
tradeData.products = tradeData.products.slice(0, 7).concat(newProducts);

// Update metadata
tradeData.metadata.totalProducts = tradeData.products.length;
tradeData.metadata.lastUpdated = new Date().toISOString();
tradeData.metadata.version = '3.0';
tradeData.metadata.description = 'Import/Export trade data with complete CSV integration';

// Write back to file
fs.writeFileSync('trade_data.json', JSON.stringify(tradeData, null, 2));

console.log(`Successfully added ${newProducts.length} products from CSV`);
console.log(`Total products in database: ${tradeData.products.length}`);
console.log('Sample new products:');
newProducts.slice(0, 5).forEach(p => {
    console.log(`- ${p.hsnCode}: ${p.productName}`);
});
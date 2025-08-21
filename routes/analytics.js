const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { products } = require('./products');
const { requirements } = require('./requirements');
const { bids } = require('./bidding');
const { orders } = require('./orders');
const { users } = require('./auth');

const router = express.Router();

// Helper function to get date range
const getDateRange = (period) => {
  const now = new Date();
  const ranges = {
    '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    '90d': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
    '1y': new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  };
  return ranges[period] || ranges['30d'];
};

// Helper function to group data by time period
const groupByTimePeriod = (data, dateField, period = 'daily') => {
  const grouped = {};
  
  data.forEach(item => {
    const date = new Date(item[dateField]);
    let key;
    
    switch (period) {
      case 'daily':
        key = date.toISOString().split('T')[0];
        break;
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'monthly':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      default:
        key = date.toISOString().split('T')[0];
    }
    
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  });
  
  return grouped;
};

// Get dashboard analytics
const getDashboardAnalytics = (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { period = '30d' } = req.query;
    
    const startDate = getDateRange(period);
    
    let analytics = {};
    
    if (userRole === 'exporter') {
      // Exporter analytics
      const exporterProducts = products.filter(p => p.exporterId === userId);
      const exporterBids = bids.filter(b => b.exporterId === userId);
      const exporterOrders = orders.filter(o => o.exporterId === userId);
      
      // Filter by date range
      const recentBids = exporterBids.filter(b => new Date(b.createdAt) >= startDate);
      const recentOrders = exporterOrders.filter(o => new Date(o.createdAt) >= startDate);
      
      analytics = {
        overview: {
          totalProducts: exporterProducts.length,
          activeProducts: exporterProducts.filter(p => p.isActive).length,
          totalBids: exporterBids.length,
          activeBids: exporterBids.filter(b => b.status === 'active').length,
          acceptedBids: exporterBids.filter(b => b.status === 'accepted').length,
          totalOrders: exporterOrders.length,
          activeOrders: exporterOrders.filter(o => o.status === 'active').length,
          completedOrders: exporterOrders.filter(o => o.status === 'completed').length
        },
        
        performance: {
          bidWinRate: exporterBids.length > 0 ? 
            (exporterBids.filter(b => b.status === 'accepted').length / exporterBids.length * 100).toFixed(2) : 0,
          averageOrderValue: exporterOrders.length > 0 ?
            exporterOrders.reduce((sum, o) => sum + (o.totalValue || 0), 0) / exporterOrders.length : 0,
          totalRevenue: exporterOrders
            .filter(o => o.status === 'completed')
            .reduce((sum, o) => sum + (o.totalValue || 0), 0),
          onTimeDeliveryRate: exporterOrders.filter(o => o.status === 'completed').length > 0 ?
            (exporterOrders.filter(o => o.status === 'completed' && 
              new Date(o.phases.delivery.completedAt) <= new Date(o.estimatedDelivery)).length /
             exporterOrders.filter(o => o.status === 'completed').length * 100).toFixed(2) : 0
        },
        
        trends: {
          bidsOverTime: Object.entries(groupByTimePeriod(recentBids, 'createdAt', 'daily'))
            .map(([date, items]) => ({ date, count: items.length })),
          ordersOverTime: Object.entries(groupByTimePeriod(recentOrders, 'createdAt', 'daily'))
            .map(([date, items]) => ({ date, count: items.length, value: items.reduce((sum, o) => sum + (o.totalValue || 0), 0) })),
          productViews: exporterProducts.reduce((sum, p) => sum + (p.views || 0), 0)
        },
        
        topCategories: exporterProducts.reduce((acc, p) => {
          acc[p.category] = (acc[p.category] || 0) + 1;
          return acc;
        }, {}),
        
        recentActivity: [
          ...recentBids.slice(-5).map(b => ({
            type: 'bid',
            action: 'submitted',
            date: b.createdAt,
            description: `Bid submitted for requirement`,
            status: b.status
          })),
          ...recentOrders.slice(-5).map(o => ({
            type: 'order',
            action: 'received',
            date: o.createdAt,
            description: `New order: ${o.title}`,
            status: o.status
          }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10)
      };
      
    } else if (userRole === 'importer') {
      // Importer analytics
      const importerRequirements = requirements.filter(r => r.importerId === userId);
      const importerOrders = orders.filter(o => o.importerId === userId);
      
      // Get bids for importer's requirements
      const requirementIds = importerRequirements.map(r => r.id);
      const importerBids = bids.filter(b => requirementIds.includes(b.requirementId));
      
      // Filter by date range
      const recentRequirements = importerRequirements.filter(r => new Date(r.createdAt) >= startDate);
      const recentOrders = importerOrders.filter(o => new Date(o.createdAt) >= startDate);
      
      analytics = {
        overview: {
          totalRequirements: importerRequirements.length,
          activeRequirements: importerRequirements.filter(r => r.status === 'active').length,
          totalBids: importerBids.length,
          averageBidsPerRequirement: importerRequirements.length > 0 ?
            (importerBids.length / importerRequirements.length).toFixed(1) : 0,
          totalOrders: importerOrders.length,
          activeOrders: importerOrders.filter(o => o.status === 'active').length,
          completedOrders: importerOrders.filter(o => o.status === 'completed').length
        },
        
        performance: {
          requirementFulfillmentRate: importerRequirements.length > 0 ?
            (importerRequirements.filter(r => r.status === 'awarded').length / importerRequirements.length * 100).toFixed(2) : 0,
          averageOrderValue: importerOrders.length > 0 ?
            importerOrders.reduce((sum, o) => sum + (o.totalValue || 0), 0) / importerOrders.length : 0,
          totalSpent: importerOrders
            .filter(o => o.status === 'completed')
            .reduce((sum, o) => sum + (o.totalValue || 0), 0),
          averageDeliveryTime: importerOrders.filter(o => o.status === 'completed').length > 0 ?
            importerOrders
              .filter(o => o.status === 'completed')
              .reduce((sum, o) => {
                const orderDate = new Date(o.createdAt);
                const deliveryDate = new Date(o.phases.delivery.completedAt);
                return sum + (deliveryDate - orderDate) / (1000 * 60 * 60 * 24);
              }, 0) / importerOrders.filter(o => o.status === 'completed').length : 0
        },
        
        trends: {
          requirementsOverTime: Object.entries(groupByTimePeriod(recentRequirements, 'createdAt', 'daily'))
            .map(([date, items]) => ({ date, count: items.length })),
          ordersOverTime: Object.entries(groupByTimePeriod(recentOrders, 'createdAt', 'daily'))
            .map(([date, items]) => ({ date, count: items.length, value: items.reduce((sum, o) => sum + (o.totalValue || 0), 0) })),
          bidActivity: Object.entries(groupByTimePeriod(importerBids, 'createdAt', 'daily'))
            .map(([date, items]) => ({ date, count: items.length }))
        },
        
        topCategories: importerRequirements.reduce((acc, r) => {
          acc[r.category] = (acc[r.category] || 0) + 1;
          return acc;
        }, {}),
        
        recentActivity: [
          ...recentRequirements.slice(-5).map(r => ({
            type: 'requirement',
            action: 'posted',
            date: r.createdAt,
            description: `Requirement posted: ${r.title}`,
            status: r.status
          })),
          ...recentOrders.slice(-5).map(o => ({
            type: 'order',
            action: 'placed',
            date: o.createdAt,
            description: `Order placed: ${o.title}`,
            status: o.status
          }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10)
      };
    }
    
    res.json(analytics);
    
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get detailed product analytics (exporters only)
const getProductAnalytics = (req, res) => {
  try {
    const userId = req.user.userId;
    const { period = '30d', productId } = req.query;
    
    if (req.user.role !== 'exporter') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const startDate = getDateRange(period);
    let exporterProducts = products.filter(p => p.exporterId === userId);
    
    if (productId) {
      exporterProducts = exporterProducts.filter(p => p.id === productId);
    }
    
    const productIds = exporterProducts.map(p => p.id);
    
    // Get requirements that match product categories
    const relatedRequirements = requirements.filter(r => 
      exporterProducts.some(p => p.category === r.category) &&
      new Date(r.createdAt) >= startDate
    );
    
    const analytics = {
      products: exporterProducts.map(product => {
        const productBids = bids.filter(b => 
          b.exporterId === userId && 
          requirements.find(r => r.id === b.requirementId && r.category === product.category)
        );
        
        return {
          id: product.id,
          name: product.name,
          category: product.category,
          views: product.views || 0,
          inquiries: product.inquiries || 0,
          relatedBids: productBids.length,
          acceptedBids: productBids.filter(b => b.status === 'accepted').length,
          conversionRate: productBids.length > 0 ? 
            (productBids.filter(b => b.status === 'accepted').length / productBids.length * 100).toFixed(2) : 0,
          averageBidValue: productBids.length > 0 ?
            productBids.reduce((sum, b) => sum + b.price, 0) / productBids.length : 0
        };
      }),
      
      categoryPerformance: exporterProducts.reduce((acc, product) => {
        const category = product.category;
        if (!acc[category]) {
          acc[category] = {
            products: 0,
            views: 0,
            inquiries: 0,
            bids: 0,
            acceptedBids: 0
          };
        }
        
        acc[category].products++;
        acc[category].views += product.views || 0;
        acc[category].inquiries += product.inquiries || 0;
        
        const categoryBids = bids.filter(b => 
          b.exporterId === userId && 
          requirements.find(r => r.id === b.requirementId && r.category === category)
        );
        
        acc[category].bids += categoryBids.length;
        acc[category].acceptedBids += categoryBids.filter(b => b.status === 'accepted').length;
        
        return acc;
      }, {}),
      
      marketDemand: relatedRequirements.reduce((acc, req) => {
        const category = req.category;
        if (!acc[category]) {
          acc[category] = {
            requirements: 0,
            totalQuantity: 0,
            averageTargetPrice: 0,
            totalBids: 0
          };
        }
        
        acc[category].requirements++;
        acc[category].totalQuantity += req.quantity;
        
        if (req.targetPrice) {
          acc[category].averageTargetPrice = 
            (acc[category].averageTargetPrice * (acc[category].requirements - 1) + req.targetPrice) / acc[category].requirements;
        }
        
        const reqBids = bids.filter(b => b.requirementId === req.id);
        acc[category].totalBids += reqBids.length;
        
        return acc;
      }, {})
    };
    
    res.json(analytics);
    
  } catch (error) {
    console.error('Get product analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get bidding analytics
const getBiddingAnalytics = (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { period = '30d' } = req.query;
    
    const startDate = getDateRange(period);
    
    let analytics = {};
    
    if (userRole === 'exporter') {
      const exporterBids = bids.filter(b => 
        b.exporterId === userId && 
        new Date(b.createdAt) >= startDate
      );
      
      analytics = {
        overview: {
          totalBids: exporterBids.length,
          activeBids: exporterBids.filter(b => b.status === 'active').length,
          acceptedBids: exporterBids.filter(b => b.status === 'accepted').length,
          rejectedBids: exporterBids.filter(b => b.status === 'rejected').length,
          withdrawnBids: exporterBids.filter(b => b.status === 'withdrawn').length
        },
        
        performance: {
          winRate: exporterBids.length > 0 ? 
            (exporterBids.filter(b => b.status === 'accepted').length / exporterBids.length * 100).toFixed(2) : 0,
          averageBidValue: exporterBids.length > 0 ?
            exporterBids.reduce((sum, b) => sum + b.price, 0) / exporterBids.length : 0,
          totalBidValue: exporterBids.reduce((sum, b) => sum + b.price, 0),
          averageDeliveryTime: exporterBids.length > 0 ?
            exporterBids.reduce((sum, b) => {
              const days = b.deliveryTimeUnit === 'days' ? b.deliveryTime :
                          b.deliveryTimeUnit === 'weeks' ? b.deliveryTime * 7 :
                          b.deliveryTime * 30;
              return sum + days;
            }, 0) / exporterBids.length : 0
        },
        
        bidsByCategory: exporterBids.reduce((acc, bid) => {
          const requirement = requirements.find(r => r.id === bid.requirementId);
          if (requirement) {
            const category = requirement.category;
            if (!acc[category]) {
              acc[category] = { total: 0, accepted: 0, winRate: 0 };
            }
            acc[category].total++;
            if (bid.status === 'accepted') {
              acc[category].accepted++;
            }
            acc[category].winRate = (acc[category].accepted / acc[category].total * 100).toFixed(2);
          }
          return acc;
        }, {}),
        
        competitiveAnalysis: exporterBids.map(bid => {
          const requirement = requirements.find(r => r.id === bid.requirementId);
          const allBidsForReq = bids.filter(b => b.requirementId === bid.requirementId);
          
          return {
            bidId: bid.id,
            requirementTitle: requirement ? requirement.title : 'Unknown',
            myBidPrice: bid.price,
            totalBids: allBidsForReq.length,
            lowestBid: Math.min(...allBidsForReq.map(b => b.price)),
            highestBid: Math.max(...allBidsForReq.map(b => b.price)),
            averageBid: allBidsForReq.reduce((sum, b) => sum + b.price, 0) / allBidsForReq.length,
            myRank: allBidsForReq
              .sort((a, b) => a.price - b.price)
              .findIndex(b => b.id === bid.id) + 1,
            status: bid.status
          };
        })
      };
      
    } else if (userRole === 'importer') {
      const importerRequirements = requirements.filter(r => 
        r.importerId === userId && 
        new Date(r.createdAt) >= startDate
      );
      
      const requirementIds = importerRequirements.map(r => r.id);
      const receivedBids = bids.filter(b => requirementIds.includes(b.requirementId));
      
      analytics = {
        overview: {
          totalRequirements: importerRequirements.length,
          totalBidsReceived: receivedBids.length,
          averageBidsPerRequirement: importerRequirements.length > 0 ?
            (receivedBids.length / importerRequirements.length).toFixed(1) : 0,
          acceptedBids: receivedBids.filter(b => b.status === 'accepted').length,
          requirementsAwarded: importerRequirements.filter(r => r.status === 'awarded').length
        },
        
        bidDistribution: importerRequirements.map(req => {
          const reqBids = receivedBids.filter(b => b.requirementId === req.id);
          
          return {
            requirementId: req.id,
            title: req.title,
            category: req.category,
            targetPrice: req.targetPrice,
            bidsReceived: reqBids.length,
            lowestBid: reqBids.length > 0 ? Math.min(...reqBids.map(b => b.price)) : null,
            highestBid: reqBids.length > 0 ? Math.max(...reqBids.map(b => b.price)) : null,
            averageBid: reqBids.length > 0 ? 
              reqBids.reduce((sum, b) => sum + b.price, 0) / reqBids.length : null,
            acceptedBid: reqBids.find(b => b.status === 'accepted'),
            status: req.status
          };
        }),
        
        supplierAnalysis: receivedBids.reduce((acc, bid) => {
          const exporterId = bid.exporterId;
          const exporter = users.find(u => u.id === exporterId);
          
          if (!acc[exporterId]) {
            acc[exporterId] = {
              exporterName: exporter ? exporter.profile.companyName : 'Unknown',
              totalBids: 0,
              acceptedBids: 0,
              averageBidPrice: 0,
              averageDeliveryTime: 0,
              winRate: 0
            };
          }
          
          acc[exporterId].totalBids++;
          if (bid.status === 'accepted') {
            acc[exporterId].acceptedBids++;
          }
          
          acc[exporterId].averageBidPrice = 
            (acc[exporterId].averageBidPrice * (acc[exporterId].totalBids - 1) + bid.price) / acc[exporterId].totalBids;
          
          const deliveryDays = bid.deliveryTimeUnit === 'days' ? bid.deliveryTime :
                              bid.deliveryTimeUnit === 'weeks' ? bid.deliveryTime * 7 :
                              bid.deliveryTime * 30;
          
          acc[exporterId].averageDeliveryTime = 
            (acc[exporterId].averageDeliveryTime * (acc[exporterId].totalBids - 1) + deliveryDays) / acc[exporterId].totalBids;
          
          acc[exporterId].winRate = (acc[exporterId].acceptedBids / acc[exporterId].totalBids * 100).toFixed(2);
          
          return acc;
        }, {})
      };
    }
    
    res.json(analytics);
    
  } catch (error) {
    console.error('Get bidding analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get market insights
const getMarketInsights = (req, res) => {
  try {
    const { category, period = '30d' } = req.query;
    const startDate = getDateRange(period);
    
    let filteredRequirements = requirements.filter(r => new Date(r.createdAt) >= startDate);
    let filteredProducts = products.filter(p => new Date(p.createdAt) >= startDate);
    let filteredBids = bids.filter(b => new Date(b.createdAt) >= startDate);
    
    if (category) {
      filteredRequirements = filteredRequirements.filter(r => r.category === category);
      filteredProducts = filteredProducts.filter(p => p.category === category);
      
      const categoryRequirementIds = filteredRequirements.map(r => r.id);
      filteredBids = filteredBids.filter(b => categoryRequirementIds.includes(b.requirementId));
    }
    
    const insights = {
      marketOverview: {
        totalRequirements: filteredRequirements.length,
        totalProducts: filteredProducts.length,
        totalBids: filteredBids.length,
        averageBidsPerRequirement: filteredRequirements.length > 0 ?
          (filteredBids.length / filteredRequirements.length).toFixed(1) : 0,
        marketActivity: filteredRequirements.length + filteredProducts.length + filteredBids.length
      },
      
      priceAnalysis: {
        averageRequirementValue: filteredRequirements
          .filter(r => r.targetPrice)
          .reduce((sum, r) => sum + (r.targetPrice * r.quantity), 0) / 
          Math.max(filteredRequirements.filter(r => r.targetPrice).length, 1),
        
        averageBidValue: filteredBids.length > 0 ?
          filteredBids.reduce((sum, b) => {
            const req = requirements.find(r => r.id === b.requirementId);
            return sum + (b.price * (req ? req.quantity : 1));
          }, 0) / filteredBids.length : 0,
        
        priceRanges: filteredBids.reduce((acc, bid) => {
          const price = bid.price;
          let range;
          
          if (price < 1000) range = '0-1K';
          else if (price < 10000) range = '1K-10K';
          else if (price < 100000) range = '10K-100K';
          else range = '100K+';
          
          acc[range] = (acc[range] || 0) + 1;
          return acc;
        }, {})
      },
      
      categoryTrends: Object.keys(
        [...filteredRequirements, ...filteredProducts].reduce((acc, item) => {
          acc[item.category] = true;
          return acc;
        }, {})
      ).map(cat => {
        const catRequirements = filteredRequirements.filter(r => r.category === cat);
        const catProducts = filteredProducts.filter(p => p.category === cat);
        const catBids = filteredBids.filter(b => {
          const req = requirements.find(r => r.id === b.requirementId);
          return req && req.category === cat;
        });
        
        return {
          category: cat,
          demand: catRequirements.length,
          supply: catProducts.length,
          competition: catBids.length,
          demandSupplyRatio: catProducts.length > 0 ? 
            (catRequirements.length / catProducts.length).toFixed(2) : 'N/A',
          averageCompetition: catRequirements.length > 0 ?
            (catBids.length / catRequirements.length).toFixed(1) : 0
        };
      }),
      
      geographicDistribution: {
        topDeliveryLocations: filteredRequirements.reduce((acc, req) => {
          const location = req.deliveryLocation;
          acc[location] = (acc[location] || 0) + 1;
          return acc;
        }, {}),
        
        topOrigins: filteredProducts.reduce((acc, prod) => {
          const origin = prod.origin;
          acc[origin] = (acc[origin] || 0) + 1;
          return acc;
        }, {})
      },
      
      timeAnalysis: {
        requirementTrends: Object.entries(groupByTimePeriod(filteredRequirements, 'createdAt', 'daily'))
          .map(([date, items]) => ({ date, count: items.length })),
        
        bidTrends: Object.entries(groupByTimePeriod(filteredBids, 'createdAt', 'daily'))
          .map(([date, items]) => ({ date, count: items.length })),
        
        averageResponseTime: filteredBids.length > 0 ?
          filteredBids.reduce((sum, bid) => {
            const req = requirements.find(r => r.id === bid.requirementId);
            if (req) {
              const reqDate = new Date(req.createdAt);
              const bidDate = new Date(bid.createdAt);
              return sum + (bidDate - reqDate) / (1000 * 60 * 60); // hours
            }
            return sum;
          }, 0) / filteredBids.length : 0
      }
    };
    
    res.json(insights);
    
  } catch (error) {
    console.error('Get market insights error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Export data as CSV
const exportData = (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { type, format = 'csv' } = req.query;
    
    if (format !== 'csv') {
      return res.status(400).json({ error: 'Only CSV format is supported' });
    }
    
    let data = [];
    let filename = '';
    let headers = [];
    
    switch (type) {
      case 'orders':
        data = orders.filter(o => o.exporterId === userId || o.importerId === userId);
        filename = 'orders.csv';
        headers = ['ID', 'Title', 'Category', 'Quantity', 'Price', 'Currency', 'Status', 'Phase', 'Created At'];
        data = data.map(o => [
          o.id, o.title, o.category, o.quantity, o.price, o.currency, 
          o.status, o.currentPhase, o.createdAt
        ]);
        break;
        
      case 'bids':
        if (userRole === 'exporter') {
          data = bids.filter(b => b.exporterId === userId);
          filename = 'my_bids.csv';
          headers = ['ID', 'Requirement ID', 'Price', 'Currency', 'Delivery Time', 'Status', 'Created At'];
          data = data.map(b => [
            b.id, b.requirementId, b.price, b.currency, 
            `${b.deliveryTime} ${b.deliveryTimeUnit}`, b.status, b.createdAt
          ]);
        } else {
          const importerRequirements = requirements.filter(r => r.importerId === userId);
          const requirementIds = importerRequirements.map(r => r.id);
          data = bids.filter(b => requirementIds.includes(b.requirementId));
          filename = 'received_bids.csv';
          headers = ['ID', 'Requirement ID', 'Exporter ID', 'Price', 'Currency', 'Delivery Time', 'Status', 'Created At'];
          data = data.map(b => [
            b.id, b.requirementId, b.exporterId, b.price, b.currency,
            `${b.deliveryTime} ${b.deliveryTimeUnit}`, b.status, b.createdAt
          ]);
        }
        break;
        
      case 'products':
        if (userRole !== 'exporter') {
          return res.status(403).json({ error: 'Access denied' });
        }
        data = products.filter(p => p.exporterId === userId);
        filename = 'products.csv';
        headers = ['ID', 'Name', 'Category', 'Price', 'Currency', 'MOQ', 'Unit', 'Origin', 'Active', 'Created At'];
        data = data.map(p => [
          p.id, p.name, p.category, p.price, p.currency, 
          p.minimumOrderQuantity, p.unit, p.origin, p.isActive, p.createdAt
        ]);
        break;
        
      case 'requirements':
        if (userRole !== 'importer') {
          return res.status(403).json({ error: 'Access denied' });
        }
        data = requirements.filter(r => r.importerId === userId);
        filename = 'requirements.csv';
        headers = ['ID', 'Title', 'Category', 'Quantity', 'Unit', 'Target Price', 'Currency', 'Status', 'Created At'];
        data = data.map(r => [
          r.id, r.title, r.category, r.quantity, r.unit, 
          r.targetPrice || '', r.currency, r.status, r.createdAt
        ]);
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }
    
    // Convert to CSV format
    const csvContent = [headers, ...data]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
    
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Define routes
router.get('/dashboard', authenticateToken, getDashboardAnalytics);
router.get('/products', authenticateToken, requireRole('exporter'), getProductAnalytics);
router.get('/bidding', authenticateToken, getBiddingAnalytics);
router.get('/market', authenticateToken, getMarketInsights);
router.get('/export', authenticateToken, exportData);

// Export router
module.exports = router;
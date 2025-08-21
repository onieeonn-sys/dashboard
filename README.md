# Import-Export Search Platform

A comprehensive web application for connecting importers and exporters, facilitating trade relationships through product listings, requirement postings, and bidding systems.

## Features

### Core Functionality
- **User Authentication**: Secure registration and login system with JWT tokens
- **Role-based Access**: Separate interfaces for exporters and importers
- **Product Management**: Exporters can list products with detailed specifications
- **Requirement Posting**: Importers can post trade requirements
- **Bidding System**: Interactive bidding on trade requirements
- **Analytics Dashboard**: Real-time insights and activity tracking
- **External Trade API**: Integration with external trade platforms

### User Roles
- **Exporters**: Can list products, view requirements, and submit bids
- **Importers**: Can post requirements, view products, and manage bids

## Technology Stack

- **Backend**: Node.js with Express.js
- **Frontend**: Vanilla JavaScript with modern ES6+ features
- **Authentication**: JWT (JSON Web Tokens)
- **Styling**: Custom CSS with responsive design
- **Charts**: Chart.js for analytics visualization
- **Icons**: Font Awesome

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/import-export-search.git
   cd import-export-search
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Access the application**
   - Open your browser and navigate to `http://localhost:3000`
   - Register as either an exporter or importer
   - Start exploring the platform!

## Project Structure

```
import-export-search/
├── public/                 # Frontend files
│   ├── index.html         # Main HTML file
│   ├── app.js            # Frontend JavaScript
│   └── styles.css        # CSS styles
├── routes/               # API routes
│   ├── auth.js          # Authentication routes
│   ├── products.js      # Product management
│   ├── requirements.js  # Requirement management
│   ├── bidding.js       # Bidding system
│   ├── analytics.js     # Analytics data
│   └── users.js         # User management
├── middleware/          # Express middleware
│   └── auth.js         # Authentication middleware
├── server.js           # Main server file
├── package.json        # Dependencies and scripts
└── README.md          # Project documentation
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile

### Products
- `GET /api/products` - Get all products
- `POST /api/products` - Create new product (exporters only)
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Requirements
- `GET /api/requirements` - Get all requirements
- `POST /api/requirements` - Create new requirement (importers only)
- `PUT /api/requirements/:id` - Update requirement
- `DELETE /api/requirements/:id` - Delete requirement

### Bidding
- `GET /api/bidding/:requirementId` - Get bids for requirement
- `POST /api/bidding/:requirementId` - Submit bid

### Analytics
- `GET /api/analytics` - Get dashboard analytics

## Features in Detail

### Dashboard
- Role-specific analytics and insights
- Recent activity tracking
- Quick access to key functions
- External trade API integration

### Product Management
- Detailed product listings with specifications
- Image upload support
- Category and pricing management
- Search and filter capabilities

### Requirement System
- Detailed requirement specifications
- Deadline management
- Bid collection and evaluation
- Status tracking

### Bidding Platform
- Competitive bidding environment
- Real-time bid updates
- Bid comparison tools
- Communication features

## Deployment

### Local Development
The application runs on `http://localhost:3000` by default.

### Production Deployment
The application is configured for deployment on platforms like:
- Render.com
- Heroku
- Railway
- Vercel

See `render.yaml` for Render-specific deployment configuration.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please open an issue in the GitHub repository.

## External Integrations

- **Trade API Platform**: `https://trade-api-swhi.onrender.com/`
- **Chart.js**: For analytics visualization
- **Font Awesome**: For icons and UI elements

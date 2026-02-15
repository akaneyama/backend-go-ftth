# FTTH Management System

This project is a full-stack application designed to manage Fiber to the Home (FTTH) infrastructure and services. It provides a comprehensive dashboard for monitoring network interfaces, managing routers, tracking internet traffic, handling internet packages, and administering user accounts.

The project is divided into two main components: a Go-based backend API and a React-based frontend web application.

## Project Structure

- `ftth-be/`: Contains the backend API written in Go.
- `ftth-fe/`: Contains the frontend web application built with React.

## Backend (ftth-be)

The backend is developed using Go and provides a robust API for handling all data and business logic related to FTTH management.

### Key Features:
- User Authentication and Authorization (JWT)
- Router Management (potentially integrating with Mikrotik devices)
- Network Interface Monitoring
- Internet Traffic Data Management
- Internet Package Configuration
- Logging and Scheduled Tasks

### Technologies Used:
- **Go**: Primary programming language.
- **Fiber**: Fast HTTP web framework for Go.
- **GORM**: ORM library for database interaction.
- **MySQL**: Relational database for data storage.
- **JWT (GoFiber JWT)**: For secure authentication.
- **go-routeros**: Library for interacting with MikroTik RouterOS devices.
- **cron**: For scheduling periodic tasks (e.g., data synchronization, monitoring).
- **godotenv**: For managing environment variables.
- **golang.org/x/crypto**: For cryptographic operations (e.g., password hashing).

## Frontend (ftth-fe)

The frontend is a modern, responsive web application built with React, providing an intuitive user interface for interacting with the backend services.

### Key Features:
- User-friendly Dashboard for overview.
- Login and Register screens.
- Management screens for:
    - Network Interfaces
    - Routers
    - Internet Traffic Visualization
    - Internet Packages
    - User Accounts
- Internationalization support.
- Interactive mapping capabilities.
- Data visualization through charts.
- Animated and responsive UI.

### Technologies Used:
- **React**: JavaScript library for building user interfaces.
- **Vite**: Fast frontend development build tool.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Framer Motion**: Library for animations.
- **Axios**: Promise-based HTTP client for API requests.
- **React Router DOM**: For declarative routing in React applications.
- **Leaflet & React-Leaflet**: Interactive maps and geospatial data visualization.
- **Recharts**: Composable charting library.
- **i18next & React-i18next**: For internationalization (i18n).
- **SweetAlert2**: For custom alerts and dialogs.
- **html2canvas & jsPDF**: For generating images and PDFs from web content.
- **Headless UI**: Unstyled, accessible UI components.

## Setup (General Guidelines)

### Backend Setup:
1. Navigate to the `ftth-be/` directory.
2. Set up your `.env` file based on `.env-example` with your database connection details and other configurations.
3. Install Go dependencies: `go mod tidy`
4. Run database migrations (if any).
5. Start the backend server.

### Frontend Setup:
1. Navigate to the `ftth-fe/` directory.
2. Install Node.js dependencies: `npm install` or `yarn install`
3. Configure API endpoint in environment variables (e.g., `.env` file).
4. Start the development server.

Detailed setup instructions for development and deployment can be found in their respective directories.

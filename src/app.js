import express from "express";
import morgan from "morgan";
import logger from "./utils/logger.js";

class App {
  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  initializeMiddlewares() {
    // Middleware to parse JSON request bodies
    this.app.use(express.json());

    // Middleware to parse URL-encoded request bodies
    this.app.use(express.urlencoded({ extended: true }));

    // Connect Morgan to our Winston logger stream
    const morganFormat = ':method :url :status :res[content-length] - :response-time ms';
    this.app.use(morgan(morganFormat, { stream: logger.stream }));
  }

  initializeRoutes() {
    this.app.get("/", (req, res) => {
      res.status(200).json({
        status: "OK",
        message: "Server is running",
        timestamp: new Date().toISOString(),
      });
    });

    // Health check route
    this.app.get("/health", (req, res) => {
      res.status(200).json({
        status: "OK",
        message: "Server is running",
        timestamp: new Date().toISOString(),
      });
    });

    // Example of where your modular routes will be injected:
    // import userRoutes from './routes/user.routes.js';
    // this.app.use('/api/users', userRoutes);
  }

  initializeErrorHandling() {
    // 404 handler - catch all undefined routes
    this.app.use((req, res) => {
      // Log the 404 warning
      logger.error(`404 Not Found - ${req.originalUrl}`);
      
      res.status(404).json({
        error: "Not Found",
        message: "The requested resource does not exist",
      });
    });

    // Global error handler
    this.app.use((err, req, res, next) => {
      // Log the actual system error and stack trace to your Winston file
      logger.error(`Server Error: ${err.message} \nStack: ${err.stack}`);

      res.status(err.status || 500).json({
        error: err.message || "Internal Server Error",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
      });
    });
  }
}

// Instantiate and export the express app directly.
// This keeps it perfectly compatible with your server.js file.
export default new App().app;
import serverless from "serverless-http";
import express from "express";
import { registerRoutes } from "../../server/routes";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize routes WITHOUT top-level await
function initRoutes() {
    registerRoutes(httpServer, app);
}

initRoutes();

export const handler = serverless(app);
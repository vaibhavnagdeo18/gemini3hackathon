import serverless from "serverless-http";
import express from "express";
import { registerRoutes } from "../../server/routes";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize routes
// Note: registerRoutes returns a Promise<Server> but we just need it to attach routes to 'app'
await registerRoutes(httpServer, app);

export const handler = serverless(app);

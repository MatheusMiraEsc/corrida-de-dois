/**
 * Monta a aplicação Express (HTTP). O WebSocket é acoplado em server.ts.
 */
import cors from "cors";
import express from "express";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { isOriginAllowed, securityHeaders } from "./middlewares/security";
import { buildRoutes, type RouteDependencies } from "./routes";

export interface AppOptions extends RouteDependencies {
  corsOrigins: string[];
}

export function createApp(options: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // atrás de proxy (Render, Railway...) usa o IP real do cliente

  app.use(securityHeaders);
  app.use(
    cors({
      origin: (origin, callback) => callback(null, isOriginAllowed(origin, options.corsOrigins)),
      methods: ["GET", "POST", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json({ limit: "10kb" }));

  app.use("/api", buildRoutes(options));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

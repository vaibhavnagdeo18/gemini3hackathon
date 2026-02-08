import type { Express } from "express";
import type { Server } from "http";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  console.log("✅ Routes registered");

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // THE NEW N8N INTEGRATION ROUTE
  app.post("/api/analyze-architecture", async (req, res) => {
    try {
      console.log("⚡ Sending request to n8n...");

      // 1. Prepare data for n8n
      const n8nPayload = {
        description: req.body.description || "No description",
        budget: req.body.budget,
        users: req.body.users,
        uptime: req.body.uptime
      };

      // 2. Call n8n Webhook
      // 👇 Your actual working ngrok URL
      const N8N_URL = "https://dorris-unhashed-subarticulately.ngrok-free.dev/webhook/analyze-architecture";

      console.log(`⚡ Connecting to AI Brain at: ${N8N_URL}`);

      const response = await fetch(N8N_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // 👇 CRITICAL: Bypasses the ngrok warning page
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify(n8nPayload)
      });

      if (!response.ok) {
        throw new Error(`n8n Error: ${response.statusText}`);
      }

      const rawData = await response.json();
      console.log("📦 Received from n8n:", JSON.stringify(rawData).slice(0, 100) + "...");

      // 3. Handle n8n Array vs Object format
      const n8nItem = Array.isArray(rawData) ? rawData[0] : rawData;
      let data = n8nItem.json ? n8nItem.json : n8nItem;

      // Handle Gemini nested structure if present (content.parts[0].text)
      if (data.content?.parts?.[0]?.text) {
        try {
          const text = data.content.parts[0].text;
          const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || [null, text];
          const cleanJson = jsonMatch[1].trim();
          data = JSON.parse(cleanJson);
        } catch (e) {
          console.error("⚠️ Failed to parse deep nested JSON", e);
        }
      }

      console.log("🔍 N8N Data Keys:", Object.keys(data));
      const rawRisk = data.riskScore || data.score || 0;
      const riskScore = 100 - rawRisk;
      const rawDiagram = data.architectureDiagram || data.diagram || data.mermaid || "";
      console.log("Risk:", riskScore, "Diagram Size:", rawDiagram.length);

      // 4. Transform to match your UI's expected format
      const findCost = (obj: any): string => {
        if (!obj) return "N/A";
        // Check standard keys
        const keys = ["monthlyCost", "cost", "estimatedCost", "estimatedMonthlyCost", "total_cost", "totalCost", "budget"];
        for (const key of keys) {
          if (obj[key] && obj[key] !== "N/A") return String(obj[key]);
        }
        // Check nested objects
        if (obj.analysis && typeof obj.analysis === 'object') return findCost(obj.analysis);
        if (obj.consensus && typeof obj.consensus === 'object') return findCost(obj.consensus);
        if (obj.costAgent && typeof obj.costAgent === 'object') return findCost(obj.costAgent);

        return "N/A";
      };

      const finalCost = findCost(data);
      console.log("💰 Determined Cost:", finalCost);

      const uiResponse = {
        riskScore: riskScore,
        monthlyCost: finalCost,
        architectureDiagram: rawDiagram,

        // Map n8n findings to specific Agent Card reasoning
        agentData: [
          {
            agentName: "Performance Agent",
            reasoning: data.reasoning || `Optimization recommendations: ${(data.recommendations || []).join(", ")}`
          },
          {
            agentName: "Cost Agent",
            reasoning: `Estimated Monthly Cost: ${finalCost}.`
          },
          {
            agentName: "Reliability Agent",
            reasoning: `System Risks: ${(data.keyFindings || data.bottlenecks || []).join(", ")}`
          },
          {
            agentName: "Consensus Engine",
            reasoning: data.reasoning || data.synthesis || data.summary || "Final architectural synthesis complete. View report for details."
          }
        ],

        // Fill the text boxes
        bottlenecks: data.keyFindings || data.bottlenecks || [],
        suggestedImprovements: data.recommendations || data.improvements || [],
        securityRisks: data.securityRisks || [],
        scalabilityLimits: data.scalabilityLimits || [],
        spof: data.spof || [],
        reasoning: data.reasoning || ""
      };

      console.log("🏁 SENDING FINAL UI RESPONSE:", JSON.stringify(uiResponse, null, 2));
      res.json(uiResponse);

    } catch (err) {
      console.error("❌ Analysis failed:", err);
      res.status(500).json({ error: "Analysis failed", details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Keep compatibility for both endpoints
  app.post("/api/analyze", async (req, res) => {
    // Forward /api/analyze to the same logic
    try {
      // Re-use logic or essentially call the same handler
      // For simplicity, we can just redirect or re-run the same code block.
      // But since we are already inside registerRoutes, let's just make sure it's a POST.
      const n8nPayload = {
        description: req.body.description || "No description",
        budget: req.body.budget,
        users: req.body.users,
        uptime: req.body.uptime
      };

      const N8N_URL = process.env.N8N_WEBHOOK_URL || "";

      if (!N8N_URL) {
        console.error("❌ N8N_WEBHOOK_URL is missing in environment variables");
        res.status(500).json({
          error: "Configuration Error",
          details: "N8N_WEBHOOK_URL environment variable is not set with a valid URL. Please check server configuration."
        });
        return;
      }

      console.log(`⚡ Sending request to N8N at: ${N8N_URL}`);

      const response = await fetch(N8N_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(n8nPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ n8n Error (${response.status}): ${errorText}`);
        throw new Error(`n8n Error (${response.status}): ${errorText}`);
      }

      const rawData = await response.json();
      console.log("📦 RAW N8N RESPONSE (/api/analyze):", JSON.stringify(rawData, null, 2)); // DEBUG LOG
      const n8nItem = Array.isArray(rawData) ? rawData[0] : rawData;
      let data = n8nItem.json ? n8nItem.json : n8nItem;

      // Gemini/Nested parsing
      if (data.content?.parts?.[0]?.text) {
        try {
          const text = data.content.parts[0].text;
          const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || [null, text];
          data = JSON.parse(jsonMatch[1].trim());
        } catch (e) {
          console.error("⚠️ Failed to parse deep nested JSON from Gemini", e);
        }
      }

      // 4. Transform to match your UI's expected format
      const findCost = (obj: any): string => {
        if (!obj) return "N/A";
        // Check standard keys
        const keys = ["monthlyCost", "cost", "estimatedCost", "estimatedMonthlyCost", "total_cost", "totalCost", "budget"];
        for (const key of keys) {
          if (obj[key] && obj[key] !== "N/A") return String(obj[key]);
        }
        // Check nested objects
        if (obj.analysis && typeof obj.analysis === 'object') return findCost(obj.analysis);
        if (obj.consensus && typeof obj.consensus === 'object') return findCost(obj.consensus);
        if (obj.costAgent && typeof obj.costAgent === 'object') return findCost(obj.costAgent);

        return "N/A";
      };

      const finalCost = findCost(data);
      const rawDiagram = data.architectureDiagram || data.diagram || data.mermaid || "";
      const riskScore = 100 - (data.riskScore || data.score || 0);

      const uiResponse = {
        riskScore: riskScore,
        monthlyCost: finalCost,
        architectureDiagram: rawDiagram,
        agentData: [
          {
            agentName: "Performance Agent",
            reasoning: data.reasoning || `Optimization recommendations: ${(data.recommendations || []).join(", ")}`
          },
          {
            agentName: "Cost Agent",
            reasoning: `Estimated Monthly Cost: ${finalCost}. ${Array.isArray(data.keyFindings) ? data.keyFindings.join(" ") : (data.keyFindings || "")} ${Array.isArray(data.recommendations) ? data.recommendations.join(" ") : (data.recommendations || "")}`.trim()
          },
          {
            agentName: "Reliability Agent",
            reasoning: `System Risks: ${(data.keyFindings || data.bottlenecks || []).join(", ")}`
          },
          {
            agentName: "Consensus Agent",
            reasoning: data.reasoning || data.synthesis || data.summary || "Final architectural synthesis complete. View report for details."
          }
        ],
        bottlenecks: data.keyFindings || data.bottlenecks || [],
        suggestedImprovements: data.recommendations || data.improvements || []
      };

      console.log("🏁 SENDING FINAL UI RESPONSE (/api/analyze):", JSON.stringify(uiResponse, null, 2));
      res.json(uiResponse);
    } catch (err) {
      console.error("❌ Analysis failed:", err);
      // Ensure we don't try to send another response if one was already sent (though return above handles the missing url case)
      if (!res.headersSent) {
        res.status(500).json({ error: "Analysis failed", details: String(err) });
      }
    }
  });

  return httpServer;
}
import "dotenv/config";

async function testN8N() {
    const n8nUrl = process.env.N8N_WEBHOOK_URL;

    console.log("--- N8N Connectivity Debugger ---");
    console.log(`1. Checking Env Var: ${n8nUrl ? "Found" : "MISSING"}`);

    if (!n8nUrl) {
        console.error("❌ N8N_WEBHOOK_URL is not set in .env or environment.");
        return;
    }

    console.log(`2. Target URL: ${n8nUrl}`);

    try {
        console.log("3. Sending test request...");
        const response = await fetch(n8nUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                description: "Debug Probe",
                budget: "1000",
                users: "100",
                uptime: "99.9"
            })
        });

        console.log(`4. Response Status: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log(`5. Response Body: ${text.slice(0, 500)}`);

        if (response.ok) {
            console.log("✅ Connection Successful!");
        } else {
            console.error("❌ Request Failed.");
        }

    } catch (error) {
        console.error("❌ Network Error:", error);
        if (error.cause) console.error("   Cause:", error.cause);
    }
}

testN8N();

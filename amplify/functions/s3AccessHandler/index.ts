// amplify/functions/s3AccessHandler/index.ts
import { APIGatewayProxyHandler } from "aws-lambda";
import sql from "mssql";

// Build SQL config from env vars
const sqlConfig: sql.config = {
    user: process.env.DB_USER ?? "",
    password: process.env.DB_PASS ?? "",
    database: process.env.DB_NAME ?? "",
    server: process.env.DB_HOST ?? "",
    options: {
        encrypt: true, // required for Azure SQL, safe for others
        trustServerCertificate: true, // change to false if using a valid CA cert
    },
};

export const handler: APIGatewayProxyHandler = async (event) => {
    let pool: sql.ConnectionPool | null = null;

    try {
        console.log("Connecting to SQL Server...");
        pool = await sql.connect(sqlConfig);

        console.log("Running query...");
        // Example: parameterized query
        const request = pool.request();
        // request.input("userId", sql.Int, 123); // if you need params
        const result = await request.query("SELECT TOP 10 * FROM SomeTable");

        console.log("Query succeeded:", result.recordset);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                data: result.recordset,
            }),
        };
    } catch (err: any) {
        console.error("SQL error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: err.message ?? "Unknown error",
            }),
        };
    } finally {
        if (pool) {
            try {
                await pool.close(); // ✅ closes the pool safely
                console.log("SQL connection closed.");
            } catch (closeErr) {
                console.warn("Error closing SQL connection:", closeErr);
            }
        }
    }
};

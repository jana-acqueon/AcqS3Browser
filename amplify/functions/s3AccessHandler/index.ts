import { APIGatewayProxyHandler } from "aws-lambda";
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { jwtDecode } from "jwt-decode";
import sql from "mssql";

// 🔹 Define JWT token structure
interface DecodedToken {
    "cognito:groups"?: string[];
    [key: string]: any;
}

// 🔹 Define SQL row structure
interface RuleRow {
    group: string;
    folder: string;
    permissions: string; // comma-separated: "get,list,write,delete"
}

const s3 = new S3Client({ region: process.env.MY_CUSTOM_BUCKET_REGION });

const sqlConfig: sql.config = {
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    server: process.env.DB_HOST!,
    database: process.env.DB_NAME!,
    options: {
        encrypt: true,
        trustServerCertificate: false,
    },
};

export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        // 🔹 1. Decode user groups from JWT
        const token = event.headers.Authorization?.split(" ")[1];
        if (!token) {
            return { statusCode: 401, body: "Unauthorized - missing token" };
        }

        const decoded = jwtDecode<DecodedToken>(token);
        const userGroups = decoded["cognito:groups"] ?? [];

        // 🔹 2. Fetch rules from SQL Server
        const pool = await sql.connect(sqlConfig);
        const result = await pool.request().query<RuleRow>(
            "SELECT [group], [folder], [permissions] FROM access_rules"
        );

        const rules: RuleRow[] = result.recordset;

        // 🔹 3. Extract requested object info
        const body = event.body ? JSON.parse(event.body) : {};
        const { key, operation } = body;

        if (!key || !operation) {
            return { statusCode: 400, body: "Missing key or operation" };
        }

        // 🔹 4. Match rules for this user
        const matchingRules = rules.filter((rule: RuleRow) =>
            userGroups.includes(rule.group) && key.startsWith(rule.folder)
        );

        if (matchingRules.length === 0) {
            return { statusCode: 403, body: "Access denied" };
        }

        // 🔹 5. Check if operation is allowed
        const isAllowed = matchingRules.some((rule: RuleRow) =>
            rule.permissions.split(",").map(p => p.trim().toLowerCase()).includes(operation.toLowerCase())
        );

        if (!isAllowed) {
            return { statusCode: 403, body: "Operation not allowed" };
        }

        // 🔹 6. Generate pre-signed URL
        let command;
        switch (operation) {
            case "get":
                command = new GetObjectCommand({
                    Bucket: process.env.MY_CUSTOM_BUCKET_NAME,
                    Key: key,
                });
                break;
            case "put":
                command = new PutObjectCommand({
                    Bucket: process.env.MY_CUSTOM_BUCKET_NAME,
                    Key: key,
                });
                break;
            case "delete":
                command = new DeleteObjectCommand({
                    Bucket: process.env.MY_CUSTOM_BUCKET_NAME,
                    Key: key,
                });
                break;
            default:
                return { statusCode: 400, body: "Invalid operation" };
        }

        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

        return {
            statusCode: 200,
            body: JSON.stringify({ url }),
        };

    } catch (err: any) {
        console.error("Error in Lambda:", err);
        return { statusCode: 500, body: "Internal Server Error" };
    }
};

// amplify/accessConfig.ts

export interface AccessRule {
  path: string;
  permissions: Array<"get" | "list" | "write" | "delete">;
}

export const accessConfig: Record<string, AccessRule[]> = {
  // Full CRUD access to IMServUAT folder
  Administrator: [
    {
      path: "IMServUAT/*",
      permissions: ["get", "list", "write", "delete"],
    },
  ],

  // Read + Write, but no delete in IMServUAT folder
  Contributor: [
    {
      path: "IMServUAT/*",
      permissions: ["get", "list", "write"],
    },
  ],

  // Limited access
  LimitedContributor: [
    // Root-level files only (not subfolders)
    {
      path: "", // ✅ empty path = root-level objects
      permissions: ["get", "list"],
    },
    // PreProcAutoupload subfolder
    {
      path: "IMServUAT/PreProcAutoupload/*",
      permissions: ["get", "list", "write"],
    },
    // DataExtract subfolder
    {
      path: "IMServUAT/DataExtract/*",
      permissions: ["get", "list", "write"],
    },
  ],
};

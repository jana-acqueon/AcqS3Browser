// amplify/accessConfig.ts

export interface AccessRule {
  path: string;
  permissions: Array<"get" | "list" | "write" | "delete">;
}

export const accessConfig: Record<string, AccessRule[]> = {
  // Full CRUD access to IMServUAT folder and subfolders
  Administrator: [
    {
      path: "IMServUAT/*",
      permissions: ["get", "list", "write", "delete"],
    },
  ],

  // Read/write access but no delete
  Contributor: [
    {
      path: "IMServUAT/*",
      permissions: ["get", "list", "write"],
    },
  ],

  // Limited: can view root-level files + RW access to 2 subfolders (no delete)
  LimitedContributor: [
    {
      path: "", // root-level (bucket directly, no prefix)
      permissions: ["list", "get"],
    },
    {
      path: "IMServUAT/PreProcAutoupload/*",
      permissions: ["get", "list", "write"],
    },
    {
      path: "IMServUAT/DataExtract/*",
      permissions: ["get", "list", "write"],
    },
  ],
};
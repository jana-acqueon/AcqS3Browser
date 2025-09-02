// amplify/accessConfig.ts

// Defines the shape of your access rules for type safety
export interface AccessRule {
  path: string;
  permissions: Array<"get" | "list" | "write" | "delete">;
}

export const accessConfig: Record<string, AccessRule[]> = {
  // Users in this group get full CRUD access to the IMServUAT folder.
  Administrator: [
    {
      path: "IMServUAT/*",
      permissions: ["get", "list", "write", "delete"],
    },
  ],
  // Users in this group have read and write access, but cannot delete.
  Contributor: [
    {
      path: "IMServUAT/*",
      permissions: ["get", "list", "write"],
    }
  ],
  // Users in this group have read/write access to specific sub-folders and can view top-level files.
  LimitedContributor: [
    {
      path: "*",
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
    // This permission allows users to list and get files directly at the bucket's root level.
  ],
};
// amplify/accessConfig.ts

export interface AccessRule {
  path: string;
  permissions: Array<"get" | "list" | "write" | "delete">;
}

export const accessConfig: Record<string, AccessRule[]> = {
  // Full CRUD access to IMServUAT folder and subfolders
  Administrator: [
    // {
    //   // Grant list permission on the root to see folders
    //   path: "",
    //   permissions: ["list"],
    // },
    {
      path: "IMServUAT/*",
      permissions: ["get", "list", "write", "delete"],
    },
  ],

  // Read/write access but no delete
  Contributor: [
    // {
    //   // Grant list permission on the root to see folders
    //   path: "",
    //   permissions: ["list"],
    // },
    {
      path: "IMServUAT/*",
      permissions: ["get", "list", "write"],
    },
  ],

  // Limited: RW access to 2 subfolders + view root-level files.
  LimitedContributor: [
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
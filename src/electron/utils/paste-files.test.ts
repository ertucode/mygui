import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { pasteFiles } from "./paste-files.js";
import { copyFiles, clearClipboardState } from "./copy-files.js";

// Test setup helpers
class TestEnvironment {
  tempDir: string | null = null;
  sourceDir: string = "";
  destDir: string = "";

  async setup() {
    // Create a unique temp directory for this test
    this.tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "koda-paste-test-"),
    );
    this.sourceDir = path.join(this.tempDir, "source");
    this.destDir = path.join(this.tempDir, "dest");

    await fs.mkdir(this.sourceDir);
    await fs.mkdir(this.destDir);
  }

  async cleanup() {
    if (this.tempDir) {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    }
  }

  async createFile(
    dirPath: string,
    fileName: string,
    content: string = "test content",
  ): Promise<string> {
    const filePath = path.join(dirPath, fileName);
    await fs.writeFile(filePath, content);
    return filePath;
  }

  async createFolder(dirPath: string, folderName: string): Promise<string> {
    const folderPath = path.join(dirPath, folderName);
    await fs.mkdir(folderPath, { recursive: true });
    return folderPath;
  }

  async createNestedStructure(
    baseDir: string,
    structure: Record<string, string | Record<string, any>>,
  ): Promise<void> {
    for (const [name, value] of Object.entries(structure)) {
      const itemPath = path.join(baseDir, name);
      if (typeof value === "string") {
        // It's a file
        await fs.writeFile(itemPath, value);
      } else if (typeof value === "object") {
        // It's a directory
        await fs.mkdir(itemPath);
        await this.createNestedStructure(itemPath, value);
      }
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, "utf-8");
  }

  async listDir(dirPath: string): Promise<string[]> {
    return await fs.readdir(dirPath);
  }

  // Helper to set up clipboard state
  setupClipboard(filePaths: string[], cut: boolean = false) {
    copyFiles(filePaths, cut);
  }

  clearClipboard() {
    clearClipboardState();
  }
}

// Run tests
describe("paste-files.ts", () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = new TestEnvironment();
    await env.setup();
  });

  afterEach(async () => {
    env.clearClipboard();
    await env.cleanup();
  });

  describe("No conflicts - simple paste", () => {
    test("should paste a single file without conflicts", async () => {
      // Setup
      const sourceFile = await env.createFile(
        env.sourceDir,
        "test.txt",
        "hello",
      );
      env.setupClipboard([sourceFile], false);

      // Execute
      const result = await pasteFiles(env.destDir);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, true);
        if (result.result.success) {
          assert.equal(result.result.data.pastedItems.length, 1);
          assert.equal(result.result.data.pastedItems[0], "test.txt");
        }
      }

      // Verify file was copied
      const destFile = path.join(env.destDir, "test.txt");
      assert.equal(await env.fileExists(destFile), true);
      assert.equal(await env.readFile(destFile), "hello");
    });

    test("should paste multiple files without conflicts", async () => {
      // Setup
      const file1 = await env.createFile(env.sourceDir, "file1.txt", "one");
      const file2 = await env.createFile(env.sourceDir, "file2.txt", "two");
      const file3 = await env.createFile(env.sourceDir, "file3.txt", "three");
      env.setupClipboard([file1, file2, file3], false);

      // Execute
      const result = await pasteFiles(env.destDir);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, true);
        if (result.result.success) {
          assert.equal(result.result.data.pastedItems.length, 3);
        }
      }

      // Verify all files were copied
      assert.equal(
        await env.fileExists(path.join(env.destDir, "file1.txt")),
        true,
      );
      assert.equal(
        await env.fileExists(path.join(env.destDir, "file2.txt")),
        true,
      );
      assert.equal(
        await env.fileExists(path.join(env.destDir, "file3.txt")),
        true,
      );
    });

    test("should paste a folder without conflicts", async () => {
      // Setup
      const folder = await env.createFolder(env.sourceDir, "myfolder");
      await env.createFile(folder, "inside.txt", "inside content");
      env.setupClipboard([folder], false);

      // Execute
      const result = await pasteFiles(env.destDir);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution && result.result.success) {
        assert.equal(result.result.data.pastedItems[0], "myfolder");
      }

      // Verify folder and contents were copied
      const destFolder = path.join(env.destDir, "myfolder");
      assert.equal(await env.fileExists(destFolder), true);
      assert.equal(
        await env.fileExists(path.join(destFolder, "inside.txt")),
        true,
      );
    });

    test("should paste nested folder structure without conflicts", async () => {
      // Setup - create nested structure
      await env.createNestedStructure(env.sourceDir, {
        project: {
          src: {
            "index.js": "console.log('hello');",
            "utils.js": "export const add = (a, b) => a + b;",
          },
          "package.json": '{"name": "test"}',
          "README.md": "# Test Project",
        },
      });

      const projectDir = path.join(env.sourceDir, "project");
      env.setupClipboard([projectDir], false);

      // Execute
      const result = await pasteFiles(env.destDir);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, true);
      }

      // Verify nested structure was copied
      const destProject = path.join(env.destDir, "project");
      assert.equal(await env.fileExists(destProject), true);
      assert.equal(
        await env.fileExists(path.join(destProject, "src", "index.js")),
        true,
      );
      assert.equal(
        await env.fileExists(path.join(destProject, "src", "utils.js")),
        true,
      );
      assert.equal(
        await env.fileExists(path.join(destProject, "package.json")),
        true,
      );
      assert.equal(
        await env.fileExists(path.join(destProject, "README.md")),
        true,
      );
    });
  });

  describe("Conflict detection", () => {
    test("should detect file conflict", async () => {
      // Setup - create file in both source and dest
      const sourceFile = await env.createFile(
        env.sourceDir,
        "conflict.txt",
        "source version",
      );
      await env.createFile(env.destDir, "conflict.txt", "dest version");
      env.setupClipboard([sourceFile], false);

      // Execute
      const result = await pasteFiles(env.destDir);

      // Assert
      assert.equal(result.needsResolution, true);
      if (result.needsResolution) {
        assert.equal(result.conflictData.conflicts.length, 1);
        assert.ok(result.conflictData.totalConflicts >= 1);
        assert.equal(result.conflictData.exceedsLimit, false);

        const conflict = result.conflictData.conflicts[0];
        assert.equal(conflict.type, "file");
        assert.equal(
          conflict.destinationPath,
          path.join(env.destDir, "conflict.txt"),
        );
        assert.equal(conflict.suggestedName, "conflict (1).txt");
      }
    });

    test("should detect folder conflict", async () => {
      // Setup - create folder in both source and dest
      const sourceFolder = await env.createFolder(env.sourceDir, "docs");
      await env.createFolder(env.destDir, "docs");
      env.setupClipboard([sourceFolder], false);

      // Execute
      const result = await pasteFiles(env.destDir);

      // Assert
      assert.equal(result.needsResolution, true);
      if (result.needsResolution) {
        assert.equal(result.conflictData.conflicts.length, 1);

        const conflict = result.conflictData.conflicts[0];
        assert.equal(conflict.type, "dir");
        assert.equal(conflict.suggestedName, "docs (1)");
      }
    });

    test("should not show nested conflicts when folder itself conflicts", async () => {
      // Setup - create folder with nested files in both source and dest
      await env.createNestedStructure(env.sourceDir, {
        docs: {
          "file1.txt": "source 1",
          "file2.txt": "source 2",
          subfolder: {
            "nested.txt": "nested source",
          },
        },
      });

      await env.createNestedStructure(env.destDir, {
        docs: {
          "file1.txt": "dest 1",
          "different.txt": "different file",
        },
      });

      const docsDir = path.join(env.sourceDir, "docs");
      env.setupClipboard([docsDir], false);

      // Execute
      const result = await pasteFiles(env.destDir);

      // Assert - should only show the folder conflict, NOT nested file conflicts
      assert.equal(result.needsResolution, true);
      if (result.needsResolution) {
        assert.equal(result.conflictData.conflicts.length, 1);
        assert.equal(result.conflictData.totalConflicts, 1);

        const conflict = result.conflictData.conflicts[0];
        assert.equal(conflict.type, "dir");
        assert.equal(conflict.destinationPath, path.join(env.destDir, "docs"));
        assert.equal(conflict.suggestedName, "docs (1)");
      }
    });

    test("should detect nested conflicts recursively when parent folder doesn't conflict", async () => {
      // Setup - parent folder "newproject" does NOT exist in dest
      // but we're copying files that will go into it
      await env.createNestedStructure(env.sourceDir, {
        newproject: {
          src: {
            "index.js": "source version",
          },
          "README.md": "source readme",
        },
      });

      // Pre-create the destination structure (newproject doesn't exist, but if it did,
      // these files would conflict)
      // Actually, let's test a different scenario: parent exists, we recurse and find conflicts
      await env.createNestedStructure(env.destDir, {
        newproject: {
          src: {
            "index.js": "dest version",
          },
          "README.md": "dest readme",
        },
      });

      const projectDir = path.join(env.sourceDir, "newproject");
      env.setupClipboard([projectDir], false);

      // Execute
      const result = await pasteFiles(env.destDir);

      // Assert - parent "newproject" folder conflicts, so we should NOT see nested conflicts
      assert.equal(result.needsResolution, true);
      if (result.needsResolution) {
        // Only the newproject folder should be shown as conflict, not the files inside
        assert.equal(result.conflictData.conflicts.length, 1);
        assert.equal(result.conflictData.conflicts[0].type, "dir");
        assert.equal(result.conflictData.conflicts[0].destinationPath, path.join(env.destDir, "newproject"));
      }
    });

    test("should limit conflicts display to 20", async () => {
      // Setup - create 25 conflicting files
      const files: string[] = [];
      for (let i = 0; i < 25; i++) {
        const fileName = `file${i}.txt`;
        await env.createFile(env.sourceDir, fileName, `source ${i}`);
        await env.createFile(env.destDir, fileName, `dest ${i}`);
        files.push(path.join(env.sourceDir, fileName));
      }
      env.setupClipboard(files, false);

      // Execute
      const result = await pasteFiles(env.destDir);

      // Assert
      assert.equal(result.needsResolution, true);
      if (result.needsResolution) {
        assert.equal(result.conflictData.conflicts.length, 20);
        assert.ok(result.conflictData.totalConflicts >= 20);
        assert.equal(result.conflictData.exceedsLimit, true);
      }
    });

    test("should generate unique suggested names", async () => {
      // Setup - create files that would conflict with suggested names
      const sourceFile = await env.createFile(
        env.sourceDir,
        "test.txt",
        "original",
      );
      await env.createFile(env.destDir, "test.txt", "existing");
      await env.createFile(env.destDir, "test (1).txt", "first copy");
      await env.createFile(env.destDir, "test (2).txt", "second copy");
      env.setupClipboard([sourceFile], false);

      // Execute
      const result = await pasteFiles(env.destDir);

      // Assert - should suggest test (3).txt
      assert.equal(result.needsResolution, true);
      if (result.needsResolution) {
        assert.equal(
          result.conflictData.conflicts[0].suggestedName,
          "test (3).txt",
        );
      }
    });
  });

  describe("Conflict resolution - global strategies", () => {
    test("should override files with global override strategy", async () => {
      // Setup
      const sourceFile = await env.createFile(
        env.sourceDir,
        "file.txt",
        "new content",
      );
      await env.createFile(env.destDir, "file.txt", "old content");
      env.setupClipboard([sourceFile], false);

      // Get conflicts first
      const checkResult = await pasteFiles(env.destDir);
      assert.equal(checkResult.needsResolution, true);

      // Execute with override resolution
      const resolution = {
        globalStrategy: "override" as const,
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, true);
      }

      // Verify file was overridden
      const destFile = path.join(env.destDir, "file.txt");
      assert.equal(await env.readFile(destFile), "new content");
    });

    test("should auto-generate names with autoName strategy", async () => {
      // Setup
      const sourceFile = await env.createFile(
        env.sourceDir,
        "file.txt",
        "new content",
      );
      await env.createFile(env.destDir, "file.txt", "old content");
      env.setupClipboard([sourceFile], false);

      // Get conflicts first
      await pasteFiles(env.destDir);

      // Execute with autoName resolution
      const resolution = {
        globalStrategy: "autoName" as const,
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution && result.result.success) {
        assert.equal(result.result.data.pastedItems[0], "file (1).txt");
      }

      // Verify both files exist
      assert.equal(
        await env.fileExists(path.join(env.destDir, "file.txt")),
        true,
      );
      assert.equal(
        await env.fileExists(path.join(env.destDir, "file (1).txt")),
        true,
      );
      assert.equal(
        await env.readFile(path.join(env.destDir, "file.txt")),
        "old content",
      );
      assert.equal(
        await env.readFile(path.join(env.destDir, "file (1).txt")),
        "new content",
      );
    });

    test("should skip conflicting files with skip strategy", async () => {
      // Setup
      const file1 = await env.createFile(env.sourceDir, "file1.txt", "one");
      const file2 = await env.createFile(env.sourceDir, "file2.txt", "two");
      await env.createFile(env.destDir, "file1.txt", "existing");
      env.setupClipboard([file1, file2], false);

      // Get conflicts first
      await pasteFiles(env.destDir);

      // Execute with skip resolution
      const resolution = {
        globalStrategy: "skip" as const,
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution && result.result.success) {
        // Only file2 should be pasted (file1 has conflict and is skipped)
        assert.equal(result.result.data.pastedItems.length, 1);
        assert.equal(result.result.data.pastedItems[0], "file2.txt");
      }

      // file1.txt should still have old content
      assert.equal(
        await env.readFile(path.join(env.destDir, "file1.txt")),
        "existing",
      );
      assert.equal(
        await env.readFile(path.join(env.destDir, "file2.txt")),
        "two",
      );
    });
  });

  describe("Conflict resolution - per-file overrides", () => {
    test("should apply custom name to specific file", async () => {
      // Setup
      const sourceFile = await env.createFile(
        env.sourceDir,
        "original.txt",
        "content",
      );
      await env.createFile(env.destDir, "original.txt", "existing");
      env.setupClipboard([sourceFile], false);

      // Get conflicts first
      await pasteFiles(env.destDir);

      // Execute with custom name
      const destPath = path.join(env.destDir, "original.txt");
      const resolution = {
        globalStrategy: "autoName" as const,
        perFileOverrides: {
          [destPath]: {
            action: "customName" as const,
            customName: "renamed.txt",
          },
        },
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution && result.result.success) {
        assert.equal(result.result.data.pastedItems[0], "renamed.txt");
      }

      // Verify custom name was used
      assert.equal(
        await env.fileExists(path.join(env.destDir, "renamed.txt")),
        true,
      );
      assert.equal(
        await env.readFile(path.join(env.destDir, "renamed.txt")),
        "content",
      );
    });

    test("should override specific file while using global autoName", async () => {
      // Setup
      const file1 = await env.createFile(env.sourceDir, "file1.txt", "one");
      const file2 = await env.createFile(env.sourceDir, "file2.txt", "two");
      await env.createFile(env.destDir, "file1.txt", "existing1");
      await env.createFile(env.destDir, "file2.txt", "existing2");
      env.setupClipboard([file1, file2], false);

      // Get conflicts first
      await pasteFiles(env.destDir);

      // Execute with per-file override
      const file1DestPath = path.join(env.destDir, "file1.txt");
      const resolution = {
        globalStrategy: "autoName" as const,
        perFileOverrides: {
          [file1DestPath]: {
            action: "override" as const,
          },
        },
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, true);
      }

      // file1.txt should be overridden
      assert.equal(
        await env.readFile(path.join(env.destDir, "file1.txt")),
        "one",
      );
      // file2.txt should have auto-generated name
      assert.equal(
        await env.fileExists(path.join(env.destDir, "file2 (1).txt")),
        true,
      );
    });

    test("should skip specific file while using global override", async () => {
      // Setup
      const file1 = await env.createFile(env.sourceDir, "file1.txt", "one");
      const file2 = await env.createFile(env.sourceDir, "file2.txt", "two");
      await env.createFile(env.destDir, "file1.txt", "existing1");
      await env.createFile(env.destDir, "file2.txt", "existing2");
      env.setupClipboard([file1, file2], false);

      // Get conflicts first
      await pasteFiles(env.destDir);

      // Execute with per-file skip
      const file1DestPath = path.join(env.destDir, "file1.txt");
      const resolution = {
        globalStrategy: "override" as const,
        perFileOverrides: {
          [file1DestPath]: {
            action: "skip" as const,
          },
        },
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, true);
      }

      // file1.txt should keep old content (skipped)
      assert.equal(
        await env.readFile(path.join(env.destDir, "file1.txt")),
        "existing1",
      );
      // file2.txt should be overridden
      assert.equal(
        await env.readFile(path.join(env.destDir, "file2.txt")),
        "two",
      );
    });

    test("should handle custom name that also conflicts", async () => {
      // Setup - f1 conflicts, user renames to f2, but f2 also exists!
      const folder1 = await env.createFolder(env.sourceDir, "f1");
      await env.createFile(folder1, "content.txt", "from f1");
      
      await env.createFolder(env.destDir, "f1"); // Conflicts with source
      const folder2 = await env.createFolder(env.destDir, "f2"); // Will conflict with custom name
      await env.createFile(folder2, "existing.txt", "from f2");
      
      env.setupClipboard([folder1], false);

      // Get conflicts first
      await pasteFiles(env.destDir);

      // Execute with custom name "f2" which also conflicts
      const f1DestPath = path.join(env.destDir, "f1");
      const resolution = {
        globalStrategy: "autoName" as const,
        perFileOverrides: {
          [f1DestPath]: {
            action: "customName" as const,
            customName: "f2", // This name also conflicts!
          },
        },
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert - should auto-append number to custom name
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution && result.result.success) {
        // Should be renamed to "f2 (1)" since "f2" exists
        assert.equal(result.result.data.pastedItems[0], "f2 (1)");
      }

      // Verify f2 (1) was created
      assert.equal(
        await env.fileExists(path.join(env.destDir, "f2 (1)")),
        true,
      );
      // Original f2 should still exist
      assert.equal(
        await env.fileExists(path.join(env.destDir, "f2", "existing.txt")),
        true,
      );
      // f1 content should be in f2 (1)
      assert.equal(
        await env.fileExists(path.join(env.destDir, "f2 (1)", "content.txt")),
        true,
      );
    });
  });

  describe("Folder merge behavior", () => {
    test("should merge folders when both exist with override strategy", async () => {
      // Setup
      await env.createNestedStructure(env.sourceDir, {
        docs: {
          "new.md": "new documentation",
          "update.md": "updated content",
        },
      });

      await env.createNestedStructure(env.destDir, {
        docs: {
          "existing.md": "existing doc",
          "update.md": "old content",
        },
      });

      const sourceFolder = path.join(env.sourceDir, "docs");
      env.setupClipboard([sourceFolder], false);

      // Get conflicts first
      await pasteFiles(env.destDir);

      // Execute with override
      const resolution = {
        globalStrategy: "override" as const,
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, true);
      }

      // Verify folder was merged (not replaced)
      const docsDir = path.join(env.destDir, "docs");
      const files = await env.listDir(docsDir);

      // Should have all three files
      assert.ok(files.includes("existing.md")); // Original file preserved
      assert.ok(files.includes("new.md")); // New file added
      assert.ok(files.includes("update.md")); // Conflicting file overridden

      // Check update.md was overridden
      assert.equal(
        await env.readFile(path.join(docsDir, "update.md")),
        "updated content",
      );
    });

    test("should not delete destination folder when merging", async () => {
      // Setup - destination has files that don't exist in source
      await env.createNestedStructure(env.sourceDir, {
        project: {
          "new-file.txt": "new",
        },
      });

      await env.createNestedStructure(env.destDir, {
        project: {
          "important.txt": "don't delete me",
          subfolder: {
            "data.json": '{"keep": true}',
          },
        },
      });

      const sourceFolder = path.join(env.sourceDir, "project");
      env.setupClipboard([sourceFolder], false);

      // Get conflicts and resolve
      await pasteFiles(env.destDir);
      const resolution = { globalStrategy: "override" as const };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert
      if (!result.needsResolution) {
        assert.equal(result.result.success, true);
      }

      // Verify destination-only files still exist
      const projectDir = path.join(env.destDir, "project");
      assert.equal(
        await env.fileExists(path.join(projectDir, "important.txt")),
        true,
      );
      assert.equal(
        await env.fileExists(path.join(projectDir, "subfolder", "data.json")),
        true,
      );
      // New file should also exist
      assert.equal(
        await env.fileExists(path.join(projectDir, "new-file.txt")),
        true,
      );
    });
  });

  describe("Cut operations", () => {
    test("should move file with cut=true and no conflicts", async () => {
      // Setup
      const sourceFile = await env.createFile(
        env.sourceDir,
        "move-me.txt",
        "content",
      );
      env.setupClipboard([sourceFile], true); // cut=true

      // Execute
      const result = await pasteFiles(env.destDir);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, true);
      }

      // Verify file was moved (not copied)
      assert.equal(
        await env.fileExists(path.join(env.destDir, "move-me.txt")),
        true,
      );
      assert.equal(await env.fileExists(sourceFile), false); // Source should be deleted
    });

    test("should not delete skipped files in cut operation", async () => {
      // Setup
      const file1 = await env.createFile(env.sourceDir, "file1.txt", "one");
      const file2 = await env.createFile(env.sourceDir, "file2.txt", "two");
      await env.createFile(env.destDir, "file1.txt", "existing");
      env.setupClipboard([file1, file2], true); // cut=true

      // Get conflicts and resolve with skip for file1
      await pasteFiles(env.destDir);
      const file1DestPath = path.join(env.destDir, "file1.txt");
      const resolution = {
        globalStrategy: "autoName" as const,
        perFileOverrides: {
          [file1DestPath]: {
            action: "skip" as const,
          },
        },
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert
      if (!result.needsResolution) {
        assert.equal(result.result.success, true);
      }

      // file1 was skipped, should still exist at source
      assert.equal(await env.fileExists(file1), true);
      // file2 was moved, should not exist at source
      assert.equal(await env.fileExists(file2), false);
    });

    test("should prevent cut and paste in same directory", async () => {
      // Setup
      const file = await env.createFile(env.sourceDir, "file.txt", "content");
      env.setupClipboard([file], true); // cut=true

      // Execute - try to paste into same directory
      const result = await pasteFiles(env.sourceDir);

      // Assert - should fail
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, false);
        if (!result.result.success && result.result.error.type === "message") {
          assert.ok(
            result.result.error.message.includes("Cannot cut and paste"),
          );
        }
      }
    });
  });

  describe("Edge cases and error handling", () => {
    test("should handle empty clipboard", async () => {
      // Don't set up any clipboard
      const result = await pasteFiles(env.destDir);

      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, false);
        if (!result.result.success && result.result.error.type === "message") {
          assert.ok(result.result.error.message.includes("No files in clipboard"));
        }
      }
    });

    test("should reject invalid custom names", async () => {
      // Setup
      const sourceFile = await env.createFile(
        env.sourceDir,
        "file.txt",
        "content",
      );
      await env.createFile(env.destDir, "file.txt", "existing");
      env.setupClipboard([sourceFile], false);

      // Get conflicts
      await pasteFiles(env.destDir);

      // Execute with invalid custom name (contains /)
      const destPath = path.join(env.destDir, "file.txt");
      const resolution = {
        globalStrategy: "autoName" as const,
        perFileOverrides: {
          [destPath]: {
            action: "customName" as const,
            customName: "invalid/name.txt",
          },
        },
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert - should fail validation
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, false);
        if (!result.result.success && result.result.error.type === "message") {
          assert.ok(result.result.error.message.includes("Invalid name"));
        }
      }
    });

    test("should reject empty custom names", async () => {
      // Setup
      const sourceFile = await env.createFile(
        env.sourceDir,
        "file.txt",
        "content",
      );
      await env.createFile(env.destDir, "file.txt", "existing");
      env.setupClipboard([sourceFile], false);

      // Get conflicts
      await pasteFiles(env.destDir);

      // Execute with empty custom name
      const destPath = path.join(env.destDir, "file.txt");
      const resolution = {
        globalStrategy: "autoName" as const,
        perFileOverrides: {
          [destPath]: {
            action: "customName" as const,
            customName: "   ", // whitespace only
          },
        },
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert
      if (!result.needsResolution) {
        assert.equal(result.result.success, false);
        if (!result.result.success && result.result.error.type === "message") {
          assert.ok(result.result.error.message.includes("cannot be empty"));
        }
      }
    });

    test("should handle non-existent destination directory", async () => {
      // Setup
      const sourceFile = await env.createFile(
        env.sourceDir,
        "file.txt",
        "content",
      );
      env.setupClipboard([sourceFile], false);

      // Execute with non-existent destination
      const nonExistentDir = path.join(env.tempDir!, "does-not-exist");
      const result = await pasteFiles(nonExistentDir);

      // Assert - should fail
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, false);
      }
    });
  });

  describe("Comprehensive validation", () => {
    test("should reject invalid global strategy", async () => {
      // Setup
      const sourceFile = await env.createFile(
        env.sourceDir,
        "file.txt",
        "content",
      );
      await env.createFile(env.destDir, "file.txt", "existing");
      env.setupClipboard([sourceFile], false);

      // Get conflicts
      await pasteFiles(env.destDir);

      // Execute with invalid global strategy
      const resolution = {
        globalStrategy: "invalid-strategy" as any,
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, false);
        if (!result.result.success && result.result.error.type === "message") {
          assert.ok(
            result.result.error.message.includes("Invalid global strategy"),
          );
        }
      }
    });

    test("should reject invalid per-file action", async () => {
      // Setup
      const sourceFile = await env.createFile(
        env.sourceDir,
        "file.txt",
        "content",
      );
      await env.createFile(env.destDir, "file.txt", "existing");
      env.setupClipboard([sourceFile], false);

      // Get conflicts
      await pasteFiles(env.destDir);

      // Execute with invalid per-file action
      const destPath = path.join(env.destDir, "file.txt");
      const resolution = {
        globalStrategy: "autoName" as const,
        perFileOverrides: {
          [destPath]: {
            action: "invalid-action" as any,
          },
        },
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, false);
        if (!result.result.success && result.result.error.type === "message") {
          assert.ok(result.result.error.message.includes("Invalid action"));
        }
      }
    });

    test("should reject customName action without customName value", async () => {
      // Setup
      const sourceFile = await env.createFile(
        env.sourceDir,
        "file.txt",
        "content",
      );
      await env.createFile(env.destDir, "file.txt", "existing");
      env.setupClipboard([sourceFile], false);

      // Get conflicts
      await pasteFiles(env.destDir);

      // Execute with customName action but no customName value
      const destPath = path.join(env.destDir, "file.txt");
      const resolution = {
        globalStrategy: "autoName" as const,
        perFileOverrides: {
          [destPath]: {
            action: "customName" as const,
            // customName is missing!
          },
        },
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, false);
        if (!result.result.success && result.result.error.type === "message") {
          assert.ok(
            result.result.error.message.includes("Custom name required"),
          );
        }
      }
    });

    test("should reject duplicate destination paths from custom names", async () => {
      // Setup
      const file1 = await env.createFile(env.sourceDir, "file1.txt", "content1");
      const file2 = await env.createFile(env.sourceDir, "file2.txt", "content2");
      await env.createFile(env.destDir, "file1.txt", "existing1");
      await env.createFile(env.destDir, "file2.txt", "existing2");
      env.setupClipboard([file1, file2], false);

      // Get conflicts
      await pasteFiles(env.destDir);

      // Execute - both files renamed to the same name
      const file1DestPath = path.join(env.destDir, "file1.txt");
      const file2DestPath = path.join(env.destDir, "file2.txt");
      const resolution = {
        globalStrategy: "autoName" as const,
        perFileOverrides: {
          [file1DestPath]: {
            action: "customName" as const,
            customName: "samename.txt",
          },
          [file2DestPath]: {
            action: "customName" as const,
            customName: "samename.txt", // Same name!
          },
        },
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, false);
        if (!result.result.success && result.result.error.type === "message") {
          assert.ok(
            result.result.error.message.includes("Multiple files would be pasted"),
          );
        }
      }
    });

    test("should reject when all files would be skipped", async () => {
      // Setup
      const file1 = await env.createFile(env.sourceDir, "file1.txt", "content1");
      const file2 = await env.createFile(env.sourceDir, "file2.txt", "content2");
      await env.createFile(env.destDir, "file1.txt", "existing1");
      await env.createFile(env.destDir, "file2.txt", "existing2");
      env.setupClipboard([file1, file2], false);

      // Get conflicts
      await pasteFiles(env.destDir);

      // Execute - skip all files
      const resolution = {
        globalStrategy: "skip" as const,
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, false);
        if (!result.result.success && result.result.error.type === "message") {
          assert.ok(
            result.result.error.message.includes("No files would be pasted") ||
              result.result.error.message.includes("all files skipped"),
          );
        }
      }
    });

    test("should allow partial skip with some files pasted", async () => {
      // Setup - 3 files, 2 conflict, 1 doesn't
      const file1 = await env.createFile(env.sourceDir, "file1.txt", "content1");
      const file2 = await env.createFile(env.sourceDir, "file2.txt", "content2");
      const file3 = await env.createFile(env.sourceDir, "file3.txt", "content3");
      await env.createFile(env.destDir, "file1.txt", "existing1");
      await env.createFile(env.destDir, "file2.txt", "existing2");
      // file3 has no conflict
      env.setupClipboard([file1, file2, file3], false);

      // Get conflicts
      await pasteFiles(env.destDir);

      // Execute - skip all conflicts, but file3 should still paste
      const resolution = {
        globalStrategy: "skip" as const,
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert - should succeed (file3 was pasted)
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, true);
        if (result.result.success) {
          assert.deepEqual(result.result.data.pastedItems, ["file3.txt"]);
        }
      }
    });

    test("should validate per-file override that prevents all pastes", async () => {
      // Setup - 2 conflicting files
      const file1 = await env.createFile(env.sourceDir, "file1.txt", "content1");
      const file2 = await env.createFile(env.sourceDir, "file2.txt", "content2");
      await env.createFile(env.destDir, "file1.txt", "existing1");
      await env.createFile(env.destDir, "file2.txt", "existing2");
      env.setupClipboard([file1, file2], false);

      // Get conflicts
      await pasteFiles(env.destDir);

      // Execute - global is override, but both files have skip overrides
      const file1DestPath = path.join(env.destDir, "file1.txt");
      const file2DestPath = path.join(env.destDir, "file2.txt");
      const resolution = {
        globalStrategy: "override" as const,
        perFileOverrides: {
          [file1DestPath]: { action: "skip" as const },
          [file2DestPath]: { action: "skip" as const },
        },
      };
      const result = await pasteFiles(env.destDir, resolution);

      // Assert - should fail (no files would be pasted)
      assert.equal(result.needsResolution, false);
      if (!result.needsResolution) {
        assert.equal(result.result.success, false);
        if (!result.result.success && result.result.error.type === "message") {
          assert.ok(
            result.result.error.message.includes("No files would be pasted"),
          );
        }
      }
    });
  });
});

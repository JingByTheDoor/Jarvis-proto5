import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import type { ToolResult } from "../schemas";
import type { RiskLevel, SideEffectFamily } from "../../shared/constants";
import { createUnifiedDiff } from "./unified-diff";

const AbsolutePathSchema = z
  .string()
  .min(1)
  .refine(
    (value) => path.win32.isAbsolute(value) || path.posix.isAbsolute(value),
    "Expected an absolute path"
  );

const ListDirectoryArgsSchema = z
  .object({
    path: AbsolutePathSchema
  })
  .strict();

const ReadTextFileArgsSchema = z
  .object({
    path: AbsolutePathSchema
  })
  .strict();

const WriteTextFileArgsSchema = z
  .object({
    path: AbsolutePathSchema,
    content: z.string()
  })
  .strict();

const DiffFileArgsSchema = z
  .object({
    path: AbsolutePathSchema,
    next_content: z.string()
  })
  .strict();

const GitStatusArgsSchema = z
  .object({
    repository_path: AbsolutePathSchema
  })
  .strict();

const GitDiffArgsSchema = z
  .object({
    repository_path: AbsolutePathSchema,
    relative_path: z.string().min(1).optional()
  })
  .strict();

export const localRepoToolNames = [
  "list_directory",
  "read_text_file",
  "write_text_file",
  "diff_file",
  "git_status",
  "git_diff"
] as const;

export type LocalRepoToolName = (typeof localRepoToolNames)[number];

export interface ToolDefinition<TArgs, TToolName extends string = LocalRepoToolName> {
  readonly tool_name: TToolName;
  readonly risk_floor: RiskLevel;
  readonly side_effect_family: SideEffectFamily;
  readonly supports_simulation: boolean;
  readonly supports_attestation: boolean;
  readonly arg_schema: z.ZodType<TArgs>;
  readonly execute: (args: TArgs) => ToolResult;
}

function createErrorResult(summary: string, error: string): ToolResult {
  return {
    ok: false,
    summary,
    output: null,
    redacted_output: null,
    error,
    artifacts: [],
    structured_data: null,
    observed_effects: []
  };
}

function executeGit(repositoryPath: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", repositoryPath, ...args], {
    encoding: "utf8",
    windowsHide: true
  }).trim();
}

function listDirectory(args: z.infer<typeof ListDirectoryArgsSchema>): ToolResult {
  try {
    const entries = fs
      .readdirSync(args.path, { withFileTypes: true })
      .map((entry) => ({
        name: entry.name,
        path: path.join(args.path, entry.name),
        kind: entry.isDirectory() ? "directory" : "file"
      }))
      .sort((left, right) => left.path.localeCompare(right.path));

    return {
      ok: true,
      summary: `Listed ${entries.length} entries in ${args.path}`,
      output: {
        path: args.path,
        entries
      },
      redacted_output: {
        path: args.path,
        entries
      },
      error: null,
      artifacts: [],
      structured_data: {
        entry_count: entries.length
      },
      observed_effects: [
        {
          family: "readonly",
          target: args.path,
          detail: "list directory"
        }
      ]
    };
  } catch (error) {
    return createErrorResult(
      `Failed to list ${args.path}`,
      error instanceof Error ? error.message : "Unknown list_directory error"
    );
  }
}

function readTextFile(args: z.infer<typeof ReadTextFileArgsSchema>): ToolResult {
  try {
    const text = fs.readFileSync(args.path, "utf8");
    return {
      ok: true,
      summary: `Read ${args.path}`,
      output: {
        path: args.path,
        text
      },
      redacted_output: {
        path: args.path,
        text
      },
      error: null,
      artifacts: [],
      structured_data: {
        line_count: text.length === 0 ? 0 : text.replace(/\r\n/g, "\n").split("\n").length
      },
      observed_effects: [
        {
          family: "readonly",
          target: args.path,
          detail: "read text file"
        }
      ]
    };
  } catch (error) {
    return createErrorResult(
      `Failed to read ${args.path}`,
      error instanceof Error ? error.message : "Unknown read_text_file error"
    );
  }
}

function writeTextFile(args: z.infer<typeof WriteTextFileArgsSchema>): ToolResult {
  try {
    fs.mkdirSync(path.dirname(args.path), { recursive: true });
    fs.writeFileSync(args.path, args.content, "utf8");

    return {
      ok: true,
      summary: `Wrote ${args.path}`,
      output: {
        path: args.path
      },
      redacted_output: {
        path: args.path
      },
      error: null,
      artifacts: [],
      structured_data: {
        bytes_written: Buffer.byteLength(args.content, "utf8")
      },
      observed_effects: [
        {
          family: "workspace_write",
          target: args.path,
          detail: "write text file"
        }
      ]
    };
  } catch (error) {
    return createErrorResult(
      `Failed to write ${args.path}`,
      error instanceof Error ? error.message : "Unknown write_text_file error"
    );
  }
}

function diffFile(args: z.infer<typeof DiffFileArgsSchema>): ToolResult {
  try {
    const before = fs.existsSync(args.path) ? fs.readFileSync(args.path, "utf8") : "";
    const unifiedDiff = createUnifiedDiff(args.path, before, args.next_content);
    const status = fs.existsSync(args.path)
      ? before === args.next_content
        ? "unchanged"
        : "modified"
      : "created";

    return {
      ok: true,
      summary: `Prepared ${status} diff preview for ${args.path}`,
      output: {
        path: args.path,
        status,
        before,
        after: args.next_content,
        unified_diff: unifiedDiff
      },
      redacted_output: {
        path: args.path,
        status,
        before,
        after: args.next_content,
        unified_diff: unifiedDiff
      },
      error: null,
      artifacts: [
        {
          kind: "preview",
          location: args.path,
          description: "exact diff preview"
        }
      ],
      structured_data: {
        status
      },
      observed_effects: [
        {
          family: "readonly",
          target: args.path,
          detail: "compute file diff preview"
        }
      ]
    };
  } catch (error) {
    return createErrorResult(
      `Failed to diff ${args.path}`,
      error instanceof Error ? error.message : "Unknown diff_file error"
    );
  }
}

function gitStatus(args: z.infer<typeof GitStatusArgsSchema>): ToolResult {
  try {
    const branch = executeGit(args.repository_path, ["branch", "--show-current"]);
    const shortStatus = executeGit(args.repository_path, ["status", "--short"]);

    return {
      ok: true,
      summary: `Read git status for ${args.repository_path}`,
      output: {
        repository_path: args.repository_path,
        branch,
        short_status: shortStatus
      },
      redacted_output: {
        repository_path: args.repository_path,
        branch,
        short_status: shortStatus
      },
      error: null,
      artifacts: [],
      structured_data: {
        branch,
        dirty: shortStatus.length > 0
      },
      observed_effects: [
        {
          family: "readonly",
          target: args.repository_path,
          detail: "git status"
        }
      ]
    };
  } catch (error) {
    return createErrorResult(
      `Failed to read git status for ${args.repository_path}`,
      error instanceof Error ? error.message : "Unknown git_status error"
    );
  }
}

function gitDiff(args: z.infer<typeof GitDiffArgsSchema>): ToolResult {
  try {
    const diffArgs = args.relative_path ? ["diff", "--", args.relative_path] : ["diff"];
    const diffText = executeGit(args.repository_path, diffArgs);

    return {
      ok: true,
      summary: `Read git diff for ${args.repository_path}`,
      output: {
        repository_path: args.repository_path,
        relative_path: args.relative_path ?? null,
        diff: diffText
      },
      redacted_output: {
        repository_path: args.repository_path,
        relative_path: args.relative_path ?? null,
        diff: diffText
      },
      error: null,
      artifacts: [],
      structured_data: {
        has_diff: diffText.length > 0
      },
      observed_effects: [
        {
          family: "readonly",
          target: args.repository_path,
          detail: "git diff"
        }
      ]
    };
  } catch (error) {
    return createErrorResult(
      `Failed to read git diff for ${args.repository_path}`,
      error instanceof Error ? error.message : "Unknown git_diff error"
    );
  }
}

export const toolRegistry = {
  list_directory: {
    tool_name: "list_directory",
    risk_floor: "SAFE",
    side_effect_family: "readonly",
    supports_simulation: true,
    supports_attestation: true,
    arg_schema: ListDirectoryArgsSchema,
    execute: listDirectory
  },
  read_text_file: {
    tool_name: "read_text_file",
    risk_floor: "SAFE",
    side_effect_family: "readonly",
    supports_simulation: true,
    supports_attestation: true,
    arg_schema: ReadTextFileArgsSchema,
    execute: readTextFile
  },
  write_text_file: {
    tool_name: "write_text_file",
    risk_floor: "CAUTION",
    side_effect_family: "workspace_write",
    supports_simulation: false,
    supports_attestation: true,
    arg_schema: WriteTextFileArgsSchema,
    execute: writeTextFile
  },
  diff_file: {
    tool_name: "diff_file",
    risk_floor: "SAFE",
    side_effect_family: "readonly",
    supports_simulation: true,
    supports_attestation: true,
    arg_schema: DiffFileArgsSchema,
    execute: diffFile
  },
  git_status: {
    tool_name: "git_status",
    risk_floor: "SAFE",
    side_effect_family: "readonly",
    supports_simulation: true,
    supports_attestation: true,
    arg_schema: GitStatusArgsSchema,
    execute: gitStatus
  },
  git_diff: {
    tool_name: "git_diff",
    risk_floor: "SAFE",
    side_effect_family: "readonly",
    supports_simulation: true,
    supports_attestation: true,
    arg_schema: GitDiffArgsSchema,
    execute: gitDiff
  }
} satisfies { [K in LocalRepoToolName]: ToolDefinition<any> };

export function getToolDefinition(toolName: LocalRepoToolName): ToolDefinition<any> {
  return toolRegistry[toolName];
}

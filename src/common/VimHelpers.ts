import { GenericError } from "./GenericError";

export namespace VimHelpers {
  export type CursorPosition = {
    line: number;
    column: number;
  };
  export type CommandOpts = {
    count: number;
    buffer: string[];
    cursor: CursorPosition;
    registry: string[];
  };
  export type Manipulation =
    | {
        type: "copy";
        line: number;
      }
    | {
        type: "delete_and_copy";
        line: number;
      }
    | {
        type: "delete";
        line: number;
      }
    | {
        type: "paste";
        content: string[];
        line: number;
      }
    | {
        type: "undo";
      };
  export type Mode = "normal" | "insert";
  export type CommandResult =
    | {
        manipulations: Manipulation[];
        mode: Mode;
        cursor: CursorPosition;
      }
    | GenericError
    | typeof NOOP;
  export const NOOP = Symbol("NOOP");

  // yy - p - P - u - ciw - C

  // TODO: I don't like this architecture. We should just contain every functionality in here
  export function cc(opts: CommandOpts): CommandResult {
    const manipulations: Manipulation[] = [];
    for (let i = opts.cursor.line; i < opts.count + opts.cursor.line; i++) {
      manipulations.push({
        type: "delete",
        line: i,
      });
    }
    return {
      manipulations,
      mode: "insert",
      cursor: {
        line: opts.cursor.line + opts.count - 1,
        column: 0,
      },
    };
  }

  export function dd(opts: CommandOpts): CommandResult {
    const manipulations: Manipulation[] = [];
    for (let i = opts.cursor.line; i < opts.count + opts.cursor.line; i++) {
      manipulations.push({
        type: "delete_and_copy",
        line: i,
      });
    }
    return {
      manipulations,
      mode: "normal",
      cursor: {
        line: opts.cursor.line + opts.count,
        column: opts.cursor.column,
      },
    };
  }

  export function yy(opts: CommandOpts): CommandResult {
    const manipulations: Manipulation[] = [];
    for (let i = opts.cursor.line; i < opts.count + opts.cursor.line; i++) {
      manipulations.push({
        type: "copy",
        line: i,
      });
    }
    return {
      manipulations,
      mode: "normal",
      cursor: opts.cursor,
    };
  }

  export function p(opts: CommandOpts): CommandResult {
    if (opts.count) GenericError.Message("p not supported with count");
    if (!opts.registry.length) return NOOP;

    return {
      manipulations: [
        {
          type: "paste",
          line: opts.cursor.line + 1,
          content: opts.registry,
        },
      ],
      mode: "normal",
      cursor: {
        column: 0,
        line: opts.cursor.line + 1,
      },
    };
  }

  export function P(opts: CommandOpts): CommandResult {
    if (opts.count) GenericError.Message("P not supported with count");
    if (!opts.registry.length) return NOOP;

    return {
      manipulations: [
        {
          type: "paste",
          line: opts.cursor.line - 1,
          content: opts.registry,
        },
      ],
      mode: "normal",
      cursor: {
        column: 0,
        line: opts.cursor.line,
      },
    };
  }

  export function u(opts: CommandOpts): CommandResult {
    return {
      manipulations: [
        {
          type: "undo",
        },
      ],
      mode: "normal",
      cursor: opts.cursor,
    };
  }
}

//  1
//  2
//  3
//  4
//  5
//  6
//  7
//  8
//  9
// 10
// 11
// 12
// 13
// 14
// 15
// 16
// 17
// 18
// 19
// 20
// 21
// 22
// 23
// 24
// 25
// 26
// 27
// 28
// 29
// 30
// 31
// 32
// 33
// 34
// 35
// 36
// 37
// 38
// 39
// 40
// 41
// 42
// 43
// 44
// 45
// 46
// 47
// 48
// 49
// 50
// 51
// 52
// 53
// 54
// 55
// 56
// 57
// 58
// 59
// 60
// 61
// 62
// 63
// 64
// 65
// 66
// 67
// 68
// 69
// 70
// 71
// 72
// 73
// 74
// 75
// 76
// 77
// 78
// 79
// 80
// 81
// 82
// 83
// 84
// 85
// 86
// 87
// 88
// 89
// 90
// 91
// 92


// ShellCompRequestCmd is the name of the hidden command that is used to request
// completion results from the program. It is used by the shell completion scripts.
export const ShellCompRequestCmd: string = "__complete";

// ShellCompNoDescRequestCmd is the name of the hidden command that is used to request
// completion results without their description. It is used by the shell completion scripts.
export const ShellCompNoDescRequestCmd: string = "__completeNoDesc";

// ShellCompDirective is a bit map representing the different behaviors the shell
// can be instructed to have once completions have been provided.
export const ShellCompDirective = {
  // ShellCompDirectiveError indicates an error occurred and completions should be ignored.
  ShellCompDirectiveError: 1 << 0,

  // ShellCompDirectiveNoSpace indicates that the shell should not add a space
  // after the completion even if there is a single completion provided.
  ShellCompDirectiveNoSpace: 1 << 1,

  // ShellCompDirectiveNoFileComp indicates that the shell should not provide
  // file completion even when no completion is provided.
  ShellCompDirectiveNoFileComp: 1 << 2,

  // ShellCompDirectiveFilterFileExt indicates that the provided completions
  // should be used as file extension filters.
  // For flags, using Command.MarkFlagFilename() and Command.MarkPersistentFlagFilename()
  // is a shortcut to using this directive explicitly.  The BashCompFilenameExt
  // annotation can also be used to obtain the same behavior for flags.
  ShellCompDirectiveFilterFileExt: 1 << 3,

  // ShellCompDirectiveFilterDirs indicates that only directory names should
  // be provided in file completion.  To request directory names within another
  // directory, the returned completions should specify the directory within
  // which to search.  The BashCompSubdirsInDir annotation can be used to
  // obtain the same behavior but only for flags.
  ShellCompDirectiveFilterDirs: 1 << 4,

  // ShellCompDirectiveKeepOrder indicates that the shell should preserve the order
  // in which the completions are provided.
  ShellCompDirectiveKeepOrder: 1 << 5,

  // ===========================================================================

  // All directives using iota (or equivalent in Go) should be above this one.
  // For internal use.
  shellCompDirectiveMaxValue: 1 << 6,

  // ShellCompDirectiveDefault indicates to let the shell perform its default
  // behavior after completions have been provided.
  // This one must be last to avoid messing up the iota count.
  ShellCompDirectiveDefault: 0,
};



type Completion = {
  action: string;
  description?: string;
};

export type Callback = (
  previousArgs: string[],
  toComplete: string,
) => Completion[] | Promise<Completion[]>;

export type Positional = {
  required: boolean;
  variadic: boolean;
  completion: Callback;
};


export const positionalMap = new Map<string, Positional[]>();

export const flagMap = new Map<string, Callback>();

import fs from "fs/promises";
import cac, { Command } from "cac";
import path from "path";

const cli = cac("cac");

const execPath = process.execPath;
const processArgs = process.argv.slice(1);
const x = `${execPath} ${process.execArgv.join(" ")} ${processArgs[0]}`;

cli.option("--type [type]", "Choose a project type", {
  default: "node",
});
cli.option("--name <name>", "Provide your name");
cli.option("--name23 <name>", "Provide your name23");

cli.command("start").option("--port <port>", "your port");

cli.command("help");

cli.command("help config").option("--foo", "foo option");

cli.command("test dev").option("--foo", "foo option");

cli
  .command("deploy <environment> [version] [...files]")
  .action((environment, version) => {
    console.log(`Deploying to ${environment} environment, version ${version}`);
  });

cli
  .command("complete")
  .action(() => console.log(genZshComp("my_command", true)));

type Positional = {
  required: boolean;
  variadic: boolean;
  completion: Callback;
};

const positionalMap = new Map<string, Positional[]>();

const flagMap = new Map<string, Callback>();

cli
  .command("__complete [...args]")
  .action(async (_, { ["--"]: args }: { ["--"]: string[] }) => {
    cli.showHelpOnExit = false;
    let directive = ShellCompDirective.ShellCompDirectiveDefault;

    const endsWithSpace = args[args.length - 1] === "";
    if (endsWithSpace) {
      args = args.slice(0, -1); // Remove the empty string
    }

    let toComplete = args[args.length - 1] || "";
    const previousArgs = args.slice(0, -1);

    const completions: string[] = [];

    cli.unsetMatchedCommand();
    cli.parse([execPath, processArgs[0], ...previousArgs], {
      run: false,
    });

    const command = cli.matchedCommand ?? cli.globalCommand;

    const options = [
      ...new Set([...(command?.options ?? []), ...cli.globalCommand.options]),
    ];

    let isCompletingFlagValue = false;
    let flagName = "";
    let option: (typeof options)[number] | null = null;

    if (toComplete.startsWith("--")) {
      // Long option
      flagName = toComplete.slice(2);
      const equalsIndex = flagName.indexOf("=");
      if (equalsIndex !== -1 && !endsWithSpace) {
        // Option with '=', get the name before '='
        flagName = flagName.slice(0, equalsIndex);
        toComplete = toComplete.slice(toComplete.indexOf("=") + 1);
      } else if (!endsWithSpace) {
        // If not ending with space, still typing option name
        flagName = "";
      }
    } else if (toComplete.startsWith("-") && toComplete.length > 1) {
      // Short option
      flagName = toComplete.slice(1);
      if (!endsWithSpace) {
        // Still typing option name
        flagName = "";
      }
    }

    if (flagName) {
      option = options.find((o) => o.names.includes(flagName)) ?? null;
      if (option && !option.isBoolean) {
        isCompletingFlagValue = true;
      }
    }

    if (isCompletingFlagValue) {
      const flagCompletionFn = flagMap.get(`${command.name} ${option?.name}`);
      // console.log(
      //   "flagCompletionFn",
      //   `${command.name} ${option?.name}`,
      //   flagCompletionFn,
      // );

      if (flagCompletionFn) {
        // Call custom completion function for the flag
        const comps = await flagCompletionFn(previousArgs, toComplete);
        completions.push(
          ...comps.map((comp) => `${comp.action}\t${comp.description}`),
        );
        directive = ShellCompDirective.ShellCompDirectiveNoFileComp;
      } else {
        // Default completion (e.g., file completion)
        directive = ShellCompDirective.ShellCompDirectiveDefault;
      }
    } else if (toComplete.startsWith("-") && !endsWithSpace) {
      const flag = toComplete.replace(/^-+/, ""); // Remove leading '-'

      if (flag) {
        completions.push(
          ...options
            .filter(
              (o) =>
                !cli.options[o.name] &&
                o.names.some((name) => name.startsWith(flag)),
            )
            .map((o) => `--${o.name}\t${o.description}`),
        );
      } else {
        // Suggest all options not already used
        completions.push(
          ...options
            .filter((o) => !cli.options[o.name])
            .map((o) => `--${o.name}\t${o.description}`),
        );
      }
    } else {
      cli.parse([execPath, processArgs[0], ...previousArgs, toComplete], {
        run: false,
      });
      const fullCommandName = args
        .filter((arg) => !arg.startsWith("-"))
        .join(" ");

      for (const c of cli.commands) {
        const fullCommandParts = fullCommandName.split(" ");
        const commandParts: { type: "command"; value: string }[] = c.name
          .split(" ")
          .map((part) => ({ type: "command", value: part }));
        const args: { type: "positional"; position: number; value: Command["args"][number] }[] =
          c.args.map((arg, i) => ({ type: "positional", position: i, value: arg }));
        const parts = [...commandParts, ...args];
        // console.log(commandParts,'args', args)

        for (let i = 0; i < parts.length; i++) {
          const fullCommandPart = fullCommandParts[i];
          const part = parts[i];
        
          if (part.type === "command") {
            if (part.value === fullCommandPart) {
              // if (commandPart !== toComplete) {
              continue;
              // }
            }
            if (!fullCommandPart || part.value?.includes(fullCommandPart)) {
              completions.push(`${part.value}\t${c.description}`);
            }
          } else {
            if (!fullCommandPart && endsWithSpace) {
              
            }
            console.log(endsWithSpace, fullCommandPart)
            console.log(part.value, part.position, toComplete, fullCommandParts)
            const index = i + part.position
            console.log(i, part.position, index)
            // TODO: fix this
            
            continue
          }

          // console.log("remaining", commandPart, fullCommandPart);
          break;
        }

        // if (
        //   baseCommand === fullCommandName &&
        //   lastPart.startsWith(toComplete)
        // ) {
        //   completions.push(`${lastPart}\t${c.description}`);
        // }
      }
    }

    // Output completions
    for (const comp of completions) {
      console.log(comp.split("\n")[0].trim());
    }
    console.log(`:${directive}`);
    console.error(`Completion ended with directive: ${directive}`);
  });

type Completion = {
  action: string;
  description?: string;
};

type Callback = (
  previousArgs: string[],
  toComplete: string,
) => Completion[] | Promise<Completion[]>;

for (const c of [cli.globalCommand, ...cli.commands]) {
  for (const o of [...cli.globalCommand.options, ...c.options]) {
    if (o.rawName === "--type [type]") {
      flagMap.set(`${c.name} ${o.name}`, () => {
        return [
          {
            action: "standalone",
            description: "Standalone type",
          },
          {
            action: "complex",
            description: "Complex type",
          },
        ];
      });
    }
  }

  // console.log(c.args);
  if (c.name === "deploy") {
    const positionals: Positional[] = [];
    positionalMap.set(c.name, positionals);
    for (const arg of c.args) {
      const completion: Callback = async () => {
        if (arg.value === "environment") {
          return [
            {
              action: "node",
            },
            {
              action: "deno",
            },
          ];
        }
        if (arg.value === "version") {
          return [
            {
              action: "0.0.0",
            },
            {
              action: "0.0.1",
            },
          ];
        }
        if (arg.value === "files") {
          const currentDir = process.cwd();
          const files = await fs.readdir(currentDir);
          const jsonFiles = files.filter(
            (file) => path.extname(file).toLowerCase() === ".json",
          );
          return jsonFiles.map((file) => ({ action: file }));
        }
        return [];
      };

      positionals.push({
        required: arg.required,
        variadic: arg.variadic,
        completion,
      });
    }
  }
}

cli.version("0.0.0");
cli.help();

// console.log('cli', cli)

// ShellCompRequestCmd is the name of the hidden command that is used to request
// completion results from the program. It is used by the shell completion scripts.
const ShellCompRequestCmd: string = "__complete";

// ShellCompNoDescRequestCmd is the name of the hidden command that is used to request
// completion results without their description. It is used by the shell completion scripts.
const ShellCompNoDescRequestCmd: string = "__completeNoDesc";

// ShellCompDirective is a bit map representing the different behaviors the shell
// can be instructed to have once completions have been provided.
const ShellCompDirective = {
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

// console.log({
//   execPath,
//   args: processArgs,
//   x,
// });
// console.error(x)

function genZshComp(name: string, includeDesc: boolean) {
  let compCmd = ShellCompRequestCmd;
  if (!includeDesc) {
    compCmd = ShellCompNoDescRequestCmd;
  }

  return `#compdef ${name}
compdef _${name} ${name}

# zsh completion for ${name} -*- shell-script -*-

__${name}_debug() {
    local file="$BASH_COMP_DEBUG_FILE"
    if [[ -n \${file} ]]; then
        echo "$*" >> "\${file}"
    fi
}

_${name}() {
    local shellCompDirectiveError=${ShellCompDirective.ShellCompDirectiveError}
    local shellCompDirectiveNoSpace=${ShellCompDirective.ShellCompDirectiveNoSpace}
    local shellCompDirectiveNoFileComp=${ShellCompDirective.ShellCompDirectiveNoFileComp}
    local shellCompDirectiveFilterFileExt=${ShellCompDirective.ShellCompDirectiveFilterFileExt}
    local shellCompDirectiveFilterDirs=${ShellCompDirective.ShellCompDirectiveFilterDirs}
    local shellCompDirectiveKeepOrder=${ShellCompDirective.ShellCompDirectiveKeepOrder}

    local lastParam lastChar flagPrefix requestComp out directive comp lastComp noSpace keepOrder
    local -a completions

    __${name}_debug "\\n========= starting completion logic =========="
    __${name}_debug "CURRENT: \${CURRENT}, words[*]: \${words[*]}"

    # The user could have moved the cursor backwards on the command-line.
    # We need to trigger completion from the \$CURRENT location, so we need
    # to truncate the command-line (\$words) up to the \$CURRENT location.
    # (We cannot use \$CURSOR as its value does not work when a command is an alias.)
    words=( "\${=words[1,CURRENT]}" )
    __${name}_debug "Truncated words[*]: \${words[*]},"

    lastParam=\${words[-1]}
    lastChar=\${lastParam[-1]}
    __${name}_debug "lastParam: \${lastParam}, lastChar: \${lastChar}"

    # For zsh, when completing a flag with an = (e.g., ${name} -n=<TAB>)
    # completions must be prefixed with the flag
    setopt local_options BASH_REMATCH
    if [[ "\${lastParam}" =~ '-.*=' ]]; then
        # We are dealing with a flag with an =
        flagPrefix="-P \${BASH_REMATCH}"
    fi

    # Prepare the command to obtain completions
    requestComp="${x} ${compCmd} -- \${words[2,-1]}"
    if [ "\${lastChar}" = "" ]; then
        # If the last parameter is complete (there is a space following it)
        # We add an extra empty parameter so we can indicate this to the go completion code.
        __${name}_debug "Adding extra empty parameter"
        requestComp="\${requestComp} ''"
    fi

    __${name}_debug "About to call: eval \${requestComp}"

    # Use eval to handle any environment variables and such
    out=\$(eval \${requestComp} 2>/dev/null)
    __${name}_debug "completion output: \${out}"

    # Extract the directive integer following a : from the last line
    local lastLine
    while IFS='\n' read -r line; do
        lastLine=\${line}
    done < <(printf "%s\n" "\${out[@]}")
    __${name}_debug "last line: \${lastLine}"

    if [ "\${lastLine[1]}" = : ]; then
        directive=\${lastLine[2,-1]}
        # Remove the directive including the : and the newline
        local suffix
        (( suffix=\${#lastLine}+2))
        out=\${out[1,-\$suffix]}
    else
        # There is no directive specified.  Leave \$out as is.
        __${name}_debug "No directive found.  Setting to default"
        directive=0
    fi

    __${name}_debug "directive: \${directive}"
    __${name}_debug "completions: \${out}"
    __${name}_debug "flagPrefix: \${flagPrefix}"

    if [ \$((directive & shellCompDirectiveError)) -ne 0 ]; then
        __${name}_debug "Completion received error. Ignoring completions."
        return
    fi

    local activeHelpMarker="%"
    local endIndex=\${#activeHelpMarker}
    local startIndex=\$((\${#activeHelpMarker}+1))
    local hasActiveHelp=0
    while IFS='\n' read -r comp; do
        # Check if this is an activeHelp statement (i.e., prefixed with \$activeHelpMarker)
        if [ "\${comp[1,\$endIndex]}" = "\$activeHelpMarker" ];then
            __${name}_debug "ActiveHelp found: \$comp"
            comp="\${comp[\$startIndex,-1]}"
            if [ -n "\$comp" ]; then
                compadd -x "\${comp}"
                __${name}_debug "ActiveHelp will need delimiter"
                hasActiveHelp=1
            fi
            continue
        fi

        if [ -n "\$comp" ]; then
            # If requested, completions are returned with a description.
            # The description is preceded by a TAB character.
            # For zsh's _describe, we need to use a : instead of a TAB.
            # We first need to escape any : as part of the completion itself.
            comp=\${comp//:/\\:}

            local tab="\$(printf '\\t')"
            comp=\${comp//\$tab/:}

            __${name}_debug "Adding completion: \${comp}"
            completions+=\${comp}
            lastComp=\$comp
        fi
    done < <(printf "%s\n" "\${out[@]}")

    # Add a delimiter after the activeHelp statements, but only if:
    # - there are completions following the activeHelp statements, or
    # - file completion will be performed (so there will be choices after the activeHelp)
    if [ \$hasActiveHelp -eq 1 ]; then
        if [ \${#completions} -ne 0 ] || [ \$((directive & shellCompDirectiveNoFileComp)) -eq 0 ]; then
            __${name}_debug "Adding activeHelp delimiter"
            compadd -x "--"
            hasActiveHelp=0
        fi
    fi

    if [ \$((directive & shellCompDirectiveNoSpace)) -ne 0 ]; then
        __${name}_debug "Activating nospace."
        noSpace="-S ''"
    fi

    if [ \$((directive & shellCompDirectiveKeepOrder)) -ne 0 ]; then
        __${name}_debug "Activating keep order."
        keepOrder="-V"
    fi

    if [ \$((directive & shellCompDirectiveFilterFileExt)) -ne 0 ]; then
        # File extension filtering
        local filteringCmd
        filteringCmd='_files'
        for filter in \${completions[@]}; do
            if [ \${filter[1]} != '*' ]; then
                # zsh requires a glob pattern to do file filtering
                filter="\\*.\$filter"
            fi
            filteringCmd+=" -g \$filter"
        done
        filteringCmd+=" \${flagPrefix}"

        __${name}_debug "File filtering command: \$filteringCmd"
        _arguments '*:filename:'"\$filteringCmd"
    elif [ \$((directive & shellCompDirectiveFilterDirs)) -ne 0 ]; then
        # File completion for directories only
        local subdir
        subdir="\${completions[1]}"
        if [ -n "\$subdir" ]; then
            __${name}_debug "Listing directories in \$subdir"
            pushd "\${subdir}" >/dev/null 2>&1
        else
            __${name}_debug "Listing directories in ."
        fi

        local result
        _arguments '*:dirname:_files -/'" \${flagPrefix}"
        result=\$?
        if [ -n "\$subdir" ]; then
            popd >/dev/null 2>&1
        fi
        return \$result
    else
        __${name}_debug "Calling _describe"
        if eval _describe \$keepOrder "completions" completions -Q \${flagPrefix} \${noSpace}; then
            __${name}_debug "_describe found some completions"

            # Return the success of having called _describe
            return 0
        else
            __${name}_debug "_describe did not find completions."
            __${name}_debug "Checking if we should do file completion."
            if [ \$((directive & shellCompDirectiveNoFileComp)) -ne 0 ]; then
                __${name}_debug "deactivating file completion"

                # We must return an error code here to let zsh know that there were no
                # completions found by _describe; this is what will trigger other
                # matching algorithms to attempt to find completions.
                # For example zsh can match letters in the middle of words.
                return 1
            else
                # Perform file completion
                __${name}_debug "Activating file completion"

                # We must return the result of this command, so it must be the
                # last command, or else we must store its result to return it.
                _arguments '*:filename:_files'" \${flagPrefix}"
            fi
        fi
    fi
}

# don't run the completion function when being sourced or eval-ed
if [ "\${funcstack[1]}" = "_${name}" ]; then
    _${name}
fi
`;
}

cli.parse();
